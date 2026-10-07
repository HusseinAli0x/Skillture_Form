import type { Locale } from '../../context/LanguageStore';

/**
 * Copy for the live quiz game, in English and Arabic. Players are students in
 * a room, many of them Arabic speakers, so the game follows the same language
 * switch as the public site (the admin app stays English).
 *
 * Message lists are pools: the screens pick one at random so a long game does
 * not repeat itself, which is most of what makes it feel alive.
 */
export interface GameStrings {
  common: { players: (n: number) => string; points: (n: number) => string; rank: (n: number) => string };
  join: {
    title: string;
    pinLabel: string;
    pinPlaceholder: string;
    enter: string;
    invalidPin: string;
    nicknameTitle: string;
    nicknamePlaceholder: string;
    rollName: string;
    pickAvatar: string;
    letsGo: string;
    nameTaken: string;
    youAreIn: string;
    waitingPool: string[];
    othersHere: (n: number) => string;
  };
  lobby: {
    joinAt: string;
    pinTitle: string;
    scanToJoin: string;
    start: string;
    needPlayers: string;
    waitingPool: string[];
    copyLink: string;
    copied: string;
    musicOn: string;
    musicOff: string;
    localhostWarning: string;
    useNetworkAddress: string;
    starting: string;
  };
  host: {
    getReady: string;
    questionOf: (n: number, total: number) => string;
    answered: (n: number, total: number) => string;
    timeUp: string;
    next: string;
    showScoreboard: string;
    nextQuestion: string;
    finish: string;
    endGame: string;
    confirmEnd: string;
    correct: string;
    gotItRight: (pct: number) => string;
    nobodyGotIt: string;
    everybodyGotIt: string;
    scoreboard: string;
    finalResults: string;
    winner: string;
    backToQuizzes: string;
    playAgain: string;
    skipHint: string;
  };
  player: {
    getReady: string;
    goNow: string;
    waitingPool: string[];
    lockedIn: string;
    lockedInPool: string[];
    typeAnswer: string;
    send: string;
    correctPool: string[];
    wrongPool: string[];
    timeoutPool: string[];
    streak: (n: number) => string;
    streakBonus: (n: number) => string;
    youAreFirst: string;
    behind: (pts: number, name: string) => string;
    ahead: (pts: number, name: string) => string;
    yourPlace: (n: number, total: number) => string;
    gameOver: string;
    finalPlace: (n: number) => string;
    podiumLine: string[];
    playAgain: string;
    connectionLost: string;
    rejoin: string;
    reconnecting: string;
  };
}

