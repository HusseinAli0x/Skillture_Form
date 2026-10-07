/**
 * Game sound effects, synthesised with the Web Audio API so there are no audio
 * files to ship, license or load. Browsers only allow audio after a tap, so the
 * context is created lazily on the first call, which always follows one.
 *
 * Muting is remembered across games in localStorage.
 */
export type Sfx = 'join' | 'tick' | 'go' | 'start' | 'lock' | 'correct' | 'wrong' | 'streak' | 'whoosh' | 'reveal' | 'win';

const KEY = 'skillture-game-muted';

let ctx: AudioContext | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, vol: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Note frequencies, in Hz, for readable melodies. */
const N = { C4: 262, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, G5: 784, C6: 1047 };

const RECIPES: Record<Sfx, (c: AudioContext, t: number) => void> = {
  join: (c, t) => {
    tone(c, N.G4, t, 0.09, 'triangle', 0.18);
    tone(c, N.C5, t + 0.07, 0.13, 'triangle', 0.18);
  },
  tick: (c, t) => tone(c, 880, t, 0.05, 'square', 0.06),
  go: (c, t) => tone(c, N.C6, t, 0.25, 'triangle', 0.2),
  start: (c, t) => [N.C4, N.E4, N.G4, N.C5].forEach((f, i) => tone(c, f, t + i * 0.09, 0.2, 'triangle', 0.2)),
  lock: (c, t) => tone(c, 520, t, 0.08, 'sine', 0.2),
  correct: (c, t) => [N.C5, N.E5, N.G5].forEach((f, i) => tone(c, f, t + i * 0.08, 0.16, 'triangle', 0.22)),
  wrong: (c, t) => {
    tone(c, 220, t, 0.2, 'sawtooth', 0.12);
    tone(c, 165, t + 0.12, 0.28, 'sawtooth', 0.12);
  },
  streak: (c, t) => [N.E5, N.G5, N.C6, N.G5, N.C6].forEach((f, i) => tone(c, f, t + i * 0.06, 0.12, 'square', 0.1)),
  whoosh: (c, t) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.18);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  },
  reveal: (c, t) => [N.A4, N.D5].forEach((f, i) => tone(c, f, t + i * 0.1, 0.22, 'triangle', 0.18)),
  win: (c, t) =>
    [N.C5, N.C5, N.C5, N.G4, N.C5, N.E5, N.G5].forEach((f, i) => tone(c, f, t + i * 0.11, i === 6 ? 0.5 : 0.14, 'square', 0.12)),
};

export function play(name: Sfx): void {
  if (muted) return;
  const c = context();
  if (!c) return;
  RECIPES[name](c, c.currentTime + 0.01);
}

/** Phones only; harmless elsewhere. */
export function buzz(pattern: number | number[]): void {
  if (muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is a nicety; ignore platforms or settings that refuse it.
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    // Not persisted in private browsing; still applies for this session.
  }
  listeners.forEach(l => l());
}

export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A gentle looping arpeggio for the lobby. Returns a function that stops it. */
export function startLobbyMusic(): () => void {
  const c = context();
  if (!c) return () => undefined;
  const pattern = [N.C4, N.E4, N.G4, N.E4, N.A4, N.E4, N.G4, N.E4];
  let step = 0;
  const timer = window.setInterval(() => {
    if (muted) return;
    tone(c, pattern[step % pattern.length], c.currentTime + 0.01, 0.28, 'triangle', 0.045);
    step++;
  }, 320);
  return () => window.clearInterval(timer);
}
