import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '../../../context/ToastStore';
import type { Workshop } from './workshopModel';

const get = vi.fn();
const del = vi.fn();
vi.mock('../../../api/client', () => ({ default: { get, delete: del } }));

const saveBlob = vi.fn();
const copyText = vi.fn();
vi.mock('../../../lib/download', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/download')>('../../../lib/download');
  return { ...actual, saveBlob: (...a: unknown[]) => saveBlob(...a), copyText: (...a: unknown[]) => copyText(...a) };
});

const { default: RegistrantsPanel } = await import('./RegistrantsPanel');

const workshop: Workshop = {
  id: 'w1',
  title: { en: 'Intro to Git', ar: 'مقدمة في جيت' },
  description: { en: 'Branches', ar: 'فروع' },
  image_path: null,
  event_date: '2999-05-20',
  event_time: null,
  capacity: 40,
};

const people = [
  { id: 'r1', name: 'Sam Ali', email: 'sam@example.com', created_at: '2026-01-02T10:00:00Z' },
  { id: 'r2', name: 'Noor Hassan', email: 'noor@example.org', created_at: '2026-01-03T10:00:00Z' },
];

const setup = (onCountChange = vi.fn(), onClose = vi.fn()) => {
  render(<RegistrantsPanel workshop={workshop} onClose={onClose} onCountChange={onCountChange} />);
  return { onCountChange, onClose };
};

const lastToast = () => useToastStore.getState().toasts.at(-1);

describe('RegistrantsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });
    get.mockResolvedValue({ data: people });
  });

  it('lists name, email as a mailto link and a count against the seat limit', async () => {
    const { onCountChange } = setup();

    expect(await screen.findByText('Sam Ali')).toBeInTheDocument();
    expect(screen.getByText('Noor Hassan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sam@example.com/ })).toHaveAttribute('href', 'mailto:sam@example.com');
    expect(screen.getByText('2 of 40 seats taken')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/v1/admin/workshops/w1/registrations');
    expect(onCountChange).toHaveBeenCalledWith('w1', 2);
  });

  it('shows a loading state first', () => {
    get.mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.getByRole('status', { name: /loading registrants/i })).toBeInTheDocument();
  });

  it('has an empty state', async () => {
    get.mockResolvedValue({ data: [] });
    setup();
    expect(await screen.findByText(/nobody has registered yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /copy all emails/i })).toBeDisabled();
  });

  it('shows an error with a retry that reloads', async () => {
    get.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    setup();

    expect(await screen.findByText(/could not load registrants/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Sam Ali')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('filters by name or email', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Sam Ali');

    await user.type(screen.getByRole('searchbox', { name: /search registrants/i }), 'noor@');
    expect(screen.queryByText('Sam Ali')).not.toBeInTheDocument();
    expect(screen.getByText('Noor Hassan')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText(/no one matches/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(screen.getByText('Sam Ali')).toBeInTheDocument();
  });

  it('refreshes on demand', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Sam Ali');

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  describe('removing', () => {
    it('asks first, then deletes the row and reports the new count', async () => {
      del.mockResolvedValue({});
      const user = userEvent.setup();
      const { onCountChange } = setup();
      await screen.findByText('Sam Ali');

      await user.click(screen.getByRole('button', { name: 'Remove Sam Ali' }));
      const dialog = screen.getByRole('dialog', { name: /remove this registration/i });
      expect(del).not.toHaveBeenCalled();
      await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(screen.queryByText('Sam Ali')).not.toBeInTheDocument());
      expect(del).toHaveBeenCalledWith('/api/v1/admin/workshops/w1/registrations/r1');
      expect(onCountChange).toHaveBeenLastCalledWith('w1', 1);
      expect(screen.getByText('1 of 40 seats taken')).toBeInTheDocument();
    });

    it('does nothing when cancelled', async () => {
      const user = userEvent.setup();
      setup();
      await screen.findByText('Sam Ali');

      await user.click(screen.getByRole('button', { name: 'Remove Sam Ali' }));
      await user.click(within(screen.getByRole('dialog', { name: /remove this registration/i })).getByRole('button', { name: 'Cancel' }));

      expect(del).not.toHaveBeenCalled();
      expect(screen.getByText('Sam Ali')).toBeInTheDocument();
    });

    it('keeps the row and says so when the delete fails', async () => {
      del.mockRejectedValue(new Error('boom'));
      const user = userEvent.setup();
      setup();
      await screen.findByText('Sam Ali');

      await user.click(screen.getByRole('button', { name: 'Remove Sam Ali' }));
      await user.click(within(screen.getByRole('dialog', { name: /remove this registration/i })).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(lastToast()?.type).toBe('error'));
      expect(screen.getByText('Sam Ali')).toBeInTheDocument();
    });
  });

  describe('export', () => {
    it('downloads the CSV as a blob using the server file name', async () => {
      const blob = new Blob(['﻿Name,Email'], { type: 'text/csv' });
      get.mockImplementation((url: string) =>
        url.endsWith('.csv')
          ? Promise.resolve({ data: blob, headers: { 'content-disposition': 'attachment; filename="registrations-intro-to-git.csv"' } })
          : Promise.resolve({ data: people })
      );
      const user = userEvent.setup();
      setup();
      await screen.findByText('Sam Ali');

      await user.click(screen.getByRole('button', { name: /export csv/i }));

      await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(blob, 'registrations-intro-to-git.csv'));
      expect(get).toHaveBeenCalledWith('/api/v1/admin/workshops/w1/registrations.csv', { responseType: 'blob' });
      expect(lastToast()?.type).toBe('success');
    });

    it('falls back to registrations.csv without a header', async () => {
      const blob = new Blob(['x']);
      get.mockImplementation((url: string) =>
        url.endsWith('.csv') ? Promise.resolve({ data: blob, headers: {} }) : Promise.resolve({ data: people })
      );
      const user = userEvent.setup();
      setup();
      await screen.findByText('Sam Ali');

      await user.click(screen.getByRole('button', { name: /export csv/i }));

      await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(blob, 'registrations.csv'));
    });

    it('shows an error toast and re-enables the button when the export fails', async () => {
      get.mockImplementation((url: string) =>
        url.endsWith('.csv') ? Promise.reject(new Error('boom')) : Promise.resolve({ data: people })
      );
      const user = userEvent.setup();
      setup();
      await screen.findByText('Sam Ali');

      await user.click(screen.getByRole('button', { name: /export csv/i }));

      await waitFor(() => expect(lastToast()).toMatchObject({ type: 'error', message: expect.stringMatching(/could not export/i) }));
      expect(saveBlob).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /export csv/i })).toBeEnabled();
    });
  });

  describe('copy all emails', () => {
    it('copies every email, comma separated, even while a search is active', async () => {
      copyText.mockResolvedValue(true);
      const user = userEvent.setup();
      setup();
      await screen.findByText('Sam Ali');
      await user.type(screen.getByRole('searchbox'), 'sam');

      await user.click(screen.getByRole('button', { name: /copy all emails/i }));

      expect(copyText).toHaveBeenCalledWith('sam@example.com, noor@example.org');
      await waitFor(() => expect(lastToast()).toMatchObject({ type: 'success', message: 'Copied 2 emails' }));
    });

    it('reports a failed copy', async () => {
      copyText.mockResolvedValue(false);
      const user = userEvent.setup();
      setup();
      await screen.findByText('Sam Ali');

      await user.click(screen.getByRole('button', { name: /copy all emails/i }));

      await waitFor(() => expect(lastToast()?.type).toBe('error'));
    });
  });
});
