import type { QuizQuestionType } from '../../api/types';
import { newId } from '../../lib/id';

/**
 * A quiz question while it is being edited. Kept apart from QuestionEditor so
 * that file only exports a component — a module mixing components and
 * constants defeats React Fast Refresh, which then reloads the whole page and
 * discards whatever the user had typed.
 */
export interface OptionState {
  id: string;
  value: string;
}

export interface QuestionState {
  id: string;
  question: string;
  type: QuizQuestionType;
  options: OptionState[];
  /** For `short`, this holds the expected answer text rather than an option id. */
  correctOptionId: string;
  timeLimit: number;
  points: number;
  isNew?: boolean;
}

/** Kahoot-style grids look wrong past four or five answers. */
export const MAX_OPTIONS = 5;

export const QUESTION_TYPE_LABELS: Record<QuizQuestionType, string> = {
  mcq: 'Multiple Choice',
  tf: 'True / False',
  short: 'Short Answer',
};

export const trueFalseOptions = (): OptionState[] => [
  { id: newId(), value: 'True' },
  { id: newId(), value: 'False' },
];

export const emptyQuestion = (): QuestionState => ({
  id: newId(),
  question: '',
  type: 'mcq',
  options: [
    { id: newId(), value: 'Option A' },
    { id: newId(), value: 'Option B' },
  ],
  correctOptionId: '',
  timeLimit: 15,
  points: 1000,
  isNew: true,
});
