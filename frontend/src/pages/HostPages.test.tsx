import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
vi.mock('../api/client', () => ({ default: client }));

const { GameBuilderPage, MyGamesPage } = await import('./HostPages');
const { default: ToastContainer } = await import('../components/Toast');
const { useSiteStore } = await import('../context/SiteStore');
const { useLanguageStore } = await import('../context/LanguageStore');
const { useToastStore } = await import('../context/ToastStore');

const quiz = (over: Record<string, unknown> = {}) => ({
  id: 'q1',
  title: { en: 'Intro to Go' },
  description: { en: 'Basics' },
  status: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const question = {
  id: 'qq1',
  quiz_id: 'q1',
  question: { en: 'What is Go?' },
  type: 'tf',
  position: 0,
  time_limit_sec: 20,
  points: 1000,
  options: { opt_0: { value: 'True' }, opt_1: { value: 'False' } },
  correct_answer: { value: 'True' },
};

const failure = (status: number, data: unknown = {}) =>
  new AxiosError('failed', 'ERR', undefined, undefined, { status, statusText: '', data, headers: {}, config: {} } as unknown as AxiosResponse);

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/create" element={<MyGamesPage />} />
        <Route path="/create/new" element={<GameBuilderPage />} />
        <Route path="/create/:id" element={<GameBuilderPage />} />
        <Route path="/host/lobby/:id" element={<Where />} />
      </Routes>
      <Where />
      <ToastContainer />
    </MemoryRouter>
  );

/** Route answers for the list page: quizzes, then each quiz's questions. */
const mockList = (quizzes: unknown[], questions: unknown[] = [question]) => {
  client.get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/quizzes') return { data: quizzes };
    if (url.endsWith('/questions')) return { data: questions };
    if (url.endsWith('/active-session')) throw failure(404);
    throw new Error(`unexpected GET ${url}`);
  });
};

