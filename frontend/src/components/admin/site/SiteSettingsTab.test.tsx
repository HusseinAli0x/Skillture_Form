import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SETTINGS } from '../../../lib/siteContent';

const put = vi.fn();
const get = vi.fn();
vi.mock('../../../api/client', () => ({ default: { put, get } }));

const { useSiteStore } = await import('../../../context/SiteStore');
const { default: SiteSettingsTab } = await import('./SiteSettingsTab');

const email = () => screen.getByRole('textbox', { name: /contact email/i }) as HTMLInputElement;
const linkedin = () => screen.getByRole('textbox', { name: /linkedin/i }) as HTMLInputElement;

describe('SiteSettingsTab', () => {
  beforeEach(() => {
    // A tiny fake server: it keeps what was saved and returns it on the refetch.
    let stored: Record<string, string> = {};
    put.mockReset().mockImplementation(async (_url: string, body: { settings: Record<string, string> }) => {
      stored = { ...DEFAULT_SETTINGS, ...stored, ...body.settings };
      // Like the real server: an emptied email goes back to its default.
      if (stored.contact_email === '') stored.contact_email = DEFAULT_SETTINGS.contact_email;
      return { data: { status: 'success' } };
    });
    get.mockReset().mockImplementation(async () => ({ data: { settings: Object.keys(stored).length ? stored : DEFAULT_SETTINGS } }));
    useSiteStore.setState({ status: 'ready', text: { en: {}, ar: {} }, images: {}, settings: { ...DEFAULT_SETTINGS } });
    render(<SiteSettingsTab />);
  });

  it('starts from the saved contact details', () => {
    expect(email().value).toBe('skillture.course@gmail.com');
    expect(linkedin().value).toBe(DEFAULT_SETTINGS.linkedin_url);
  });

  it('keeps what the admin is typing when the content is refreshed behind their back', async () => {
    const user = userEvent.setup();
    await user.clear(email());
    await user.type(email(), 'hello@example.org');

    // Another tab saved an image, which reloads the whole store with a new
    // settings object.
    act(() => useSiteStore.setState({ settings: { ...DEFAULT_SETTINGS } }));

    expect(email().value).toBe('hello@example.org');
  });

  it('follows a refresh when there is nothing unsaved', () => {
    act(() => useSiteStore.setState({ settings: { ...DEFAULT_SETTINGS, contact_email: 'new@example.org' } }));
    expect(email().value).toBe('new@example.org');
  });

  it('refuses a bad email or link with a plain-language message, and does not send', async () => {
    const user = userEvent.setup();
    await user.clear(email());
    await user.type(email(), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /^save changes$/i }));
    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('saves, and shows the saved values straight away', async () => {
    const user = userEvent.setup();
    await user.clear(email());
    await user.type(email(), 'hello@example.org');
    await user.click(screen.getByRole('button', { name: /^save changes$/i }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][0]).toBe('/api/v1/admin/site/settings');
    expect(put.mock.calls[0][1].settings.contact_email).toBe('hello@example.org');
    expect(useSiteStore.getState().settings.contact_email).toBe('hello@example.org');
  });

  it('hides a link when it is emptied, instead of putting the built-in one back', async () => {
    const user = userEvent.setup();
    await user.clear(linkedin());
    await user.click(screen.getByRole('button', { name: /^save changes$/i }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][1].settings.linkedin_url).toBe('');
    expect(useSiteStore.getState().settings.linkedin_url).toBe('');
    await waitFor(() => expect(linkedin().value).toBe(''));
  });

  it('puts the default email back when the email is emptied', async () => {
    const user = userEvent.setup();
    await user.clear(email());
    await user.type(email(), 'hello@example.org');
    await user.click(screen.getByRole('button', { name: /^save changes$/i }));
    await waitFor(() => expect(email().value).toBe('hello@example.org'));

    await user.clear(email());
    await user.click(screen.getByRole('button', { name: /^save changes$/i }));
    await waitFor(() => expect(email().value).toBe('skillture.course@gmail.com'));
  });
});
