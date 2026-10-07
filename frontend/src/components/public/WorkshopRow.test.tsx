import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PublicWorkshop } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';
import { WorkshopRows } from './WorkshopRow';

const workshop = (over: Partial<PublicWorkshop> = {}): PublicWorkshop => ({
  id: 'w1',
  title: { en: 'Intro to Git', ar: 'مقدمة في جيت' },
  description: { en: 'Branches', ar: 'فروع' },
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
  capacity: null,
  registered: 0,
  spots_left: null,
  registration_status: 'open',
  ...over,
});

const renderRows = (w: PublicWorkshop, upcoming = true) =>
  render(
    <MemoryRouter>
      <WorkshopRows workshops={[w]} upcoming={upcoming} />
    </MemoryRouter>
  );

describe('WorkshopRow', () => {
  beforeEach(() => useLanguageStore.setState({ locale: 'en' }));

  it('links the title to the workshop and offers Register when open', () => {
    renderRows(workshop());
    expect(screen.getByRole('link', { name: 'Intro to Git' })).toHaveAttribute('href', '/workshops/w1');
    expect(screen.getByRole('link', { name: /register now/i })).toHaveAttribute('href', '/workshops/w1#register');
  });

  it('offers Register even with an external link, since the page shows both', () => {
    renderRows(workshop({ registration_url: 'https://x.example/r' }));
    expect(screen.getByRole('link', { name: /register now/i })).toHaveAttribute('href', '/workshops/w1#register');
  });

  it('shows a Full badge instead of a link when the workshop is full', () => {
    renderRows(workshop({ registration_status: 'full', capacity: 5, registered: 5, spots_left: 0 }));
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /register/i })).not.toBeInTheDocument();
  });

  it('shows nothing extra when registration is closed', () => {
    renderRows(workshop({ registration_open: false, registration_status: 'closed' }));
    expect(screen.queryByRole('link', { name: /register/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Full')).not.toBeInTheDocument();
  });

  it('does not offer Register on a past workshop', () => {
    renderRows(workshop({ registration_status: 'ended', attendees: 30 }), false);
    expect(screen.queryByRole('link', { name: /register/i })).not.toBeInTheDocument();
  });

  it('uses Arabic copy', () => {
    useLanguageStore.setState({ locale: 'ar' });
    renderRows(workshop());
    expect(screen.getByRole('link', { name: 'سجّل الآن' })).toHaveAttribute('href', '/workshops/w1#register');
  });
});
