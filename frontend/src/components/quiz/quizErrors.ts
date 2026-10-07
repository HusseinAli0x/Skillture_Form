import axios from 'axios';
import { apiErrorMessage } from '../../lib/apiError';
import { QUIZ_LIMITS } from './quizMode';
import { fill, type QuizText } from './quizText';

/** What the user was doing, since the same status code means different things for different calls. */
export type QuizErrorContext = 'create' | 'save' | 'other';

/** Seconds to wait, from the body's `retry_after_seconds` or the Retry-After header. */
function retryAfterSeconds(err: unknown): number {
  if (!axios.isAxiosError(err)) return 0;
  const body = err.response?.data as { retry_after_seconds?: unknown } | undefined;
  if (typeof body?.retry_after_seconds === 'number') return body.retry_after_seconds;
  const header = Number(err.response?.headers?.['retry-after']);
  return Number.isFinite(header) ? header : 0;
}

/**
 * A plain-language message for a failed quiz request.
 *
 * The limits that visitors can run into (too many games, too many requests, a
 * game that is too big) are explained in the page's own language rather than
 * with the server's English text. Anything else keeps the server's message
 * when it sent one, and `fallback` when it did not.
 */
export function quizErrorMessage(err: unknown, text: QuizText, fallback: string, context: QuizErrorContext = 'other'): string {
  if (!axios.isAxiosError(err)) return fallback;
  const status = err.response?.status;
  if (status === undefined) return text.errors.network;

  if (status === 429) {
    return text.errors.rateLimited(Math.max(1, Math.ceil(retryAfterSeconds(err) / 60)));
  }
  if (status === 409 && context === 'create') {
    return fill(text.errors.quizLimit, { max: QUIZ_LIMITS.quizzes });
  }
  if (status === 413) return text.errors.tooLong;
  if (status === 404) return text.errors.notFound;
  if (status >= 500) return fallback;

  const server = apiErrorMessage(err, '');
  if (status === 400 && context === 'save' && /\b100\b|too many questions/i.test(server)) {
    return fill(text.errors.questionLimit, { max: QUIZ_LIMITS.questions });
  }
  return server || fallback;
}
