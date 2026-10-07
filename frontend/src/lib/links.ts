/**
 * Public URLs handed to respondents and players.
 *
 * These were built inline in five places, each re-deriving the path from
 * `window.location.origin`. Route changes had to be found by grep.
 */

/** Public form, open to anyone with the link. */
export const formShareUrl = (formId: string) => `${window.location.origin}/preview/form/${formId}`;

/** Quiz landing page; it waits for the host and forwards to the game. */
export const quizShareUrl = (quizId: string) => `${window.location.origin}/quiz/${quizId}`;

/** Join page with the PIN prefilled — the player only types a nickname. */
export const gameJoinUrl = (pin: string) => `${window.location.origin}/play?pin=${pin}`;

/**
 * Where "back to my quizzes" goes from a game screen: the dashboard list for a
 * signed-in admin, My games for everyone else (the dashboard would send a
 * visitor to the login page).
 */
export const hostHomePath = (): string => {
  try {
    return localStorage.getItem('token') ? '/admin/quizzes' : '/create';
  } catch {
    return '/create';
  }
};
