/**
 * The four answer colours and shapes. A player identifies an answer by its
 * shape and colour on the host screen and again on their own phone, and the
 * shape carries the meaning for colour-blind players, so these are fixed game
 * constants rather than theme tokens.
 */
export type AnswerShapeName = 'triangle' | 'diamond' | 'circle' | 'square';

export interface AnswerStyle {
  shape: AnswerShapeName;
  /** Tailwind classes for the tile background and its pressed/hover shade. */
  bg: string;
  /** Text colour that passes contrast on that background. */
  text: string;
  /** Flat hex, for charts and SVG where a class cannot be used. */
  hex: string;
  label: string;
}

export const ANSWER_STYLES: AnswerStyle[] = [
  { shape: 'triangle', bg: 'bg-coral hover:brightness-110', text: 'text-white', hex: '#f25c54', label: 'Red triangle' },
  { shape: 'diamond', bg: 'bg-azure hover:brightness-110', text: 'text-white', hex: '#2e86ff', label: 'Blue diamond' },
  { shape: 'circle', bg: 'bg-mark hover:brightness-105', text: 'text-ink', hex: '#ffd84d', label: 'Yellow circle' },
  { shape: 'square', bg: 'bg-leaf hover:brightness-110', text: 'text-ink', hex: '#2fbf71', label: 'Green square' },
];

export function answerStyle(index: number): AnswerStyle {
  return ANSWER_STYLES[((index % ANSWER_STYLES.length) + ANSWER_STYLES.length) % ANSWER_STYLES.length];
}
