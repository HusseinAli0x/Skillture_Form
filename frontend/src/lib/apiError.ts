import axios from 'axios';

/**
 * Reading an error message off a failed request.
 *
 * Every call site wrote `catch (err: any)` and then reached into
 * `err.response?.data?.error` — a chain that only exists on an axios error, on
 * a body only this API produces, typed `any` so nothing checked either
 * assumption. A `TypeError` thrown inside the `try` took the same path and
 * silently produced the fallback string.
 */

/** What handlers/errors.go puts in the body of a failed response. */
interface ApiErrorBody {
  error?: string;
  message?: string;
}

/**
 * The server's message for a failed request, or `fallback`.
 *
 * The fallback wins over axios's own text ("Request failed with status code
 * 500"), which is never the right thing to show a user.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (typeof body?.error === 'string' && body.error) return body.error;
    if (typeof body?.message === 'string' && body.message) return body.message;
  }
  return fallback;
}

/** HTTP status of a failed request, or undefined if it never reached the server. */
export function apiErrorStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}
