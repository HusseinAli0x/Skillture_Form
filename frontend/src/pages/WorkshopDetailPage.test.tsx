import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicWorkshop } from '../api/publicTypes';
import { useLanguageStore } from '../context/LanguageStore';
import { useSiteStore } from '../context/SiteStore';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../api/client', () => ({ default: { get, post } }));

const { default: WorkshopDetailPage } = await import('./WorkshopDetailPage');

const workshop = (over: Partial<PublicWorkshop> = {}): PublicWorkshop => ({
  id: 'w1',
  title: { en: 'Intro to Git', ar: 'مقدمة في جيت' },
  description: { en: 'Branches and merges', ar: 'فروع ودمج' },
  image_path: null,
  event_date: '2999-05-20',
  event_time: null,
  track: null,
  location: null,
  speaker: null,
  attendees: null,
  gallery: [],
  registration_url: null,
  registration_open: true,
  capacity: 10,
  registered: 4,
  spots_left: 6,
  registration_status: 'open',
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/workshops/w1']}>
      <Routes>
        <Route path="/workshops/:id" element={<WorkshopDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('WorkshopDetailPage registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    useLanguageStore.setState({ locale: 'en' });
    useSiteStore.setState({ status: 'ready' });
  });

  it('shows the form for an upcoming workshop and refreshes the seat count after registering', async () => {
    get.mockResolvedValueOnce({ data: workshop() });
    post.mockResolvedValue({ data: { status: 'registered' } });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('6 spots left')).toBeInTheDocument();

    get.mockResolvedValueOnce({ data: workshop({ registered: 5, spots_left: 5 }) });
    await user.type(screen.getByLabelText(/full name/i), 'Sam Ali');
    await user.type(screen.getByLabelText(/^email/i), 'sam@example.com');
    await user.click(screen.getByRole('button', { name: /^register$/i }));

    expect(await screen.findByText(/you are registered/i)).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    // The page was re-read in place: the confirmation is still there.
    expect(screen.getByText(/you are registered/i)).toBeInTheDocument();
  });

  it('shows no registration section once the date has passed', async () => {
    get.mockResolvedValueOnce({ data: workshop({ event_date: '2020-01-01', registration_status: 'ended' }) });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Intro to Git' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /register for this workshop/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Registration is closed')).not.toBeInTheDocument();
  });

  it('shows the full panel when the workshop is full', async () => {
    get.mockResolvedValueOnce({ data: workshop({ registered: 10, spots_left: 0, registration_status: 'full' }) });
    renderPage();

    expect(await screen.findByRole('heading', { name: /this workshop is full/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
  });
});
