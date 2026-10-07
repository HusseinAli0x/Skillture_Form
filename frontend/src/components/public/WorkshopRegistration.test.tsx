import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicWorkshop } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';

const post = vi.fn();
vi.mock('../../api/client', () => ({ default: { post } }));

const { default: WorkshopRegistration } = await import('./WorkshopRegistration');

const workshop = (over: Partial<PublicWorkshop> = {}): PublicWorkshop => ({
  id: 'w1',
  title: { en: 'Intro to Git', ar: 'مقدمة في جيت' },
  description: { en: 'Branches', ar: 'فروع' },
  image_path: null,
  event_date: '2999-05-20',
  event_time: '14:30',
  track: null,
  location: 'Main hall',
  speaker: null,
  attendees: null,
  gallery: [],
  registration_url: null,
  registration_open: true,
  capacity: null,
  registered: 0,
  spots_left: null,
  registration_status: 'open',
  ...over,
});

/** What axios rejects with for an HTTP error response. */
const httpError = (status: number, data: unknown) =>
  Object.assign(new Error(`status ${status}`), { isAxiosError: true, response: { status, data } });

const renderForm = (w = workshop(), onChanged?: () => void, entry = '/workshops/w1') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <WorkshopRegistration workshop={w} onChanged={onChanged} />
    </MemoryRouter>
  );

const fill = async (user: ReturnType<typeof userEvent.setup>, name = 'Sam Ali', email = 'sam@example.com') => {
  if (name) await user.type(screen.getByLabelText(/full name/i), name);
  if (email) await user.type(screen.getByLabelText(/^email/i), email);
};