describe('public hosting pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSiteStore.setState({ status: 'ready' });
    useLanguageStore.setState({ locale: 'en' });
    useToastStore.setState({ toasts: [] });
  });

  describe('My games (/create)', () => {
    it('lists the visitor\'s games with a status chip and the saved-in-browser note', async () => {
      mockList([quiz(), quiz({ id: 'q2', title: { en: 'Live one' }, status: 1 })]);
      renderAt('/create');

      expect(await screen.findByRole('heading', { name: 'Intro to Go' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Live one' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'My games' })).toBeInTheDocument();
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText(/saved in this browser/i)).toBeInTheDocument();
      // No admin-only controls for a visitor.
      expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument();
      expect(client.get).toHaveBeenCalledWith('/api/v1/quizzes');
    });

    it('is reachable from the site navigation, which marks it as the current page', async () => {
      mockList([quiz()]);
      renderAt('/create');
      await screen.findByRole('heading', { name: 'Intro to Go' });
      const links = screen.getAllByRole('link', { name: 'Host a game' });
      expect(links.length).toBeGreaterThan(0);
      expect(links.every(l => l.getAttribute('href') === '/create')).toBe(true);
      expect(links.some(l => l.getAttribute('aria-current') === 'page')).toBe(true);
    });

    it('teaches what to do when there are no games yet', async () => {
      mockList([]);
      renderAt('/create');
      expect(await screen.findByText('Make your first live game')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Create your first game' }));
      expect(screen.getByTestId('where')).toHaveTextContent('/create/new');
    });

    it('says so, and offers a retry, when the list cannot load', async () => {
      client.get.mockRejectedValueOnce(failure(500));
      renderAt('/create');
      expect(await screen.findByText('Could not load your games')).toBeInTheDocument();

      mockList([quiz()]);
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('heading', { name: 'Intro to Go' })).toBeInTheDocument();
    });

    it('hosts a draft: activates it, opens a session and goes to the lobby', async () => {
      mockList([quiz()]);
      client.patch.mockResolvedValue({ data: {} });
      client.post.mockResolvedValue({ data: { id: 'sess-1' } });
      renderAt('/create');

      await userEvent.click(await screen.findByRole('button', { name: 'Host now' }));

      await waitFor(() => expect(screen.getAllByTestId('where').some(n => n.textContent === '/host/lobby/sess-1')).toBe(true));
      expect(client.patch).toHaveBeenCalledWith('/api/v1/quizzes/q1/activate');
      expect(client.post).toHaveBeenCalledWith('/api/v1/quizzes/q1/sessions');
    });

    it('explains a rate limit in plain words', async () => {
      mockList([quiz()]);
      client.patch.mockResolvedValue({ data: {} });
      client.post.mockRejectedValue(failure(429, { error: 'slow down', retry_after_seconds: 600 }));
      renderAt('/create');

      await userEvent.click(await screen.findByRole('button', { name: 'Host now' }));

      expect(await screen.findByText(/too often.*10 minutes/i)).toBeInTheDocument();
    });

    it('asks before deleting, then deletes', async () => {
      mockList([quiz()]);
      client.delete.mockResolvedValue({ data: {} });
      renderAt('/create');

      await userEvent.click(await screen.findByRole('button', { name: 'Delete game' }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent(/permanently deleted/i);
      expect(client.delete).not.toHaveBeenCalled();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(client.delete).toHaveBeenCalledWith('/api/v1/quizzes/q1'));
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Intro to Go' })).not.toBeInTheDocument());
    });

    it('opens the editor from Edit', async () => {
      mockList([quiz()]);
      renderAt('/create');
      await userEvent.click(await screen.findByRole('button', { name: 'Edit game' }));
      expect(screen.getByTestId('where')).toHaveTextContent('/create/q1');
    });

    it('speaks Arabic, right to left', async () => {
      useLanguageStore.setState({ locale: 'ar' });
      mockList([quiz()]);
      const { container } = renderAt('/create');

      expect(await screen.findByRole('heading', { level: 1, name: 'ألعابي' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'استضف الآن' })).toBeInTheDocument();
      expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    });
  });

  describe('Game builder (/create/new, /create/:id)', () => {
    it('creates a game: posts the quiz, replaces its questions, then lands on its edit URL', async () => {
      client.post.mockResolvedValue({ data: { id: 'new1' } });
      client.put.mockResolvedValue({ data: {} });
      client.get.mockImplementation(async (url: string) =>
        url.endsWith('/questions') ? { data: [question] } : { data: quiz({ id: 'new1', title: { en: 'My quiz' } }) }
      );
      renderAt('/create/new');
      const user = userEvent.setup();

      await user.type(await screen.findByLabelText(/^title/i), 'My quiz');
      await user.type(screen.getByLabelText(/^question text/i), 'Is the sky blue?');
      await user.click(screen.getByRole('radio', { name: 'True / False' }));
      await user.click(screen.getByRole('button', { name: 'True' }));
      await user.click(screen.getByRole('button', { name: /save game/i }));

      await waitFor(() => expect(client.post).toHaveBeenCalledWith('/api/v1/quizzes', expect.objectContaining({ title: { en: 'My quiz' } })));
      const [url, body] = client.put.mock.calls.find(c => String(c[0]).endsWith('/questions'))!;
      expect(url).toBe('/api/v1/quizzes/new1/questions');
      expect(body.questions).toHaveLength(1);
      expect(body.questions[0]).toMatchObject({ type: 'tf', correct_answer: { value: 'True' } });
      await waitFor(() => expect(screen.getAllByTestId('where')[0]).toHaveTextContent('/create/new1'));
    });

    it('does not save an incomplete game, and says what is missing', async () => {
      renderAt('/create/new');
      await userEvent.click(await screen.findByRole('button', { name: /save game/i }));
      expect(await screen.findByText(/Give the game a title\./)).toBeInTheDocument();
      expect(client.post).not.toHaveBeenCalled();
    });

    it('shows the games limit on the page when creating is refused (409)', async () => {
      client.post.mockRejectedValue(failure(409, { error: 'limit reached' }));
      renderAt('/create/new');
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText(/^title/i), 'Another');
      await user.type(screen.getByLabelText(/^question text/i), 'Q?');
      await user.click(screen.getByRole('radio', { name: 'Short Answer' }));
      await user.type(screen.getByLabelText('Correct answer'), 'yes');
      await user.click(screen.getByRole('button', { name: /save game/i }));

      const alerts = await screen.findAllByRole('alert');
      expect(alerts.some(a => /limit of 30 games/i.test(a.textContent ?? ''))).toBe(true);
    });

    it('loads an existing game for editing', async () => {
      client.get.mockImplementation(async (url: string) => (url.endsWith('/questions') ? { data: [question] } : { data: quiz() }));
      renderAt('/create/q1');
      expect(await screen.findByDisplayValue('Intro to Go')).toBeInTheDocument();
      expect(screen.getByDisplayValue('What is Go?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Host now' })).toBeInTheDocument();
      // The dashboard's status dropdown is not part of the public builder.
      expect(screen.queryByRole('button', { name: /change status/i })).not.toBeInTheDocument();
    });

    it('shows a way back when the game is not there (someone else\'s, or deleted)', async () => {
      client.get.mockRejectedValue(failure(404));
      renderAt('/create/missing');
      expect(await screen.findByText('This game could not be opened')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save game/i })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Back to my games' }));
      expect(screen.getAllByTestId('where')[0]).toHaveTextContent('/create');
    });
  });
});
