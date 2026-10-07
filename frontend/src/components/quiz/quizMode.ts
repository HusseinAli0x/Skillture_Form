/**
 * The quiz list and builder serve two audiences from the same code:
 *
 *  - `admin`: the signed-in dashboard (MainLayout, English, Archive and status
 *    controls, everything the admin created).
 *  - `public`: anyone hosting a game with no account (PublicShell, English or
 *    Arabic, only the games created in this browser).
 *
 * Everything that differs is derived from the mode here, so the pages hold
 * no `/admin/...` literals of their own.
 */
export type QuizMode = 'admin' | 'public';

export interface QuizPaths {
  /** The list of games. */
  list: string;
  /** The builder: new when `id` is omitted. */
  builder: (id?: string) => string;
}

const ADMIN: QuizPaths = {
  list: '/admin/quizzes',
  builder: id => (id ? `/admin/builder/${id}` : '/admin/builder'),
};

const PUBLIC: QuizPaths = {
  list: '/create',
  builder: id => (id ? `/create/${id}` : '/create/new'),
};

export const quizPaths = (mode: QuizMode): QuizPaths => (mode === 'admin' ? ADMIN : PUBLIC);

/** Server-enforced limits for a visitor, mirrored here so the form can say so before the server does. */
export const QUIZ_LIMITS = {
  quizzes: 30,
  questions: 100,
  title: 200,
  description: 1000,
} as const;
