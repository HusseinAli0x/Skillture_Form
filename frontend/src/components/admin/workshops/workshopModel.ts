import { isPastDate } from '../../../lib/formatDate';
import type { FieldErrors } from '../serverErrors';

export type Track = 'technical' | 'career' | 'industry' | 'business';

export const TRACKS: { value: Track; label: string; blurb: string }[] = [
  { value: 'technical', label: 'Technical', blurb: 'Coding, tools, engineering practice' },
  { value: 'career', label: 'Career', blurb: 'CVs, interviews, getting hired' },
  { value: 'industry', label: 'Industry', blurb: 'Talks and visits with practitioners' },
  { value: 'business', label: 'Business', blurb: 'Product, startups, management' },
];

export const MAX_GALLERY = 12;

type Bilingual = { en?: string; ar?: string } | null | undefined;

/** A workshop as returned by GET /api/v1/admin/workshops. */
export interface Workshop {
  id: string;
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  extra_info?: Bilingual;
  image_path: string | null;
  event_date: string;
  event_time: string | null;
  track?: Track | null;
  location?: string | null;
  speaker?: string | null;
  attendees?: number | null;
  outcome?: Bilingual;
  recap?: Bilingual;
  gallery?: string[];
  registration_url?: string | null;
  /** On-site sign-ups switched on (the API treats a missing value as on). */
  registration_open?: boolean;
  /** Seat limit; null or absent means unlimited. */
  capacity?: number | null;
  registered?: number;
  spots_left?: number | null;
  registration_status?: 'open' | 'full' | 'closed' | 'ended';
}

/** Everything the form edits, as strings so inputs stay controlled. */
export interface WorkshopForm {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  extra_info_en: string;
  extra_info_ar: string;
  event_date: string;
  event_time: string;
  image_path: string;
  track: Track | '';
  location: string;
  speaker: string;
  attendees: string;
  outcome_en: string;
  outcome_ar: string;
  recap_en: string;
  recap_ar: string;
  registration_url: string;
  registration_open: boolean;
  /** Seat limit as typed; empty means unlimited. */
  capacity: string;
  gallery: string[];
}

export const EMPTY_WORKSHOP_FORM: WorkshopForm = {
  title_en: '',
  title_ar: '',
  description_en: '',
  description_ar: '',
  extra_info_en: '',
  extra_info_ar: '',
  event_date: '',
  event_time: '',
  image_path: '',
  track: '',
  location: '',
  speaker: '',
  attendees: '',
  outcome_en: '',
  outcome_ar: '',
  recap_en: '',
  recap_ar: '',
  registration_url: '',
  registration_open: true,
  capacity: '',
  gallery: [],
};

export const workshopToForm = (w: Workshop): WorkshopForm => ({
  title_en: w.title.en || '',
  title_ar: w.title.ar || '',
  description_en: w.description.en || '',
  description_ar: w.description.ar || '',
  extra_info_en: w.extra_info?.en || '',
  extra_info_ar: w.extra_info?.ar || '',
  event_date: w.event_date,
  event_time: w.event_time ? w.event_time.slice(0, 5) : '',
  image_path: w.image_path || '',
  track: w.track || '',
  location: w.location || '',
  speaker: w.speaker || '',
  attendees: w.attendees == null ? '' : String(w.attendees),
  outcome_en: w.outcome?.en || '',
  outcome_ar: w.outcome?.ar || '',
  recap_en: w.recap?.en || '',
  recap_ar: w.recap?.ar || '',
  registration_url: w.registration_url || '',
  registration_open: w.registration_open ?? true,
  capacity: w.capacity == null ? '' : String(w.capacity),
  gallery: w.gallery || [],
});

/** A starting point for "Duplicate": everything except the date, results and gallery. */
export const duplicateForm = (w: Workshop): WorkshopForm => ({
  ...workshopToForm(w),
  title_en: `${w.title.en} (copy)`.trim(),
  title_ar: w.title.ar,
  event_date: '',
  event_time: w.event_time ? w.event_time.slice(0, 5) : '',
  attendees: '',
  outcome_en: '',
  outcome_ar: '',
  recap_en: '',
  recap_ar: '',
  gallery: [],
});

// A bilingual map is sent only when at least one language has text; the
// backend stores an absent/empty map as NULL.
const bilingual = (en: string, ar: string) => (en.trim() || ar.trim() ? { en: en.trim(), ar: ar.trim() } : {});

export const MAX_CAPACITY = 100000;

/** "12 / 40 registered", or "12 registered" with no seat limit: the compact form for list rows. */
export const registeredCompact = (registered: number, capacity?: number | null): string =>
  capacity ? `${registered} / ${capacity} registered` : `${registered} registered`;

/** "12 of 40 seats taken", or "12 registered" with no seat limit. */
export const registeredLabel = (registered: number, capacity?: number | null): string =>
  capacity ? `${registered} of ${capacity} seats taken` : `${registered} registered`;

export const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

