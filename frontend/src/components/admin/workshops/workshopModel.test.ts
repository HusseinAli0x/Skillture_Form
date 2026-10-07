import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTER,
  EMPTY_WORKSHOP_FORM,
  duplicateForm,
  filterWorkshops,
  formToPayload,
  hasAfterEventData,
  needsRecap,
  splitByPhase,
  validateWorkshopForm,
  workshopToForm,
  type Workshop,
} from './workshopModel';

const ws = (over: Partial<Workshop> = {}): Workshop => ({
  id: 'w1',
  title: { en: 'Intro to Git', ar: 'مقدمة في جيت' },
  description: { en: 'Branches and merges', ar: 'فروع ودمج' },
  image_path: null,
  event_date: '2999-01-01',
  event_time: null,
  ...over,
});

describe('validateWorkshopForm', () => {
  const valid = {
    ...EMPTY_WORKSHOP_FORM,
    title_en: 'T',
    title_ar: 'ع',
    description_en: 'D',
    description_ar: 'و',
    event_date: '2030-05-01',
  };

  it('accepts the minimum valid workshop', () => {
    expect(validateWorkshopForm(valid)).toEqual({});
  });

  it('requires both languages for title and description, and a date', () => {
    const errors = validateWorkshopForm({ ...valid, title_ar: ' ', description_en: '', event_date: '' });
    expect(Object.keys(errors).sort()).toEqual(['description', 'event_date', 'title']);
  });

  it('checks the registration link and attendee count', () => {
    expect(validateWorkshopForm({ ...valid, registration_url: 'javascript:alert(1)' }).registration_url).toBeTruthy();
    expect(validateWorkshopForm({ ...valid, registration_url: 'https://x.org/r' }).registration_url).toBeUndefined();
    expect(validateWorkshopForm({ ...valid, attendees: '-3' }).attendees).toBeTruthy();
    expect(validateWorkshopForm({ ...valid, attendees: '2.5' }).attendees).toBeTruthy();
    expect(validateWorkshopForm({ ...valid, attendees: '0' }).attendees).toBeUndefined();
  });
});

describe('formToPayload', () => {
  it('round-trips a workshop and trims text', () => {
    const w = ws({ track: 'career', attendees: 12, location: 'Hall B', gallery: ['/uploads/a.png'] });
    const payload = formToPayload({ ...workshopToForm(w), location: '  Hall B ' });
    expect(payload).toMatchObject({
      title: { en: 'Intro to Git', ar: 'مقدمة في جيت' },
      track: 'career',
      attendees: 12,
      location: 'Hall B',
      gallery: ['/uploads/a.png'],
      outcome: {},
      recap: {},
      extra_info: undefined,
      event_time: null,
    });
  });

  it('sends null for blank optionals so the API clears them', () => {
    const payload = formToPayload({ ...EMPTY_WORKSHOP_FORM });
    expect(payload.track).toBeNull();
    expect(payload.attendees).toBeNull();
    expect(payload.registration_url).toBeNull();
    expect(payload.image_path).toBeNull();
  });
});

describe('workshopToForm', () => {
  it('trims seconds off a time so the time input accepts it', () => {
    expect(workshopToForm(ws({ event_time: '14:30:00' })).event_time).toBe('14:30');
  });
});

describe('duplicateForm', () => {
  it('keeps the content but clears date, results and gallery', () => {
    const copy = duplicateForm(ws({ attendees: 40, gallery: ['/uploads/a.png'], recap: { en: 'It went well' } }));
    expect(copy.title_en).toBe('Intro to Git (copy)');
    expect(copy.event_date).toBe('');
    expect(copy.attendees).toBe('');
    expect(copy.recap_en).toBe('');
    expect(copy.gallery).toEqual([]);
  });
});

describe('filtering and grouping', () => {
  const list = [
    ws({ id: 'a', event_date: '2999-03-01', track: 'technical', speaker: 'Dr Salma' }),
    ws({ id: 'b', event_date: '2999-01-01', title: { en: 'CV Clinic', ar: 'عيادة' }, track: 'career' }),
    ws({ id: 'c', event_date: '2020-01-01', title: { en: 'Old talk', ar: 'قديم' }, location: 'Cairo' }),
    ws({ id: 'd', event_date: '2021-06-01', title: { en: 'Newer old talk', ar: 'أحدث' } }),
  ];

  it('filters by phase, track and text', () => {
    expect(filterWorkshops(list, { ...DEFAULT_FILTER, phase: 'past' }).map(w => w.id)).toEqual(['c', 'd']);
    expect(filterWorkshops(list, { ...DEFAULT_FILTER, track: 'career' }).map(w => w.id)).toEqual(['b']);
    expect(filterWorkshops(list, { ...DEFAULT_FILTER, query: 'salma' }).map(w => w.id)).toEqual(['a']);
    expect(filterWorkshops(list, { ...DEFAULT_FILTER, query: 'cairo' }).map(w => w.id)).toEqual(['c']);
    expect(filterWorkshops(list, { ...DEFAULT_FILTER, query: 'عيادة' }).map(w => w.id)).toEqual(['b']);
  });

  it('orders upcoming soonest first and past latest first', () => {
    const { upcoming, past } = splitByPhase(list);
    expect(upcoming.map(w => w.id)).toEqual(['b', 'a']);
    expect(past.map(w => w.id)).toEqual(['d', 'c']);
  });
});

describe('needsRecap / hasAfterEventData', () => {
  it('flags a past workshop with nothing recorded', () => {
    expect(needsRecap(ws({ event_date: '2020-01-01' }))).toBe(true);
    expect(needsRecap(ws({ event_date: '2020-01-01', attendees: 0 }))).toBe(false);
    expect(needsRecap(ws({ event_date: '2999-01-01' }))).toBe(false);
  });

  it('detects results in the form', () => {
    expect(hasAfterEventData(EMPTY_WORKSHOP_FORM)).toBe(false);
    expect(hasAfterEventData({ ...EMPTY_WORKSHOP_FORM, attendees: '5' })).toBe(true);
  });
});
