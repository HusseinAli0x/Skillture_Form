import type { Locale } from '../../context/LanguageStore';

/** Host-screen copy that lib/game/strings.ts does not cover, in English and Arabic. */
export interface HostStrings {
  reconnecting: string;
  connectionFailed: string;
  loadError: string;
  retry: string;
  back: string;
  typeOnPhone: string;
  topAnswers: string;
  noAnswers: string;
  endYes: string;
  endNo: string;
  skip: string;
  everyoneElse: string;
  noQuestions: string;
  startFailed: string;
  joined: (name: string) => string;
  announce: {
    question: (n: number, total: number) => string;
    results: string;
    scoreboard: string;
    finished: string;
  };
  rankUp: (n: number) => string;
  rankDown: (n: number) => string;
  firstPlace: string;
  nobodyHere: string;
  loading: string;
}

export const hostStrings: Record<Locale, HostStrings> = {
  en: {
    reconnecting: 'Reconnecting…',
    connectionFailed: 'Lost the live connection. Reload to reconnect.',
    loadError: 'We could not load this game.',
    retry: 'Try again',
    back: 'Back to quizzes',
    typeOnPhone: 'Type your answer on your phone',
    topAnswers: 'Most common answers',
    noAnswers: 'Nobody answered this one.',
    endYes: 'Yes, end it',
    endNo: 'Keep playing',
    skip: 'Skip',
    everyoneElse: 'Everyone else',
    noQuestions: 'This quiz has no questions yet.',
    startFailed: 'Could not start the game.',
    joined: name => `${name} joined`,
    announce: {
      question: (n, total) => `Question ${n} of ${total}`,
      results: 'Results are in',
      scoreboard: 'Scoreboard',
      finished: 'Game finished',
    },
    rankUp: n => `Up ${n}`,
    rankDown: n => `Down ${n}`,
    firstPlace: 'In the lead',
    nobodyHere: 'No players',
    loading: 'Loading the game…',
  },
  ar: {
    reconnecting: 'جارٍ إعادة الاتصال…',
    connectionFailed: 'انقطع الاتصال المباشر. أعد تحميل الصفحة.',
    loadError: 'تعذّر تحميل هذه اللعبة.',
    retry: 'حاول مجدداً',
    back: 'العودة إلى الاختبارات',
    typeOnPhone: 'اكتب إجابتك على هاتفك',
    topAnswers: 'أكثر الإجابات تكراراً',
    noAnswers: 'لم يجب أحد على هذا السؤال.',
    endYes: 'نعم، أنهِها',
    endNo: 'تابع اللعب',
    skip: 'تخطّي',
    everyoneElse: 'بقية اللاعبين',
    noQuestions: 'لا توجد أسئلة في هذا الاختبار بعد.',
    startFailed: 'تعذّر بدء اللعبة.',
    joined: name => `انضم ${name}`,
    announce: {
      question: (n, total) => `السؤال ${n} من ${total}`,
      results: 'ظهرت النتائج',
      scoreboard: 'لوحة النتائج',
      finished: 'انتهت اللعبة',
    },
    rankUp: n => `صعد ${n}`,
    rankDown: n => `نزل ${n}`,
    firstPlace: 'في الصدارة',
    nobodyHere: 'لا يوجد لاعبون',
    loading: 'جارٍ تحميل اللعبة…',
  },
};