const ordinalEn = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export const gameStrings: Record<Locale, GameStrings> = {
  en: {
    common: {
      players: n => (n === 1 ? '1 player' : `${n} players`),
      points: n => `${n.toLocaleString('en-US')} pts`,
      rank: ordinalEn,
    },
    join: {
      title: 'Join the game',
      pinLabel: 'Game PIN',
      pinPlaceholder: 'Game PIN',
      enter: 'Enter',
      invalidPin: 'No game with that PIN. Check the screen and try again.',
      nicknameTitle: 'Pick your player name',
      nicknamePlaceholder: 'Your nickname',
      rollName: 'Surprise me',
      pickAvatar: 'Pick your badge',
      letsGo: "Let's go!",
      nameTaken: 'That name is taken. Try another one!',
      youAreIn: "You're in!",
      waitingPool: [
        'Look at the big screen: is your name up there?',
        'Stretching our brains…',
        'Sharpening imaginary pencils…',
        'Waiting for the host to press the big button…',
        'Warm up those thumbs!',
      ],
      othersHere: n => (n <= 1 ? 'You are the first one here' : `${n} players are here`),
    },
    lobby: {
      joinAt: 'Join at',
      pinTitle: 'Game PIN',
      scanToJoin: 'Scan to join',
      start: 'Start game',
      needPlayers: 'Waiting for the first player…',
      waitingPool: [
        'Waiting for players…',
        'Tell your friends to hurry up!',
        'The more, the merrier.',
        'Names will pop up right here.',
      ],
      copyLink: 'Copy join link',
      copied: 'Copied!',
      musicOn: 'Music on',
      musicOff: 'Music off',
      localhostWarning:
        'This link only works on this computer. Players on phones need your network address instead.',
      useNetworkAddress: 'Use network address',
      starting: 'Starting…',
    },
    host: {
      getReady: 'Get ready!',
      questionOf: (n, total) => `Question ${n} of ${total}`,
      answered: (n, total) => `${n} of ${total} answered`,
      timeUp: "Time's up!",
      next: 'Next',
      showScoreboard: 'Scoreboard',
      nextQuestion: 'Next question',
      finish: 'Finish',
      endGame: 'End game',
      confirmEnd: 'End the game for everyone?',
      correct: 'Correct answer',
      gotItRight: pct => `${pct}% got it right`,
      nobodyGotIt: 'Nobody got that one. Tough crowd!',
      everybodyGotIt: 'Everybody got it. Show-offs!',
      scoreboard: 'Scoreboard',
      finalResults: 'Final results',
      winner: 'Winner',
      backToQuizzes: 'Back to quizzes',
      playAgain: 'Host again',
      skipHint: 'Press Space to continue',
    },
    player: {
      getReady: 'Get ready…',
      goNow: 'GO!',
      waitingPool: [
        'Eyes on the big screen!',
        'Brain warming up…',
        'Any second now…',
        'Hold on to your seat!',
      ],
      lockedIn: 'Locked in!',
      lockedInPool: ['Bold choice.', 'No take-backs.', 'Fingers crossed…', 'Now we wait and sweat.', 'Confidence level: high.'],
      typeAnswer: 'Type your answer',
      send: 'Send',
      correctPool: ['Nailed it!', 'Big brain energy!', 'Look at you go!', 'Too easy!', 'Genius alert!', 'Smooth!'],
      wrongPool: ['Oof. So close.', 'Plot twist: nope.', 'Even legends miss one.', 'Brain buffering…', 'The answer was hiding.'],
      timeoutPool: ['Time flew by!', 'The clock won that round.', 'Too slow, too quick, too bad!'],
      streak: n => `${n} in a row!`,
      streakBonus: n => `+${n} streak bonus`,
      youAreFirst: "You're in the lead!",
      behind: (pts, name) => `${pts.toLocaleString('en-US')} behind ${name}`,
      ahead: (pts, name) => `${pts.toLocaleString('en-US')} ahead of ${name}`,
      yourPlace: (n, total) => `${ordinalEn(n)} of ${total}`,
      gameOver: 'Game over!',
      finalPlace: n => `You finished ${ordinalEn(n)}`,
      podiumLine: ['What a performance!', 'Take a bow!', 'Legendary.'],
      playAgain: 'Join another game',
      connectionLost: 'We lost the connection to the game.',
      rejoin: 'Join again',
      reconnecting: 'Reconnecting…',
    },
  },
  ar: {
    common: {
      players: n => (n === 1 ? 'لاعب واحد' : `${n} لاعبين`),
      points: n => `${n.toLocaleString('en-US')} نقطة`,
      rank: n => `المركز ${n}`,
    },
    join: {
      title: 'انضم إلى اللعبة',
      pinLabel: 'رمز اللعبة',
      pinPlaceholder: 'رمز اللعبة',
      enter: 'دخول',
      invalidPin: 'لا توجد لعبة بهذا الرمز. تحقق من الشاشة وحاول مجدداً.',
      nicknameTitle: 'اختر اسم اللاعب',
      nicknamePlaceholder: 'لقبك',
      rollName: 'فاجئني',
      pickAvatar: 'اختر شارتك',
      letsGo: 'هيا بنا!',
      nameTaken: 'هذا الاسم مستخدم. جرّب اسماً آخر!',
      youAreIn: 'أنت معنا!',
      waitingPool: [
        'انظر إلى الشاشة الكبيرة: هل اسمك هناك؟',
        'نُسخّن العقول…',
        'نبري أقلاماً خيالية…',
        'ننتظر المقدّم ليضغط الزر الكبير…',
        'سخّن أصابعك!',
      ],
      othersHere: n => (n <= 1 ? 'أنت أول الواصلين' : `${n} لاعبين هنا`),
    },
    lobby: {
      joinAt: 'انضم عبر',
      pinTitle: 'رمز اللعبة',
      scanToJoin: 'امسح للانضمام',
      start: 'ابدأ اللعبة',
      needPlayers: 'بانتظار أول لاعب…',
      waitingPool: ['بانتظار اللاعبين…', 'قل لأصدقائك أن يسرعوا!', 'كلما زاد العدد زادت المتعة.', 'ستظهر الأسماء هنا.'],
      copyLink: 'انسخ رابط الانضمام',
      copied: 'تم النسخ!',
      musicOn: 'الموسيقى تعمل',
      musicOff: 'الموسيقى متوقفة',
      localhostWarning: 'هذا الرابط يعمل على هذا الحاسوب فقط. اللاعبون على الهواتف يحتاجون عنوان الشبكة.',
      useNetworkAddress: 'استخدم عنوان الشبكة',
      starting: 'جارٍ البدء…',
    },
    host: {
      getReady: 'استعدوا!',
      questionOf: (n, total) => `السؤال ${n} من ${total}`,
      answered: (n, total) => `أجاب ${n} من ${total}`,
      timeUp: 'انتهى الوقت!',
      next: 'التالي',
      showScoreboard: 'لوحة النتائج',
      nextQuestion: 'السؤال التالي',
      finish: 'إنهاء',
      endGame: 'إنهاء اللعبة',
      confirmEnd: 'إنهاء اللعبة للجميع؟',
      correct: 'الإجابة الصحيحة',
      gotItRight: pct => `${pct}٪ أجابوا بشكل صحيح`,
      nobodyGotIt: 'لم يعرفها أحد. جمهور صعب!',
      everybodyGotIt: 'الجميع عرفها. استعراض!',
      scoreboard: 'لوحة النتائج',
      finalResults: 'النتائج النهائية',
      winner: 'الفائز',
      backToQuizzes: 'العودة إلى الاختبارات',
      playAgain: 'استضف مجدداً',
      skipHint: 'اضغط المسافة للمتابعة',
    },
    player: {
      getReady: 'استعد…',
      goNow: 'انطلق!',
      waitingPool: ['عيونك على الشاشة الكبيرة!', 'العقل يسخّن…', 'في أي لحظة…', 'تمسّك بمقعدك!'],
      lockedIn: 'تم تثبيت الإجابة!',
      lockedInPool: ['اختيار جريء.', 'لا رجعة الآن.', 'نتمنى لك التوفيق…', 'الآن ننتظر ونتوتر.', 'مستوى الثقة: عالٍ.'],
      typeAnswer: 'اكتب إجابتك',
      send: 'إرسال',
      correctPool: ['أحسنت!', 'عقل جبّار!', 'استمر هكذا!', 'سهلة جداً!', 'عبقري!', 'بسلاسة!'],
      wrongPool: ['آه… كنت قريباً.', 'مفاجأة: لا.', 'حتى الأساطير تخطئ.', 'العقل يحمّل…', 'الإجابة كانت مختبئة.'],
      timeoutPool: ['مرّ الوقت سريعاً!', 'الساعة فازت هذه الجولة.', 'أبطأ من اللازم!'],
      streak: n => `${n} متتالية!`,
      streakBonus: n => `+${n} مكافأة تتابع`,
      youAreFirst: 'أنت في الصدارة!',
      behind: (pts, name) => `خلف ${name} بـ ${pts.toLocaleString('en-US')}`,
      ahead: (pts, name) => `أمام ${name} بـ ${pts.toLocaleString('en-US')}`,
      yourPlace: (n, total) => `المركز ${n} من ${total}`,
      gameOver: 'انتهت اللعبة!',
      finalPlace: n => `أنهيت في المركز ${n}`,
      podiumLine: ['أداء رائع!', 'حيّ الجمهور!', 'أسطورة.'],
      playAgain: 'انضم للعبة أخرى',
      connectionLost: 'فقدنا الاتصال باللعبة.',
      rejoin: 'انضم مجدداً',
      reconnecting: 'جارٍ إعادة الاتصال…',
    },
  },
};

/** A random entry from a pool. */
export function pick<T>(pool: readonly T[], seed?: number): T {
  const i = seed === undefined ? Math.floor(Math.random() * pool.length) : Math.abs(seed) % pool.length;
  return pool[i];
}
