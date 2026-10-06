import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('../../api/client', () => ({ default: { post } }));

const { default: ContactForm } = await import('./ContactForm');

describe('ContactForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('explains every missing field and does not call the API', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.getByText(/please enter your name/i)).toBeInTheDocument();
    expect(screen.getByText(/please enter your email/i)).toBeInTheDocument();
    expect(screen.getByText(/tell us a little/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/your name/i), 'Sam');
    await user.type(screen.getByLabelText(/^email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/about your group/i), 'Hello');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.getByText(/does not look right/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('posts trimmed values and shows the success state', async () => {
    post.mockResolvedValue({ data: { status: 'success' } });
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/your name/i), '  Sam  ');
    await user.type(screen.getByLabelText(/^email/i), 'sam@example.com');
    await user.type(screen.getByLabelText(/about your group/i), 'A cohort of 40');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(screen.getByText(/message sent/i)).toBeInTheDocument());
    expect(post).toHaveBeenCalledWith('/api/v1/contact', {
      name: 'Sam',
      email: 'sam@example.com',
      message: 'A cohort of 40',
    });
  });

  it('keeps what was typed when sending fails', async () => {
    post.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/your name/i), 'Sam');
    await user.type(screen.getByLabelText(/^email/i), 'sam@example.com');
    await user.type(screen.getByLabelText(/about your group/i), 'Hello');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not send/i);
    expect(screen.getByLabelText(/your name/i)).toHaveValue('Sam');
    expect(screen.getByRole('button', { name: /send message/i })).toBeEnabled();
  });
});
