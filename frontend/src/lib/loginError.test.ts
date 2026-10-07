import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { loginErrorMessage, safeReturnPath } from './loginError';

const withStatus = (status: number) =>
  new AxiosError('failed', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data: { error: 'invalid credentials' },
  });

describe('loginErrorMessage', () => {
  it('says the pair does not match for 401 without echoing server wording', () => {
    const msg = loginErrorMessage(withStatus(401));
    expect(msg).toMatch(/do not match/i);
    expect(msg).not.toMatch(/invalid credentials/i);
  });

  it('explains rate limiting', () => {
    expect(loginErrorMessage(withStatus(429))).toMatch(/too many/i);
  });

  it('distinguishes an unreachable server from a server error', () => {
    expect(loginErrorMessage(new AxiosError('Network Error'))).toMatch(/cannot reach/i);
    expect(loginErrorMessage(withStatus(500))).toMatch(/our side/i);
  });
});

describe('safeReturnPath', () => {
  it('only returns to admin pages', () => {
    expect(safeReturnPath('/admin/forms')).toBe('/admin/forms');
    expect(safeReturnPath('/admin')).toBe('/admin');
    expect(safeReturnPath('/admin/forms?x=1')).toBe('/admin/forms?x=1');
  });

  it('falls back to the dashboard for anything else', () => {
    expect(safeReturnPath(undefined)).toBe('/admin/dashboard');
    expect(safeReturnPath('https://evil.example')).toBe('/admin/dashboard');
    expect(safeReturnPath('//evil.example')).toBe('/admin/dashboard');
    expect(safeReturnPath('/administrator')).toBe('/admin/dashboard');
  });
});
