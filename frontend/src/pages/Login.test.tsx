import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('../api/client', () => ({ default: { post, get: vi.fn() } }));

const { default: Login } = await import('./Login');
const { useAuthStore } = await import('../context/AuthStore');

const renderAt = (from?: string) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : undefined }]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin/dashboard" element={<p>dashboard</p>} />
        <Route path="/admin/messages" element={<p>messages page</p>} />
      </Routes>
    </MemoryRouter>
  );

describe('Login', () => {
  beforeEach(() => {
    post.mockReset();
    useAuthStore.getState().logout();
  });

  it('submits with Enter, signs in and lands on the dashboard', async () => {
    post.mockResolvedValue({ data: { token: 't', expires_at: '', admin: { id: '1', username: 'admin' } } });
    renderAt();
    await userEvent.type(screen.getByLabelText('Username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'secret{Enter}');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/admin/login', { username: 'admin', password: 'secret' });
  });

  it('returns to the page the admin was sent from', async () => {
    post.mockResolvedValue({ data: { token: 't', expires_at: '', admin: { id: '1', username: 'admin' } } });
    renderAt('/admin/messages');
    await userEvent.type(screen.getByLabelText('Username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'secret{Enter}');
    expect(await screen.findByText('messages page')).toBeInTheDocument();
  });

  it('shows a plain error for wrong credentials and keeps the form', async () => {
    post.mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, {
        status: 401,
        statusText: '',
        headers: {},
        config: {} as never,
        data: { error: 'invalid credentials' },
      })
    );
    renderAt();
    await userEvent.type(screen.getByLabelText('Username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'nope{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(screen.getByLabelText('Username')).toHaveValue('admin');
  });

  it('toggles password visibility', async () => {
    renderAt();
    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    await waitFor(() => expect(field).toHaveAttribute('type', 'text'));
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });
});
