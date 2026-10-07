import type { Locale } from '../../context/LanguageStore';

/** Player-screen copy that the shared strings do not cover (en + ar). */
export interface PlayerExtraStrings {
  findingGame: string;
  joining: string;
  yourPhoto: string;
  uploadOwn: string;
  uploadFormats: (maxMb: number) => string;
  badType: string;
  tooLarge: (maxMb: number) => string;
  joinFailed: string;
  gameFinished: string;
  question: (n: number) => string;
  theAnswerWas: string;
  totalScore: string;
  sendFailed: string;
  yourAnswer: string;
  answerAnnounce: {
    correct: (pts: number) => string;
    wrong: string;
    timeout: string;
  };
  newQuestion: string;
  languageHint: string;
}

export const playerExtra: Record<Locale, PlayerExtraStrings> = {
  en: {
    findingGame: 'Finding game…',
    joining: 'Joining…',
    yourPhoto: 'Your photo',
    uploadOwn: 'Upload your own photo',
    uploadFormats: mb => `PNG, JPG, WEBP or GIF, up to ${mb} MB`,
    badType: 'Use a PNG, JPG, WEBP or GIF image.',
    tooLarge: mb => `That image is too large. Keep it under ${mb} MB.`,
    joinFailed: "We couldn't get you in. Please try again.",
    gameFinished: 'That game has already finished.',
    question: n => `Question ${n}`,
    theAnswerWas: 'The answer was',
    totalScore: 'Total score',
    sendFailed: "That didn't go through. Tap again!",
    yourAnswer: 'Your answer',
    answerAnnounce: {
      correct: pts => `Correct! ${pts} points.`,
      wrong: 'Not this time.',
      timeout: "Time's up.",
    },
    newQuestion: 'New question',
    languageHint: 'Language',
  },
  ar: {
    findingGame: 'جارٍ البحث عن اللعبة…',
    joining: 'جارٍ الانضمام…',
    yourPhoto: 'صورتك',
    uploadOwn: 'ارفع صورتك الخاصة',
    uploadFormats: mb => `PNG أو JPG أو WEBP أو GIF حتى ${mb} ميغابايت`,
    badType: 'استخدم صورة بصيغة PNG أو JPG أو WEBP أو GIF.',
    tooLarge: mb => `الصورة كبيرة جداً. اجعلها أقل من ${mb} ميغابايت.`,
    joinFailed: 'تعذّر إدخالك. حاول مرة أخرى.',
    gameFinished: 'انتهت هذه اللعبة بالفعل.',
    question: n => `السؤال ${n}`,
    theAnswerWas: 'الإجابة كانت',
    totalScore: 'مجموع النقاط',
    sendFailed: 'لم تصل الإجابة. اضغط مرة أخرى!',
    yourAnswer: 'إجابتك',
    answerAnnounce: {
      correct: pts => `إجابة صحيحة! ${pts} نقطة.`,
      wrong: 'ليس هذه المرة.',
      timeout: 'انتهى الوقت.',
    },
    newQuestion: 'سؤال جديد',
    languageHint: 'اللغة',
  },
};

/** What the join screen remembers so the live screen can show the same badge. */
export interface StoredPlayer {
  name: string;
  avatarId?: number;
  avatarUrl?: string;
}

const key = (playerId: string) => `skillture-player-${playerId}`;

export function rememberPlayer(playerId: string, player: StoredPlayer): void {
  try {
    // A pasted photo can be megabytes; storage is tiny. Keep the glyph instead.
    const safe = player.avatarUrl && player.avatarUrl.length > 150_000 ? { ...player, avatarUrl: undefined } : player;
    sessionStorage.setItem(key(playerId), JSON.stringify(safe));
  } catch {
    // Storage blocked: the live screen falls back to a deterministic glyph.
  }
}

export function recallPlayer(playerId: string): StoredPlayer | null {
  try {
    const raw = sessionStorage.getItem(key(playerId));
    return raw ? (JSON.parse(raw) as StoredPlayer) : null;
  } catch {
    return null;
  }
}
