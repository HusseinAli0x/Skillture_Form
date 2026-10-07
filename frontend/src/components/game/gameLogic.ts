import { optionLabel } from '../../lib/i18n';

/**
 * Pure helpers for the live game screens. Kept free of React so the rules
 * (option order, vote bars, rank movement, join addresses) are unit-tested.
 */

export interface AnswerOption {
  id: string;
  label: string;
}

const norm = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Options of a question in authoring order.
 *
 * The API returns them as a JSON object, and Postgres JSONB does not keep
 * insertion order — it sorts keys. The builder therefore writes ordered keys
 * (`opt_0`, `opt_1`, …) and this sorts them numerically. Older quizzes carry
 * random ids; for those a True/False pair is put True-first and everything
 * else keeps whatever order arrived.
 */
export function parseOptions(options: Record<string, unknown> | undefined | null): AnswerOption[] {
  const entries = Object.entries(options ?? {}).map(([id, opt], i) => ({
    id,
    label: optionLabel(opt as never, id),
    i,
  }));

  const num = (id: string) => {
    const m = /^opt_(\d+)$/.exec(id);
    return m ? Number(m[1]) : null;
  };
  if (entries.every(e => num(e.id) !== null)) {
    entries.sort((a, b) => (num(a.id) as number) - (num(b.id) as number));
  } else if (entries.length === 2 && entries.some(e => norm(e.label) === 'true') && entries.some(e => norm(e.label) === 'false')) {
    entries.sort((a, b) => (norm(a.label) === 'true' ? -1 : norm(b.label) === 'true' ? 1 : 0));
  }
  return entries.map(({ id, label }) => ({ id, label }));
}

/** The text of a question's correct answer (`value`, `text` or `en`). */
export function correctAnswerText(correct: Record<string, unknown> | undefined | null): string {
  if (!correct) return '';
  for (const k of ['value', 'text', 'en']) {
    const v = correct[k];
    if (v !== undefined && v !== null && String(v) !== '') return String(v);
  }
  return '';
}

export function sameAnswer(a: unknown, b: unknown): boolean {
  return norm(a) !== '' && norm(a) === norm(b);
}

export interface ResultBar {
  key: string;
  label: string;
  count: number;
  /** Share of everyone who answered, 0-100. */
  percent: number;
  /** Bar length relative to the most-voted answer, 0-100, so the leader fills the track. */
  width: number;
  isCorrect: boolean;
}

/**
 * One bar per answer option, plus any votes that match no option (short
 * answers, or an option edited mid-game) so the totals still add up.
 */
export function resultBars(
  options: AnswerOption[],
  distribution: Record<string, number> | undefined,
  correct: Record<string, unknown> | undefined,
  answered: number
): ResultBar[] {
  const dist = new Map<string, number>();
  for (const [k, v] of Object.entries(distribution ?? {})) {
    const key = norm(k);
    dist.set(key, (dist.get(key) ?? 0) + v);
  }
  const correctText = correctAnswerText(correct);
  const claimed = new Set<string>();

  const rows: Omit<ResultBar, 'percent' | 'width'>[] = options.map(o => {
    const key = norm(o.label);
    claimed.add(key);
    return { key: o.id, label: o.label, count: dist.get(key) ?? 0, isCorrect: sameAnswer(o.label, correctText) };
  });

  const extras = [...dist.entries()]
    .filter(([k]) => !claimed.has(k) && k !== '')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, count]) => ({ key: `x:${k}`, label: k, count, isCorrect: sameAnswer(k, correctText) }));

  // A short question has no options: show its right answer even if nobody typed it.
  if (options.length === 0 && correctText && !extras.some(e => e.isCorrect)) {
    extras.unshift({ key: 'x:correct', label: correctText, count: 0, isCorrect: true });
  }

  const all = [...rows, ...extras];
  const max = Math.max(1, ...all.map(r => r.count));
  const total = Math.max(1, answered);
  return all.map(r => ({
    ...r,
    percent: Math.round((r.count / total) * 100),
    width: Math.round((r.count / max) * 100),
  }));
}

