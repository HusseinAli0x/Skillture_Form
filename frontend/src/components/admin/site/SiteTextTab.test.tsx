import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { siteStrings } from '../../../lib/siteStrings';

const put = vi.fn();
const get = vi.fn();
vi.mock('../../../api/client', () => ({ default: { put, get } }));

const { useSiteStore } = await import('../../../context/SiteStore');
const { default: SiteTextTab } = await import('./SiteTextTab');

const ENGLISH_DEFAULT = siteStrings.en.home.ctaPrimary;

function setup(text = { en: {}, ar: {} } as Record<'en' | 'ar', Record<string, string>>) {
  useSiteStore.setState({ status: 'ready', text, images: {} });
  return render(
    <MemoryRouter>
      <SiteTextTab />
    </MemoryRouter>,
  );
}

/** Narrow the list to one known string and return its English field. */
async function findEnglishField(user: ReturnType<typeof userEvent.setup>, current = ENGLISH_DEFAULT) {
  // The key is unique; the wording alone is not (the same words appear on several pages).
  await user.type(screen.getByRole('searchbox', { name: /search the site wording/i }), 'site.home.ctaPrimary');
  return screen.getByDisplayValue(current) as HTMLTextAreaElement;
}

describe('SiteTextTab', () => {
  beforeEach(() => {
    put.mockReset().mockResolvedValue({ data: { status: 'success' } });
    get.mockReset().mockResolvedValue({ data: { text: { en: { 'site.home.ctaPrimary': 'Join the club' }, ar: {} } } });
  });

  it('lists the site wording with a count and starts with nothing to save', () => {
    setup();
    expect(screen.getByText(/of \d+ lines/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /save changes/i })).toHaveTextContent('All changes saved');
    expect(screen.getByRole('button', { name: /^save changes$/i })).toBeDisabled();
    expect(put).not.toHaveBeenCalled();
  });

  it('names every field after its string, so a screen reader can tell hundreds of them apart', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole('searchbox', { name: /search the site wording/i }), 'site.home.ctaPrimary');
    expect(screen.getByRole('textbox', { name: 'Cta Primary (English)' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Cta Primary (Arabic)' })).toBeInTheDocument();
  });

  it('clears only the edits that were saved, keeping anything typed while the save ran', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    put.mockReturnValue(new Promise(r => (release = () => r({ data: {} }))));
    // The server now has the saved English text, as the real refetch would show.
    get.mockResolvedValue({ data: { text: { en: { 'site.home.ctaPrimary': ENGLISH_DEFAULT + '!' }, ar: {} } } });
    setup();
    const field = await findEnglishField(user);
    await user.type(field, '!');
    await user.click(screen.getByRole('button', { name: /save 1 change/i }));

    // Typed into the other language while the request is still in flight.
    const arabic = screen.getByRole('textbox', { name: 'Cta Primary (Arabic)' });
    await user.type(arabic, 'x');
    release();

    await waitFor(() => expect(useSiteStore.getState().text.en['site.home.ctaPrimary']).toBe(ENGLISH_DEFAULT + '!'));
    await waitFor(() => expect(screen.getByRole('button', { name: /save 1 change/i })).toBeInTheDocument());
    expect((screen.getByRole('textbox', { name: 'Cta Primary (Arabic)' }) as HTMLTextAreaElement).value).toContain('x');
  });

  it('shows what is on the site now, including an admin edit', async () => {
    const user = userEvent.setup();
    setup({ en: { 'site.home.ctaPrimary': 'Join the club' }, ar: {} });
    const field = await findEnglishField(user, 'Join the club');
    expect(field).toBeInTheDocument();
    expect(screen.getByText('Customised')).toBeInTheDocument();
  });

  it('saves only the lines that changed, then reloads the live content', async () => {
    const user = userEvent.setup();
    setup();
    const field = await findEnglishField(user);

    await user.clear(field);
    await user.type(field, 'Join the club');
    await user.click(screen.getByRole('button', { name: /save 1 change/i }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith('/api/v1/admin/site/text', {
      changes: [{ key: 'site.home.ctaPrimary', locale: 'en', value: 'Join the club' }],
    });
    // The store was refreshed from the server afterwards.
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/site'));
    await waitFor(() => expect(useSiteStore.getState().text.en['site.home.ctaPrimary']).toBe('Join the club'));
  });

  it('"Use default" puts the original wording back and saves it as a reset', async () => {
    const user = userEvent.setup();
    setup({ en: { 'site.home.ctaPrimary': 'Join the club' }, ar: {} });
    await findEnglishField(user, 'Join the club');

    await user.click(screen.getAllByRole('button', { name: /use default/i })[0]);
    expect(screen.getByDisplayValue(ENGLISH_DEFAULT)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save 1 change/i }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put).toHaveBeenCalledWith('/api/v1/admin/site/text', {
      changes: [{ key: 'site.home.ctaPrimary', locale: 'en', value: '' }],
    });
  });

  it('keeps the edit and says so when saving fails', async () => {
    put.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    setup();
    const field = await findEnglishField(user);
    await user.type(field, '!');
    await user.click(screen.getByRole('button', { name: /save 1 change/i }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(screen.getByDisplayValue(ENGLISH_DEFAULT + '!')).toBeInTheDocument();
    expect(useSiteStore.getState().text.en).toEqual({});
  });

  it('does not let the English homepage copy be edited here', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole('searchbox', { name: /search the site wording/i }), 'core.hero.title');
    expect(screen.getAllByRole('link', { name: /homepage editor/i }).length).toBeGreaterThan(0);
  });
});
