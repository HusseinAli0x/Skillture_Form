import { isAxiosError } from 'axios';

/** Keys of `workshop.registration.errors`. */
export type RegistrationErrorKey =
  | 'nameRequired'
  | 'nameInvalid'
  | 'nameTooLong'
  | 'emailInvalid'
  | 'notFound'
  | 'ended'
  | 'closed'
  | 'full'
  | 'already'
  | 'rateLimited'
  | 'network'
  | 'server';

const BY_CODE: Record<string, RegistrationErrorKey> = {
  name_required: 'nameRequired',
  name_invalid: 'nameInvalid',
  name_too_long: 'nameTooLong',
  email_invalid: 'emailInvalid',
  workshop_not_found: 'notFound',
  workshop_ended: 'ended',
  registration_closed: 'closed',
  workshop_full: 'full',
  already_registered: 'already',
  server_error: 'server',
};

/**
 * Which localized message a failed POST /workshops/:id/register should show.
 * The server's own English `error` text is never used: only its `code`, or the
 * HTTP status for the rate limiter, which sends no code.
 */
export function registrationErrorKey(err: unknown): RegistrationErrorKey {
  if (!isAxiosError(err)) return 'server';
  if (!err.response) return 'network';
  const data = err.response.data as { code?: unknown } | undefined;
  const code = typeof data?.code === 'string' ? data.code : '';
  if (BY_CODE[code]) return BY_CODE[code];
  if (err.response.status === 429) return 'rateLimited';
  return 'server';
}

/** Failures that mean the workshop's state changed since the page loaded. */
export const STATE_CHANGED: readonly RegistrationErrorKey[] = ['ended', 'closed', 'full', 'notFound'];