/** Positive = moved up this many places since `prev`, negative = down, 0/absent = same or new. */
export function rankChanges(prev: { id: string }[], next: { id: string }[]): Record<string, number> {
  const before = new Map(prev.map((p, i) => [p.id, i]));
  const out: Record<string, number> = {};
  next.forEach((p, i) => {
    const was = before.get(p.id);
    if (was !== undefined) out[p.id] = was - i;
  });
  return out;
}

/** 6-digit PIN grouped for reading aloud: "123 456". */
export function formatPin(pin: string): string {
  const d = pin.replace(/\D/g, '');
  return d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}` : d;
}

export const PIN_LENGTH = 6;

/** Digits only, at most PIN_LENGTH — what a paste or a keypad press may leave in the field. */
export function sanitizePin(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

export const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

export interface JoinAddress {
  /** `http://192.168.0.98:5180` */
  origin: string;
  label: string;
  lan: boolean;
}

const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || h.endsWith('.localhost');

/**
 * Addresses a phone could use to reach this app.
 *
 * `localhost` only works on the host's own computer, so when the host opened
 * the app that way the machine's LAN addresses (from /server-info) are offered
 * first and `localhost` last. When the app is already on a real hostname or
 * LAN IP, that address stays first.
 */
export function joinAddresses(
  lanIps: string[],
  loc: { protocol: string; hostname: string; port: string; origin: string }
): JoinAddress[] {
  const port = loc.port ? `:${loc.port}` : '';
  const lan: JoinAddress[] = lanIps.map(ip => ({ origin: `${loc.protocol}//${ip}${port}`, label: ip, lan: true }));
  const here: JoinAddress = { origin: loc.origin, label: loc.hostname, lan: false };
  if (!isLocalHost(loc.hostname)) {
    return [here, ...lan.filter(a => a.origin !== loc.origin)];
  }
  return [...lan, here];
}

export const playUrl = (origin: string, pin: string) => `${origin}/play?pin=${pin}`;

export interface Feedback {
  tone: 'correct' | 'wrong' | 'missed';
  headline: string;
  detail: string;
}

/** What the phone says right after an answer lands. */
export function answerFeedback(r: {
  correct: boolean;
  points: number;
  streak?: number;
  streakBonus?: number;
}): Feedback {
  if (!r.correct) {
    return { tone: 'wrong', headline: 'Not this time', detail: 'Streak reset. The next one is yours.' };
  }
  const streak = r.streak ?? 0;
  const bonus = r.streakBonus ?? 0;
  return {
    tone: 'correct',
    headline: streak >= 3 ? `${streak} in a row` : 'Correct',
    detail: bonus > 0 ? `Includes +${bonus} streak bonus` : streak === 2 ? 'Two right in a row. Keep going.' : 'Nicely done.',
  };
}

/** Seconds left from a start timestamp; never negative. Null means untimed. */
export function secondsLeft(limitSec: number, startedAt: number, now: number): number | null {
  if (!(limitSec > 0)) return null;
  return Math.max(0, Math.ceil(limitSec - (now - startedAt) / 1000));
}

/**
 * Answer identity = colour AND shape, so it survives colour-blindness and a
 * dim projector. The same five are used on the host screen and on phones,
 * which is how a player maps "the turquoise triangle" across the two.
 * Order and colours mirror lib/avatars.ts.
 */
export const ANSWER_STYLES = [
  { bg: '#00cccc', shape: 'triangle' },
  { bg: '#fbbf24', shape: 'circle' },
  { bg: '#2fd58a', shape: 'square' },
  { bg: '#5aa2ff', shape: 'diamond' },
  { bg: '#f1f8f8', shape: 'star' },
] as const;

export const answerStyle = (i: number) => ANSWER_STYLES[i % ANSWER_STYLES.length];

export type ShapeName = (typeof ANSWER_STYLES)[number]['shape'];