describe('WorkshopRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useLanguageStore.setState({ locale: 'en' });
  });

  describe('validation', () => {
    it('explains every missing field and does not call the API', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByRole('button', { name: /^register$/i }));

      expect(screen.getByText(/please enter your name/i)).toBeInTheDocument();
      expect(screen.getByText(/please enter your email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toHaveFocus();
      expect(screen.getByLabelText(/full name/i)).toHaveAttribute('aria-invalid', 'true');
      expect(post).not.toHaveBeenCalled();
    });

    it('rejects a malformed email and links the error to the input', async () => {
      const user = userEvent.setup();
      renderForm();

      await fill(user, 'Sam', 'not-an-email');
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      const email = screen.getByLabelText(/^email/i);
      expect(screen.getByText(/does not look right/i)).toBeInTheDocument();
      expect(email).toHaveAttribute('aria-invalid', 'true');
      expect(email).toHaveAttribute('aria-describedby', 'register-email-error');
      expect(post).not.toHaveBeenCalled();
    });

    it('rejects a name over 120 characters', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByLabelText(/full name/i));
      await user.paste('a'.repeat(121));
      await user.type(screen.getByLabelText(/^email/i), 'sam@example.com');
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      expect(screen.getByText(/name is too long/i)).toBeInTheDocument();
      expect(post).not.toHaveBeenCalled();
    });

    it('validates a field when it loses focus', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/^email/i), 'nope');
      await user.tab();

      expect(screen.getByText(/does not look right/i)).toBeInTheDocument();
    });
  });

  describe('submitting', () => {
    it('posts trimmed values with an empty honeypot and shows what was registered', async () => {
      post.mockResolvedValue({ data: { status: 'registered' } });
      const onChanged = vi.fn();
      const user = userEvent.setup();
      renderForm(workshop(), onChanged);

      await fill(user, '  Sam Ali  ', 'sam@example.com');
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      await waitFor(() => expect(screen.getByText(/you are registered/i)).toBeInTheDocument());
      expect(post).toHaveBeenCalledWith('/api/v1/workshops/w1/register', {
        name: 'Sam Ali',
        email: 'sam@example.com',
        website: '',
      });
      expect(onChanged).toHaveBeenCalledTimes(1);
      const card = screen.getByRole('status');
      expect(card).toHaveTextContent('Sam Ali · sam@example.com');
      expect(card).toHaveTextContent('May 20, 2999');
      expect(card).toHaveTextContent('14:30');
      expect(card).toHaveTextContent('Main hall');
    });

    it('lets the visitor register someone else', async () => {
      post.mockResolvedValue({ data: { status: 'registered' } });
      const user = userEvent.setup();
      renderForm();

      await fill(user);
      await user.click(screen.getByRole('button', { name: /^register$/i }));
      await user.click(await screen.findByRole('button', { name: /register someone else/i }));

      expect(screen.getByLabelText(/full name/i)).toHaveValue('');
      expect(screen.getByRole('button', { name: /^register$/i })).toBeEnabled();
    });

    it('stays on the confirmation when the last seat was just taken', async () => {
      post.mockResolvedValue({ data: { status: 'registered' } });
      const user = userEvent.setup();
      const { rerender } = renderForm(workshop({ capacity: 5, spots_left: 1 }));

      await fill(user);
      await user.click(screen.getByRole('button', { name: /^register$/i }));
      await screen.findByText(/you are registered/i);

      rerender(
        <MemoryRouter initialEntries={['/workshops/w1']}>
          <WorkshopRegistration workshop={workshop({ capacity: 5, spots_left: 0, registration_status: 'full' })} />
        </MemoryRouter>
      );

      expect(screen.getByText(/you are registered/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /register someone else/i })).not.toBeInTheDocument();
    });

    it('keeps what was typed and shows the busy state while sending', async () => {
      let resolve: (v: unknown) => void = () => {};
      post.mockReturnValue(new Promise(r => (resolve = r)));
      const user = userEvent.setup();
      renderForm();

      await fill(user);
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      const busy = screen.getByRole('button', { name: /registering/i });
      expect(busy).toBeDisabled();
      expect(busy).toHaveAttribute('aria-busy', 'true');
      resolve({ data: { status: 'registered' } });
      await screen.findByText(/you are registered/i);
    });
  });

  describe('server errors', () => {
    const alertCases: [string, number, Record<string, unknown>, RegExp][] = [
      ['already_registered', 409, { code: 'already_registered', error: 'raw english' }, /already registered/i],
      ['workshop_full', 409, { code: 'workshop_full' }, /last seat was just taken/i],
      ['registration_closed', 422, { code: 'registration_closed' }, /has just closed/i],
      ['workshop_ended', 422, { code: 'workshop_ended' }, /already taken place/i],
      ['workshop_not_found', 404, { code: 'workshop_not_found' }, /could not find this workshop/i],
      ['server_error', 500, { code: 'server_error' }, /went wrong on our side/i],
      ['rate limit (no code)', 429, { error: 'too many requests', retry_after_seconds: 300 }, /too many attempts/i],
      ['unknown code', 502, { code: 'something_new' }, /went wrong on our side/i],
    ];

    it.each(alertCases)('%s shows a localized alert, never the server text', async (_label, status, data, message) => {
      post.mockRejectedValue(httpError(status, data));
      const user = userEvent.setup();
      renderForm();

      await fill(user);
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(message);
      expect(alert).not.toHaveTextContent(/raw english|too many requests/);
      expect(screen.getByLabelText(/full name/i)).toHaveValue('Sam Ali');
      expect(screen.getByRole('button', { name: /^register$/i })).toBeEnabled();
    });

    const fieldCases: [string, string, RegExp][] = [
      ['name_required', 'full name', /please enter your name/i],
      ['name_invalid', 'full name', /cannot be used/i],
      ['name_too_long', 'full name', /too long/i],
      ['email_invalid', 'email', /does not look right/i],
    ];

    it.each(fieldCases)('%s is shown beside its field', async (code, field, message) => {
      post.mockRejectedValue(httpError(400, { code, error: 'raw english' }));
      const user = userEvent.setup();
      renderForm();

      await fill(user);
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      await waitFor(() => expect(screen.getByLabelText(new RegExp(field === 'email' ? '^email' : field, 'i'))).toHaveAttribute('aria-invalid', 'true'));
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.queryByText(/raw english/)).not.toBeInTheDocument();
    });

    it('says so when the server cannot be reached', async () => {
      post.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true }));
      const user = userEvent.setup();
      renderForm();

      await fill(user);
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    });

    it('asks the page to refresh when the workshop filled up meanwhile', async () => {
      post.mockRejectedValue(httpError(409, { code: 'workshop_full' }));
      const onChanged = vi.fn();
      const user = userEvent.setup();
      renderForm(workshop(), onChanged);

      await fill(user);
      await user.click(screen.getByRole('button', { name: /^register$/i }));
      await screen.findByRole('alert');

      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('does not refresh for a duplicate registration', async () => {
      post.mockRejectedValue(httpError(409, { code: 'already_registered' }));
      const onChanged = vi.fn();
      const user = userEvent.setup();
      renderForm(workshop(), onChanged);

      await fill(user);
      await user.click(screen.getByRole('button', { name: /^register$/i }));
      await screen.findByRole('alert');

      expect(onChanged).not.toHaveBeenCalled();
    });
  });

  describe('honeypot', () => {
    it('is hidden from people and assistive tech, never tabbable, and empty', () => {
      renderForm();
      const trap = document.querySelector<HTMLInputElement>('input[name="ref_code_x"]')!;

      expect(trap).toBeInTheDocument();
      expect(trap.value).toBe('');
      expect(trap).toHaveAttribute('tabindex', '-1');
      expect(trap).toHaveAttribute('autocomplete', 'off');
      expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('sends whatever a bot typed into it', async () => {
      post.mockResolvedValue({ data: { status: 'registered' } });
      const user = userEvent.setup();
      renderForm();

      await fill(user);
      document.querySelector<HTMLInputElement>('input[name="ref_code_x"]')!.value = 'http://spam.test';
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      await waitFor(() => expect(post).toHaveBeenCalled());
      expect(post.mock.calls[0][1].website).toBe('http://spam.test');
    });
  });

  describe('registration status', () => {
    it('does not highlight a comfortable count', () => {
      renderForm(workshop({ capacity: 100, registered: 40, spots_left: 60 }));
      expect(screen.getByText('60 spots left').className).not.toMatch(/bg-coral/);
    });

    it('shows the form and no spots hint when there is no limit', () => {
      renderForm();
      expect(screen.getByRole('heading', { name: /register for this workshop/i })).toBeInTheDocument();
      expect(screen.queryByText(/spots? left/i)).not.toBeInTheDocument();
      expect(screen.getByText(/only to organise this workshop/i)).toBeInTheDocument();
    });

    it('shows how many spots are left', () => {
      renderForm(workshop({ capacity: 100, registered: 40, spots_left: 60 }));
      expect(screen.getByText('60 spots left')).toBeInTheDocument();
    });

    it('uses the singular for the last spot', () => {
      renderForm(workshop({ capacity: 5, registered: 4, spots_left: 1 }));
      expect(screen.getByText('Only 1 spot left')).toBeInTheDocument();
    });

    it('highlights a low count', () => {
      renderForm(workshop({ capacity: 20, registered: 12, spots_left: 8 }));
      expect(screen.getByText('8 spots left').className).toMatch(/bg-coral/);
    });

    it('explains a full workshop and points to contact', () => {
      renderForm(workshop({ capacity: 5, registered: 5, spots_left: 0, registration_status: 'full' }));
      expect(screen.getByRole('heading', { name: /this workshop is full/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /contact us/i })).toHaveAttribute('href', '/#contact');
      expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    });

    it('explains closed registration', () => {
      renderForm(workshop({ registration_open: false, registration_status: 'closed' }));
      expect(screen.getByRole('heading', { name: /registration is closed/i })).toBeInTheDocument();
      expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    });

    it('renders nothing once the workshop has ended', () => {
      const { container } = renderForm(workshop({ registration_status: 'ended' }));
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('external registration link', () => {
    const url = 'https://eventbrite.example/git';

    it('is a secondary option next to the form', () => {
      renderForm(workshop({ registration_url: url }));
      const link = screen.getByRole('link', { name: /register on the organiser/i });
      expect(link).toHaveAttribute('href', url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('is absent when there is no URL', () => {
      renderForm();
      expect(screen.queryByRole('link', { name: /organiser/i })).not.toBeInTheDocument();
    });

    it('is still offered when the workshop is full or closed', () => {
      renderForm(workshop({ registration_url: url, registration_status: 'full', spots_left: 0, capacity: 1, registered: 1 }));
      expect(screen.getByRole('link', { name: /register on the organiser/i })).toHaveAttribute('href', url);
    });
  });

  describe('Arabic', () => {
    it('shows Arabic copy and right-aligns the left-to-right email', () => {
      useLanguageStore.setState({ locale: 'ar' });
      renderForm(workshop({ capacity: 20, registered: 18, spots_left: 2 }));

      expect(screen.getByRole('heading', { name: 'سجّل في هذه الورشة' })).toBeInTheDocument();
      expect(screen.getByText('بقي مقعدان فقط')).toBeInTheDocument();
      const email = screen.getByLabelText('البريد الإلكتروني');
      expect(email).toHaveAttribute('dir', 'ltr');
      expect(email.className).toMatch(/text-end/);
    });

    it('localizes a server error', async () => {
      useLanguageStore.setState({ locale: 'ar' });
      post.mockRejectedValue(httpError(409, { code: 'already_registered', error: 'raw english' }));
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('الاسم الكامل'), 'سارة');
      await user.type(screen.getByLabelText('البريد الإلكتروني'), 'sara@example.com');
      await user.click(screen.getByRole('button', { name: 'سجّل' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('مسجّل بالفعل');
    });
  });

  it('moves focus to the section when the page is opened with #register', () => {
    renderForm(workshop(), undefined, '/workshops/w1#register');
    expect(screen.getByRole('heading', { name: /register for this workshop/i })).toHaveFocus();
  });
});
