import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { quizErrorMessage } from './quizErrors';
import { ADMIN_QUIZ_TEXT } from './quizText';
import { hostAr } from '../../lib/hostSiteStrings';

const failure = (status?: number, data: unknown = {}, headers: Record<string, string> = {}) =>
  new AxiosError(
    'failed',
    'ERR',
    undefined,
    undefined,
    status === undefined
      ? undefined
      : ({ status, statusText: '', data, headers, config: {} } as unknown as AxiosResponse)
  );

const T = ADMIN_QUIZ_TEXT;

describe('quizErrorMessage', () => {
  it('uses the fallback for non-HTTP errors', () => {
    expect(quizErrorMessage(new Error('x'), T, 'fallback')).toBe('fallback');
  });

  it('says the server could not be reached when there was no response', () => {
    expect(quizErrorMessage(failure(), T, 'fallback')).toBe(T.errors.network);
  });

  it('turns a 429 into minutes from retry_after_seconds', () => {
    const msg = quizErrorMessage(failure(429, { error: 'slow down', retry_after_seconds: 540 }), T, 'x');
    expect(msg).toContain('9 minutes');
  });

  it('falls back to the Retry-After header and rounds up to a minute', () => {
    expect(quizErrorMessage(failure(429, {}, { 'retry-after': '20' }), T, 'x')).toContain('a minute');
  });

  it('explains the games limit on create (409)', () => {
    expect(quizErrorMessage(failure(409, { error: 'limit' }), T, 'x', 'create')).toContain('30 games');
  });

  it('keeps the server message for a 409 elsewhere', () => {
    expect(quizErrorMessage(failure(409, { error: 'already active' }), T, 'x')).toBe('already active');
  });

  it('explains the question limit on save (400)', () => {
    const msg = quizErrorMessage(failure(400, { error: 'a quiz can have at most 100 questions' }), T, 'x', 'save');
    expect(msg).toContain('100 questions');
  });

  it('passes through other 4xx server messages and hides 5xx details', () => {
    expect(quizErrorMessage(failure(400, { error: 'no questions' }), T, 'x')).toBe('no questions');
    expect(quizErrorMessage(failure(500, { error: 'pq: boom' }), T, 'fallback')).toBe('fallback');
  });

  it('answers in Arabic when given Arabic text', () => {
    const msg = quizErrorMessage(failure(429, { retry_after_seconds: 60 }), hostAr, 'x');
    expect(msg).toContain('دقيقة');
  });
});
