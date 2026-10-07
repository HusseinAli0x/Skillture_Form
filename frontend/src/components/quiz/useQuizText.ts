import { useSiteStrings } from '../../lib/useSiteContent';
import { ADMIN_QUIZ_TEXT, type QuizText } from './quizText';
import type { QuizMode } from './quizMode';

/**
 * Wording for the current audience: the dashboard's fixed English, or the
 * public site's text in the visitor's language (with admin edits applied).
 * Both hooks always run so the call order never depends on the mode.
 */
export function useQuizText(mode: QuizMode): QuizText {
  const site = useSiteStrings().host;
  return mode === 'admin' ? ADMIN_QUIZ_TEXT : site;
}
