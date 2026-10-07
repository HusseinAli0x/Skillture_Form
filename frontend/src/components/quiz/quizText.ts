import { siteStrings } from '../../lib/siteStrings';
import type { HostStrings } from '../../lib/hostSiteStrings';

/** All wording for the quiz list, builder and question editor. */
export type QuizText = HostStrings;

/** Replaces `{name}` placeholders. Unknown placeholders are left as they are. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

const en = siteStrings.en.host;

/**
 * The dashboard is English-only and is not edited from Site content, so it
 * reads the built-in English text directly. Where the public wording says
 * "game" the dashboard keeps the "quiz" wording it always had.
 */
export const ADMIN_QUIZ_TEXT: QuizText = {
  ...en,
  list: {
    ...en.list,
    metaTitle: 'Quiz games',
    title: 'Quiz Games',
    subtitle: 'Write a quiz, press Start, and the room plays on their phones.',
    create: 'New Quiz',
    createFirst: 'Create your first quiz',
    searchLabel: 'Search quizzes',
    searchPlaceholder: 'Search quizzes...',
    gameCount: n => `${n} quiz${n !== 1 ? 'zes' : ''}`,
    noMatch: 'No quizzes match "{query}"',
    loading: 'Loading quizzes',
    loadErrorTitle: 'Could not load your quizzes',
    emptyTitle: 'Make your first live quiz',
    steps: [
      en.list.steps[0],
      { title: 'Press Start game', body: en.list.steps[1].body },
      en.list.steps[2],
    ],
    hostNow: 'Start game',
    edit: 'Edit quiz',
    share: 'Share quiz',
    archive: 'Archive quiz',
    delete: 'Delete quiz',
    shareHint: 'Players scan this to join the next live session.',
    deleteTitle: 'Delete quiz',
    deleteMessage: '"{title}" and all of its questions and past sessions will be permanently deleted. This cannot be undone.',
    archivedToast: 'Quiz archived',
    deletedToast: 'Quiz deleted',
    archiveFailed: 'Failed to archive',
    deleteFailed: 'Failed to delete',
    startFailed: 'Failed to start a game',
  },
  builder: {
    ...en.builder,
    metaNew: 'New quiz',
    metaEdit: 'Edit quiz',
    headingNew: 'New Quiz',
    headingEdit: 'Edit Quiz',
    back: 'Back to quizzes',
    hostNow: 'Start game',
    save: 'Save Quiz',
    titleIssue: 'Give the quiz a title.',
    settings: 'Quiz Settings',
    titleInvalid: 'Give the quiz a title players will recognise.',
    descriptionPlaceholder: 'A short description of this quiz...',
    addQuestion: 'Add Next Question',
    loading: 'Loading quiz…',
    loadFailedTitle: 'Could not open this quiz',
    loadFailedBody: 'It may have been deleted.',
    savedNew: 'Quiz created.',
    savedEdit: 'Quiz saved.',
    saveFailed: 'Failed to save quiz. Your edits are still here.',
    startFailed: 'Could not start a game.',
  },
};

/** The labels a fresh question starts with, in the editor's language. */
export function questionDefaults(text: QuizText): { options: [string, string]; trueFalse: [string, string] } {
  return {
    options: [text.editor.optionA, text.editor.optionB],
    trueFalse: [text.editor.trueLabel, text.editor.falseLabel],
  };
}
