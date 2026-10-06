import { apiErrorStatus } from './apiError';

/**
 * What to tell someone whose sign-in failed. The server's own wording is not
 * shown for credential failures: it should not hint at which half was wrong,
 * and "invalid credentials" is not how a person would say it.
 */
export function loginErrorMessage(err: unknown): string {
  const status = apiErrorStatus(err);
  if (status === 401 || status === 400) return 'That username and password do not match. Try again.';
  if (status === 429) return 'Too many attempts. Wait a minute, then try again.';
  if (status === undefined) return 'Cannot reach the server. Check your connection and try again.';
  return 'Something went wrong on our side. Try again in a moment.';
}

/** Only ever return to an admin page; anything else falls back to the dashboard. */
export function safeReturnPath(from: unknown): string {
  return typeof from === 'string' && /^\/admin(\/|$|\?)/.test(from) ? from : '/admin/dashboard';
}