/** Body for POST/PUT /api/v1/admin/workshops. */
export function formToPayload(form: WorkshopForm) {
  return {
    title: { en: form.title_en.trim(), ar: form.title_ar.trim() },
    description: { en: form.description_en.trim(), ar: form.description_ar.trim() },
    extra_info:
      form.extra_info_en.trim() || form.extra_info_ar.trim()
        ? { en: form.extra_info_en.trim(), ar: form.extra_info_ar.trim() }
        : undefined,
    event_date: form.event_date,
    event_time: form.event_time || null,
    image_path: form.image_path || null,
    track: form.track || null,
    location: form.location.trim() || null,
    speaker: form.speaker.trim() || null,
    attendees: form.attendees.trim() ? Number(form.attendees) : null,
    outcome: bilingual(form.outcome_en, form.outcome_ar),
    recap: bilingual(form.recap_en, form.recap_ar),
    gallery: form.gallery,
    registration_url: form.registration_url.trim() || null,
    registration_open: form.registration_open,
    capacity: form.capacity.trim() ? Number(form.capacity) : null,
  };
}

/** Which form key each word in a server validation message belongs to. */
export const WORKSHOP_SERVER_FIELDS: Record<string, string> = {
  title: 'title',
  description: 'description',
  extra_info: 'extra_info',
  event_date: 'event_date',
  event_time: 'event_time',
  track: 'track',
  location: 'location',
  speaker: 'speaker',
  attendees: 'attendees',
  outcome: 'outcome',
  recap: 'recap',
  gallery: 'gallery',
  registration_url: 'registration_url',
  capacity: 'capacity',
  image_path: 'image_path',
};

/** Same rules the API applies, so most mistakes are caught before a request. */
export function validateWorkshopForm(form: WorkshopForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.title_en.trim() || !form.title_ar.trim()) errors.title = 'Add a title in both English and Arabic.';
  if (!form.description_en.trim() || !form.description_ar.trim()) {
    errors.description = 'Add a description in both English and Arabic.';
  }
  if (!form.event_date) errors.event_date = 'Pick the date of the event.';
  if (form.registration_url.trim() && !isHttpUrl(form.registration_url.trim())) {
    errors.registration_url = 'The link must start with http:// or https://';
  }
  const att = form.attendees.trim();
  if (att && !(Number.isInteger(Number(att)) && Number(att) >= 0)) {
    errors.attendees = 'Use a whole number, 0 or more.';
  }
  const cap = form.capacity.trim();
  if (cap && !(Number.isInteger(Number(cap)) && Number(cap) >= 1 && Number(cap) <= MAX_CAPACITY)) {
    errors.capacity = `Use a whole number from 1 to ${MAX_CAPACITY.toLocaleString('en-US')}, or leave it empty for no limit.`;
  }
  if (form.gallery.length > MAX_GALLERY) errors.gallery = `A gallery holds at most ${MAX_GALLERY} photos.`;
  return errors;
}

export const hasAfterEventData = (form: WorkshopForm): boolean =>
  Boolean(
    form.attendees.trim() ||
      form.outcome_en.trim() ||
      form.outcome_ar.trim() ||
      form.recap_en.trim() ||
      form.recap_ar.trim() ||
      form.gallery.length > 0
  );

export type Phase = 'upcoming' | 'past';

export const phaseOf = (w: Pick<Workshop, 'event_date'>): Phase => (isPastDate(w.event_date) ? 'past' : 'upcoming');

/** A finished workshop with no results recorded yet: the public Our Work page shows it bare. */
export const needsRecap = (w: Workshop): boolean =>
  phaseOf(w) === 'past' && w.attendees == null && !w.outcome?.en && !w.recap?.en && (w.gallery?.length ?? 0) === 0;

export interface WorkshopFilter {
  query: string;
  phase: Phase | 'all';
  track: Track | 'all';
}

export const DEFAULT_FILTER: WorkshopFilter = { query: '', phase: 'all', track: 'all' };

/** Search matches title (either language), speaker, location. */
export function filterWorkshops(list: readonly Workshop[], f: WorkshopFilter): Workshop[] {
  const q = f.query.trim().toLowerCase();
  return list.filter(w => {
    if (f.phase !== 'all' && phaseOf(w) !== f.phase) return false;
    if (f.track !== 'all' && w.track !== f.track) return false;
    if (!q) return true;
    return [w.title.en, w.title.ar, w.speaker, w.location, w.description.en]
      .filter((s): s is string => Boolean(s))
      .some(s => s.toLowerCase().includes(q));
  });
}

/** Upcoming soonest-first, past latest-first: what an editor reads top to bottom. */
export function splitByPhase(list: readonly Workshop[]): { upcoming: Workshop[]; past: Workshop[] } {
  const key = (w: Workshop) => `${w.event_date} ${w.event_time ?? ''}`;
  const upcoming = list.filter(w => phaseOf(w) === 'upcoming').sort((a, b) => key(a).localeCompare(key(b)));
  const past = list.filter(w => phaseOf(w) === 'past').sort((a, b) => key(b).localeCompare(key(a)));
  return { upcoming, past };
}
