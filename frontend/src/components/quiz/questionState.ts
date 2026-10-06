import type { QuizQuestion, QuizQuestionType } from '../../api/types';
import { localized, toLocalized } from '../../lib/i18n';
import { newId } from '../../lib/id';
import { correctAnswerText, parseOptions } from '../game/gameLogic';

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

/** A copy that saves as a new question: fresh ids, the right answer kept pointing at its copy. */
export function duplicateQuestion(q: QuestionState): QuestionState {
  const options = q.options.map(o => ({ id: newId(), value: o.value }));
  const correctIndex = q.options.findIndex(o => o.id === q.correctOptionId);
  return {
    ...q,
    id: newId(),
    options,
    correctOptionId: q.type === 'short' ? q.correctOptionId : (options[correctIndex]?.id ?? ''),
    isNew: true,
  };
}

/** Which part of the editor an issue belongs to, so the message can sit next to it. */
export type IssueField = 'text' | 'options' | 'answer' | 'time' | 'points';

export interface QuestionIssue {
  field: IssueField;
  message: string;
}

/** Everything that would make the server reject or players puzzle over this question. */
export function validateQuestion(q: QuestionState): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  if (!q.question.trim()) issues.push({ field: 'text', message: 'Write the question players will see.' });

  if (q.type === 'short') {
    if (!q.correctOptionId.trim()) issues.push({ field: 'answer', message: 'Type the answer you expect.' });
  } else {
    if (q.type === 'mcq') {
      const filled = q.options.map(o => o.value.trim());
      if (filled.some(v => !v)) {
        issues.push({ field: 'options', message: 'Fill in or remove the empty answers.' });
      } else if (new Set(filled.map(v => v.toLowerCase())).size !== filled.length) {
        issues.push({ field: 'options', message: 'Two answers are the same. Players could not tell them apart.' });
      }
    }
    if (!q.options.some(o => o.id === q.correctOptionId)) {
      issues.push({
        field: 'answer',
        message: q.type === 'tf' ? 'Choose True or False as the right answer.' : 'Mark which answer is correct.',
      });
    }
  }

  if (!(q.timeLimit >= 1)) issues.push({ field: 'time', message: 'Give players at least 1 second.' });
  if (!(q.points >= 1)) issues.push({ field: 'points', message: 'A question needs at least 1 point.' });
  return issues;
}

/**
 * The API payload for one question.
 *
 * Option keys are `opt_0`, `opt_1`, … on purpose: the API stores them as JSON,
 * which does not keep insertion order, so the key is what keeps A, B, C, D in
 * the order they were written (see parseOptions). Using the editor's random
 * ids shuffled the answers on every reload and on the players' screens.
 */
export function serializeQuestion(q: QuestionState) {
  const correctValue =
    q.type === 'short' ? q.correctOptionId.trim() : (q.options.find(o => o.id === q.correctOptionId)?.value.trim() ?? '');

  const options: Record<string, { value: string }> = {};
  if (q.type !== 'short') {
    q.options.forEach((o, i) => {
      options[`opt_${i}`] = { value: o.value.trim() };
    });
  }

  return {
    // A new question has a client-generated id that means nothing to the
    // server; omitting it is what marks the question as an insert.
    id: q.isNew ? undefined : q.id,
    question: toLocalized(q.question.trim()),
    type: q.type,
    time_limit_sec: q.timeLimit,
    points: q.points,
    options,
    correct_answer: { value: correctValue },
  };
}

/** Rebuilds the editor state from a stored question. */
export function readQuestion(q: QuizQuestion): QuestionState {
  const answer = correctAnswerText(q.correct_answer);
  const options = parseOptions(q.options).map(o => ({ id: o.id, value: o.label }));
  return {
    id: q.id,
    question: localized(q.question),
    type: q.type,
    options: options.length > 0 ? options : trueFalseOptions(),
    correctOptionId: q.type === 'short' ? answer : (options.find(o => o.value === answer)?.id ?? ''),
    timeLimit: q.time_limit_sec || 15,
    points: q.points || 1000,
    isNew: false,
  };
}

/** Stable string of everything the author can change, to tell "unsaved" from "saved". */
export function quizSnapshot(title: string, description: string, questions: QuestionState[]): string {
  return JSON.stringify([
    title,
    description,
    questions.map(q => [q.id, q.question, q.type, q.options.map(o => o.value), q.correctOptionId, q.timeLimit, q.points]),
  ]);
}

export interface QuizSummary {
  count: number;
  points: number;
  /** Longest the game can run on the question timers alone. */
  seconds: number;
}

export function summarizeQuiz(questions: QuestionState[]): QuizSummary {
  return {
    count: questions.length,
    points: questions.reduce((n, q) => n + (q.points || 0), 0),
    seconds: questions.reduce((n, q) => n + (q.timeLimit || 0), 0),
  };
}

/** "3 min" / "45 sec". */
export function formatDuration(seconds: number): string {
  if (seconds < 90) return `${seconds} sec`;
  return `${Math.round(seconds / 60)} min`;
}
