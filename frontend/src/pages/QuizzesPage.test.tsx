import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
vi.mock('../api/client', () => ({ default: client }));

const { default: QuizzesPage } = await import('./QuizzesPage');
const { default: FormQuizBuilder } = await import('./FormQuizBuilder');

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

/** The dashboard's list and builder keep their wording and their /admin links. */
describe('dashboard quiz pages (admin mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.get.mockImplementation(async (url: string) => {
      if (url === '/api/v1/quizzes') {
        return { data: [{ id: 'q1', title: { en: 'Intro to Go' }, status: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }] };
      }
      if (url.endsWith('/questions')) return { data: [] };
      throw new Error('404');
    });
  });

  const renderList = () =>
    render(
      <MemoryRouter initialEntries={['/admin/quizzes']}>
        <Routes>
          <Route path="/admin/quizzes" element={<QuizzesPage />} />
        </Routes>
        <Where />
      </MemoryRouter>
    );

  it('keeps its English wording, the status dropdown and the archive action', async () => {
    renderList();
    expect(await screen.findByRole('heading', { level: 1, name: 'Quiz Games' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Archive quiz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change status/i })).toBeInTheDocument();
    expect(screen.queryByText(/saved in this browser/i)).not.toBeInTheDocument();
  });

  it('opens the builder under /admin', async () => {
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: /new quiz/i }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/builder');
  });

  it('edits under /admin/builder/:id', async () => {
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit quiz' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/builder/q1');
  });

  it('the builder goes back to /admin/quizzes', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/builder']}>
        <Routes>
          <Route path="/admin/builder" element={<FormQuizBuilder />} />
        </Routes>
        <Where />
      </MemoryRouter>
    );
    expect(await screen.findByRole('button', { name: 'Save Quiz' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to quizzes' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/quizzes');
  });
});
