import type { InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import client from './client';
import { getHostKey } from '../lib/hostKey';

/** Run a request through the interceptors with a canned adapter. */
function request(status: number) {
  const seen: InternalAxiosRequestConfig[] = [];
  client.defaults.adapter = async config => {
    seen.push(config);
    if (status >= 400) {
      throw new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, {
        status,
        statusText: '',
        data: {},
        headers: {},
        config,
      });
    }
    return { status, statusText: 'OK', data: {}, headers: {}, config };
  };
  return { seen, promise: client.get('/api/v1/quizzes') };
}

const assign = vi.fn();
const original = window.location;

function setPath(pathname: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname, assign },
  });
}

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear();
    assign.mockClear();
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('sends the host key on every request', async () => {
    const { seen, promise } = request(200);
    await promise;
    expect(seen[0].headers['X-Host-Key']).toBe(getHostKey());
    expect(seen[0].headers.Authorization).toBeUndefined();
  });

  it('does not send the host key from inside /admin, so an expired admin token fails with 401', async () => {
    setPath('/admin/quizzes');
    localStorage.setItem('token', 'abc');
    const { seen, promise } = request(200);
    await promise;
    expect(seen[0].headers.Authorization).toBe('Bearer abc');
    expect(seen[0].headers['X-Host-Key']).toBeUndefined();
  });

  it('adds the bearer token as well when signed in', async () => {
    localStorage.setItem('token', 'abc');
    const { seen, promise } = request(200);
    await promise;
    expect(seen[0].headers.Authorization).toBe('Bearer abc');
    expect(seen[0].headers['X-Host-Key']).toBe(getHostKey());
  });

  it('signs the admin out and goes to /login on a 401 inside /admin', async () => {
    setPath('/admin/quizzes');
    localStorage.setItem('token', 'stale');
    localStorage.setItem('admin', '{}');
    await expect(request(401).promise).rejects.toThrow();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('admin')).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('leaves a visitor on a public page alone after a 401', async () => {
    setPath('/create');
    localStorage.setItem('token', 'kept');
    await expect(request(401).promise).rejects.toThrow();
    expect(assign).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBe('kept');
  });

  it('does not treat /administrators as the admin area', async () => {
    setPath('/administrators');
    await expect(request(401).promise).rejects.toThrow();
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not react to other errors', async () => {
    setPath('/admin/quizzes');
    await expect(request(500).promise).rejects.toThrow();
    expect(assign).not.toHaveBeenCalled();
  });
});
