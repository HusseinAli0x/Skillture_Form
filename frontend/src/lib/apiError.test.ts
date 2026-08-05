import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { apiErrorMessage, apiErrorStatus } from './apiError';

const axiosError = (status: number, data: unknown): AxiosError => {
  const headers = new AxiosHeaders();
  const config = { headers };
  const response = { status, data, statusText: '', headers, config } as AxiosResponse;
  return new AxiosError('Request failed with status code ' + status, undefined, config, null, response);
};

describe('apiErrorMessage', () => {
  it('returns the server message', () => {
    expect(apiErrorMessage(axiosError(409, { error: 'nickname taken' }), 'fallback')).toBe(
      'nickname taken'
    );
  });

  it('accepts `message` as well as `error`', () => {
    expect(apiErrorMessage(axiosError(400, { message: 'bad input' }), 'fallback')).toBe('bad input');
  });

  it('prefers the fallback over axios own text', () => {
    // "Request failed with status code 500" is never the right thing to show
    // a user, so a body without a message must not fall through to it.
    expect(apiErrorMessage(axiosError(500, {}), 'Failed to save form.')).toBe('Failed to save form.');
  });

  it('ignores a non-string message', () => {
    expect(apiErrorMessage(axiosError(400, { error: { nested: true } }), 'fallback')).toBe('fallback');
  });

  it('ignores an HTML error page', () => {
    // A proxy 502 returns HTML, not the API error shape.
    expect(apiErrorMessage(axiosError(502, '<html>Bad Gateway</html>'), 'fallback')).toBe('fallback');
  });

  it('handles a thrown TypeError, not just request failures', () => {
    // This is the case the old `catch (err: any)` swallowed: a bug inside the
    // try block took the same path and was reported as a server rejection.
    expect(apiErrorMessage(new TypeError('x is not a function'), 'fallback')).toBe('fallback');
    expect(apiErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(apiErrorMessage('a string', 'fallback')).toBe('fallback');
  });
});

describe('apiErrorStatus', () => {
  it('returns the HTTP status', () => {
    // PlayerLiveBoard branches on 409, QuizJoinHandler on 404.
    expect(apiErrorStatus(axiosError(409, {}))).toBe(409);
    expect(apiErrorStatus(axiosError(404, {}))).toBe(404);
  });

  it('is undefined when the request never reached the server', () => {
    expect(apiErrorStatus(new Error('Network Error'))).toBeUndefined();
    expect(apiErrorStatus(null)).toBeUndefined();
  });
});
