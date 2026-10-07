import { newId } from '../../../lib/id';

/** GET /api/v1/homepage */
export interface HomepageContent {
  hero_kicker: string;
  hero_title: string;
  hero_subtitle: string;
  cta_primary_text: string;
  cta_secondary_text: string;
  about_kicker: string;
  about_title: string;
  about_body1: string;
  about_body2: string;
  about_facts: { id?: string; value: string; label: string }[];
  offer_kicker: string;
  offer_title: string;
  offer_subtitle: string;
  offer_pillars: { id?: string; num: string; title: string; description: string; points: string[] }[];
}

/** The twelve single-value texts, saved together by PUT /api/v1/homepage. */
export interface TextForm {
  hero_kicker: string;
  hero_title: string;
  hero_subtitle: string;
  cta_primary_text: string;
  cta_secondary_text: string;
  about_kicker: string;
  about_title: string;
  about_body1: string;
  about_body2: string;
  offer_kicker: string;
  offer_title: string;
  offer_subtitle: string;
}

export const EMPTY_TEXT: TextForm = {
  hero_kicker: '',
  hero_title: '',
  hero_subtitle: '',
  cta_primary_text: '',
  cta_secondary_text: '',
  about_kicker: '',
  about_title: '',
  about_body1: '',
  about_body2: '',
  offer_kicker: '',
  offer_title: '',
  offer_subtitle: '',
};

export interface Fact {
  key: string;
  value: string;
  label: string;
}

export interface Pillar {
  /** Client-only, so React keeps a card's identity while it is reordered. */
  key: string;
  num: string;
  title: string;
  description: string;
  points: string[];
}

export const POINTS_PER_PILLAR = 3;
export const MIN_PILLARS = 1;
export const MAX_PILLARS = 8;
export const FACT_SLOTS = 3;

export const newFact = (value = '', label = ''): Fact => ({ key: newId(), value, label });
export const newPillar = (): Pillar => ({
  key: newId(),
  num: '',
  title: '',
  description: '',
  points: Array<string>(POINTS_PER_PILLAR).fill(''),
});

export interface HomepageState {
  text: TextForm;
  facts: Fact[];
  pillars: Pillar[];
}

export function contentToState(d: Partial<HomepageContent>): HomepageState {
  const text = { ...EMPTY_TEXT };
  for (const k of Object.keys(EMPTY_TEXT) as (keyof TextForm)[]) text[k] = d[k] ?? '';

  const facts = (d.about_facts ?? []).map(f => newFact(f.value, f.label));
  while (facts.length < FACT_SLOTS) facts.push(newFact());

  const pillars = (d.offer_pillars ?? []).map(p => ({
    key: newId(),
    num: p.num ?? '',
    title: p.title ?? '',
    description: p.description ?? '',
    // Pad so the fixed bullet inputs always have something to bind to.
    points: Array.from({ length: POINTS_PER_PILLAR }, (_, i) => p.points?.[i] ?? ''),
  }));
  if (pillars.length === 0) pillars.push(newPillar());

  return { text, facts, pillars };
}

/** The API requires `num`; fill a blank with the card's position ("01", "02", ...). */
export const pillarNum = (p: Pillar, index: number): string => p.num.trim() || String(index + 1).padStart(2, '0');

export const factsPayload = (facts: readonly Fact[]) => facts.map(f => ({ value: f.value.trim(), label: f.label.trim() }));

export const pillarsPayload = (pillars: readonly Pillar[]) =>
  pillars.map((p, i) => ({
    num: pillarNum(p, i),
    title: p.title.trim(),
    description: p.description.trim(),
    points: p.points.map(pt => pt.trim()).filter(Boolean),
  }));

/** Compare by what would be sent, so padding and client keys never read as an edit. */
export const sameFacts = (a: readonly Fact[], b: readonly Fact[]) =>
  JSON.stringify(factsPayload(a)) === JSON.stringify(factsPayload(b));
export const samePillars = (a: readonly Pillar[], b: readonly Pillar[]) =>
  JSON.stringify(pillarsPayload(a)) === JSON.stringify(pillarsPayload(b));
export const sameText = (a: TextForm, b: TextForm) => JSON.stringify(a) === JSON.stringify(b);

/** Index -> message, for the slot that is incomplete. */
export type RowErrors = Record<number, string>;

export function factErrors(facts: readonly Fact[]): RowErrors {
  const errors: RowErrors = {};
  facts.forEach((f, i) => {
    if (!f.value.trim() || !f.label.trim()) errors[i] = 'Give this tile both a value and a label.';
  });
  return errors;
}

export function pillarErrors(pillars: readonly Pillar[]): RowErrors {
  const errors: RowErrors = {};
  pillars.forEach((p, i) => {
    if (!p.title.trim() || !p.description.trim()) errors[i] = 'Give this track both a title and a description.';
  });
  return errors;
}

/** Texts shown on the live homepage, in the order they appear. Used for the preview. */
export const TRACK_NAMES = ['technical', 'career', 'industry', 'business'];
export const matchesTrackName = (title: string) => TRACK_NAMES.includes(title.trim().toLowerCase());
