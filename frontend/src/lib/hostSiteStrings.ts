/**
 * Copy for hosting a game without an account: the "Host a game" entry points,
 * My games, the game builder and the question editor. Lives under `host` in
 * siteStrings, so the admin's text editor lists and overrides it like the rest.
 *
 * Placeholders such as `{title}` or `{n}` are filled in by `fill()`; they stay
 * plain strings so an editor can change the wording around them. Functions are
 * used only for counts, where Arabic needs its own plural forms.
 */

export interface HostStrings {
  nav: string;
  home: { line: string; link: string };
  note: { title: string; body: string };
  status: { draft: string; ready: string; archived: string };
  list: {
    metaTitle: string;
    kicker: string;
    title: string;
    subtitle: string;
    create: string;
    createFirst: string;
    searchLabel: string;
    searchPlaceholder: string;
    gameCount: (n: number) => string;
    noMatch: string;
    clearSearch: string;
    loading: string;
    loadErrorTitle: string;
    loadErrorBody: string;
    retry: string;
    emptyTitle: string;
    emptyIntro: string;
    steps: { title: string; body: string }[];
    questionCount: (n: number) => string;
    upTo: string;
    edited: string;
    seconds: (n: number) => string;
    minutes: (n: number) => string;
    lobbyOpen: string;
    inProgress: string;
    pin: string;
    hostNow: string;
    resume: string;
    addQuestions: string;
    view: string;
    edit: string;
    share: string;
    archive: string;
    delete: string;
    shareTitle: string;
    shareHint: string;
    shareLinkLabel: string;
    copy: string;
    copied: string;
    deleteTitle: string;
    deleteMessage: string;
    deleteConfirm: string;
    cancel: string;
    close: string;
    untitled: string;
    archivedToast: string;
    deletedToast: string;
    archiveFailed: string;
    deleteFailed: string;
    startFailed: string;
    needQuestions: string;
  };
  builder: {
    metaNew: string;
    metaEdit: string;
    headingNew: string;
    headingEdit: string;
    back: string;
    unsaved: string;
    saved: string;
    notSaved: string;
    hostNow: string;
    save: string;
    saving: string;
    problems: (n: number) => string;
    titleIssue: string;
    question: string;
    settings: string;
    title: string;
    titlePlaceholder: string;
    titleInvalid: string;
    description: string;
    descriptionPlaceholder: string;
    questions: string;
    points: string;
    upTo: string;
    addQuestion: string;
    maxQuestions: string;
    leaveTitle: string;
    leaveMessage: string;
    leaveConfirm: string;
    leaveStay: string;
    loading: string;
    loadFailedTitle: string;
    loadFailedBody: string;
    savedNew: string;
    savedEdit: string;
    fixItems: string;
    saveFailed: string;
    startFailed: string;
  };
  editor: {
    question: string;
    moveUp: string;
    moveDown: string;
    duplicate: string;
    remove: string;
    questionText: string;
    questionPlaceholder: string;
    questionType: string;
    types: { mcq: string; tf: string; short: string };
    answers: string;
    markCorrect: string;
    markCorrectTitle: string;
    option: string;
    optionA: string;
    optionB: string;
    removeOption: string;
    addOption: string;
    addOptionHint: string;
    trueLabel: string;
    falseLabel: string;
    shortPlaceholder: string;
    correctAnswer: string;
    shortHint: string;
    time: string;
    timePresets: string;
    points: string;
  };
  issues: {
    text: string;
    shortAnswer: string;
    emptyOptions: string;
    duplicateOptions: string;
    chooseTrueFalse: string;
    markCorrect: string;
    time: string;
    points: string;
  };
  errors: {
    network: string;
    rateLimited: (minutes: number) => string;
    quizLimit: string;
    questionLimit: string;
    tooLong: string;
    notFound: string;
    generic: string;
  };
}

/** Arabic count words: 1 and 2 have their own forms, 3-10 take the plural, the rest the singular. */
const arCount = (n: number, one: string, two: string, few: string, many: string) =>
  n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`;

export const hostEn: HostStrings = {
  nav: 'Host a game',
  home: { line: 'Running your own quiz? No account needed.', link: 'Host a game' },
  note: {
    title: 'Your games are saved in this browser',
    body: 'There is no account: your games live in this browser only. If you clear your browser data or switch devices you will not see them. Games that go about 6 months without being hosted are deleted automatically.',
  },
  status: { draft: 'Draft', ready: 'Ready', archived: 'Archived' },
  list: {
    metaTitle: 'My games — Skillture',
    kicker: 'HOST A GAME',
    title: 'My games',
    subtitle: 'Write a quiz, press Host now, and the room plays on their phones. No account needed.',
    create: 'Create a game',
    createFirst: 'Create your first game',
    searchLabel: 'Search games',
    searchPlaceholder: 'Search games...',
    gameCount: n => `${n} ${n === 1 ? 'game' : 'games'}`,
    noMatch: 'No games match "{query}"',
    clearSearch: 'Clear the search',
    loading: 'Loading games',
    loadErrorTitle: 'Could not load your games',
    loadErrorBody: 'Check your connection and try again.',
    retry: 'Try again',
    emptyTitle: 'Make your first live game',
    emptyIntro: 'It takes about two minutes. Here is how a game runs:',
    steps: [
      { title: 'Write questions', body: 'Multiple choice, true / false or a typed answer, each with its own timer.' },
      { title: 'Press Host now', body: 'A PIN and QR code fill the big screen. Players join from their phones.' },
      { title: 'Run it with Space', body: 'Answers, votes and a moving leaderboard play out live. Space moves to the next step.' },
    ],
    questionCount: n => `${n} ${n === 1 ? 'question' : 'questions'}`,
    upTo: 'up to {time}',
    edited: 'Edited {when}',
    seconds: n => `${n} sec`,
    minutes: n => `${n} min`,
    lobbyOpen: 'Lobby open',
    inProgress: 'Game in progress',
    pin: 'PIN {pin}',
    hostNow: 'Host now',
    resume: 'Resume game',
    addQuestions: 'Add questions',
    view: 'View',
    edit: 'Edit game',
    share: 'Share link',
    archive: 'Archive game',
    delete: 'Delete game',
    shareTitle: 'Share "{title}"',
    shareHint: 'Players scan this to join the next live game.',
    shareLinkLabel: 'Share link',
    copy: 'Copy',
    copied: 'Copied',
    deleteTitle: 'Delete game',
    deleteMessage: '"{title}" and all of its questions and past games will be permanently deleted. This cannot be undone.',
    deleteConfirm: 'Delete',
    cancel: 'Cancel',
    close: 'Close',
    untitled: 'Untitled',
    archivedToast: 'Game archived',
    deletedToast: 'Game deleted',
    archiveFailed: 'Could not archive this game.',
    deleteFailed: 'Could not delete this game.',
    startFailed: 'Could not start a game.',
    needQuestions: 'Add at least one question first.',
  },
  builder: {
    metaNew: 'New game — Skillture',
    metaEdit: 'Edit game — Skillture',
    headingNew: 'New game',
    headingEdit: 'Edit game',
    back: 'Back to my games',
    unsaved: 'Unsaved changes',
    saved: 'All changes saved',
    notSaved: 'Not saved yet',
    hostNow: 'Host now',
    save: 'Save game',
    saving: 'Saving…',
    problems: n => `${n} ${n === 1 ? 'thing needs' : 'things need'} fixing before this can be saved:`,
    titleIssue: 'Give the game a title.',
    question: 'Question {n}',
    settings: 'Game settings',
    title: 'Title',
    titlePlaceholder: 'e.g. Intro to Golang',
    titleInvalid: 'Give the game a title players will recognise.',
    description: 'Description',
    descriptionPlaceholder: 'A short description of this game...',
    questions: 'Questions',
    points: '{n} pts',
    upTo: 'up to {time}',
    addQuestion: 'Add next question',
    maxQuestions: 'A game can have up to {max} questions.',
    leaveTitle: 'Leave without saving?',
    leaveMessage: 'You have changes that have not been saved. They will be lost.',
    leaveConfirm: 'Discard changes',
    leaveStay: 'Keep editing',
    loading: 'Loading game…',
    loadFailedTitle: 'This game could not be opened',
    loadFailedBody: 'It may have been deleted, or it was created in a different browser.',
    savedNew: 'Game created.',
    savedEdit: 'Game saved.',
    fixItems: 'Fix the highlighted items, then save again.',
    saveFailed: 'Could not save the game. Your edits are still here.',
    startFailed: 'Could not start a game.',
  },
  editor: {
    question: 'Question {n}',
    moveUp: 'Move question up',
    moveDown: 'Move question down',
    duplicate: 'Duplicate question',
    remove: 'Remove question',
    questionText: 'Question Text',
    questionPlaceholder: 'Enter your question...',
    questionType: 'Question type',
    types: { mcq: 'Multiple Choice', tf: 'True / False', short: 'Short Answer' },
    answers: 'Answers',
    markCorrect: 'Mark option {n} correct',
    markCorrectTitle: 'Mark as the correct answer',
    option: 'Option {n}',
    optionA: 'Option A',
    optionB: 'Option B',
    removeOption: 'Remove option {n}',
    addOption: 'Add Option',
    addOptionHint: '(or press Enter in the last answer)',
    trueLabel: 'True',
    falseLabel: 'False',
    shortPlaceholder: 'Type the exact correct answer here...',
    correctAnswer: 'Correct answer',
    shortHint: 'Players type their answer. It must match exactly, ignoring capitals and extra spaces.',
    time: 'Time (sec)',
    timePresets: 'Time presets',
    points: 'Points',
  },
  issues: {
    text: 'Write the question players will see.',
    shortAnswer: 'Type the answer you expect.',
    emptyOptions: 'Fill in or remove the empty answers.',
    duplicateOptions: 'Two answers are the same. Players could not tell them apart.',
    chooseTrueFalse: 'Choose True or False as the right answer.',
    markCorrect: 'Mark which answer is correct.',
    time: 'Give players at least 1 second.',
    points: 'A question needs at least 1 point.',
  },
  errors: {
    network: 'Could not reach the server. Check your connection and try again.',
    rateLimited: minutes =>
      minutes <= 1
        ? 'You are doing that too often. Please try again in a minute.'
        : `You are doing that too often. Please try again in about ${minutes} minutes.`,
    quizLimit: 'You have reached the limit of {max} games. Delete one you no longer need to create another.',
    questionLimit: 'A game can have up to {max} questions.',
    tooLong: 'The title or description is too long.',
    notFound: 'This game was not found. It may have been deleted, or it was created in a different browser.',
    generic: 'Something went wrong. Please try again.',
  },
};

export const hostAr: HostStrings = {
  nav: 'استضف لعبة',
  home: { line: 'تريد إدارة اختبارك الخاص؟ لا حاجة إلى حساب.', link: 'استضف لعبة' },
  note: {
    title: 'ألعابك محفوظة في هذا المتصفح',
    body: 'لا يوجد حساب، لذلك تُحفظ ألعابك في هذا المتصفح فقط. إذا مسحت بيانات المتصفح أو استخدمت جهازاً آخر فلن تراها. وتُحذف تلقائياً الألعاب التي تمرّ نحو 6 أشهر دون استضافتها.',
  },
  status: { draft: 'مسودة', ready: 'جاهزة', archived: 'مؤرشفة' },
  list: {
    metaTitle: 'ألعابي — Skillture',
    kicker: 'استضف لعبة',
    title: 'ألعابي',
    subtitle: 'اكتب أسئلة اختبارك، واضغط «استضف الآن»، ويلعب الحاضرون من هواتفهم. لا حاجة إلى حساب.',
    create: 'أنشئ لعبة',
    createFirst: 'أنشئ لعبتك الأولى',
    searchLabel: 'ابحث في الألعاب',
    searchPlaceholder: 'ابحث في الألعاب...',
    gameCount: n => (n === 0 ? 'لا توجد ألعاب' : arCount(n, 'لعبة واحدة', 'لعبتان', 'ألعاب', 'لعبة')),
    noMatch: 'لا توجد ألعاب تطابق «{query}»',
    clearSearch: 'مسح البحث',
    loading: 'جارٍ تحميل الألعاب',
    loadErrorTitle: 'تعذّر تحميل ألعابك',
    loadErrorBody: 'تحقّق من اتصالك بالإنترنت ثم حاول مرة أخرى.',
    retry: 'حاول مرة أخرى',
    emptyTitle: 'أنشئ أول لعبة مباشرة',
    emptyIntro: 'يستغرق الأمر دقيقتين تقريباً. هكذا تسير اللعبة:',
    steps: [
      { title: 'اكتب الأسئلة', body: 'اختيار من متعدد، أو صح وخطأ، أو إجابة مكتوبة، ولكل سؤال مؤقّته الخاص.' },
      { title: 'اضغط «استضف الآن»', body: 'يظهر رمز الدخول ورمز الاستجابة السريعة (QR) على الشاشة الكبيرة، وينضم اللاعبون من هواتفهم.' },
      { title: 'أدِر اللعبة بمفتاح المسافة', body: 'تظهر الإجابات والتصويت ولوحة المتصدّرين مباشرةً، ومفتاح المسافة ينقلك إلى الخطوة التالية.' },
    ],
    questionCount: n => (n === 0 ? 'لا توجد أسئلة' : arCount(n, 'سؤال واحد', 'سؤالان', 'أسئلة', 'سؤالاً')),
    upTo: 'حتى {time}',
    edited: 'آخر تعديل {when}',
    seconds: n => `${n} ث`,
    minutes: n => `${n} د`,
    lobbyOpen: 'غرفة الانتظار مفتوحة',
    inProgress: 'اللعبة جارية',
    pin: 'رمز الدخول {pin}',
    hostNow: 'استضف الآن',
    resume: 'استأنف اللعبة',
    addQuestions: 'أضف أسئلة',
    view: 'عرض',
    edit: 'عدّل اللعبة',
    share: 'شارك الرابط',
    archive: 'أرشِف اللعبة',
    delete: 'احذف اللعبة',
    shareTitle: 'مشاركة «{title}»',
    shareHint: 'يمسح اللاعبون هذا الرمز للانضمام إلى اللعبة المباشرة التالية.',
    shareLinkLabel: 'رابط المشاركة',
    copy: 'نسخ',
    copied: 'تم النسخ',
    deleteTitle: 'حذف اللعبة',
    deleteMessage: 'ستُحذف «{title}» وكل أسئلتها وجلساتها السابقة نهائياً. لا يمكن التراجع عن ذلك.',
    deleteConfirm: 'احذف',
    cancel: 'إلغاء',
    close: 'إغلاق',
    untitled: 'بلا عنوان',
    archivedToast: 'تمت أرشفة اللعبة',
    deletedToast: 'تم حذف اللعبة',
    archiveFailed: 'تعذّرت أرشفة هذه اللعبة.',
    deleteFailed: 'تعذّر حذف هذه اللعبة.',
    startFailed: 'تعذّر بدء اللعبة.',
    needQuestions: 'أضف سؤالاً واحداً على الأقل أولاً.',
  },
  builder: {
    metaNew: 'لعبة جديدة — Skillture',
    metaEdit: 'تعديل اللعبة — Skillture',
    headingNew: 'لعبة جديدة',
    headingEdit: 'تعديل اللعبة',
    back: 'العودة إلى ألعابي',
    unsaved: 'تغييرات غير محفوظة',
    saved: 'تم حفظ كل التغييرات',
    notSaved: 'لم تُحفظ بعد',
    hostNow: 'استضف الآن',
    save: 'احفظ اللعبة',
    saving: 'جارٍ الحفظ…',
    problems: n => (n === 1 ? 'يلزم إصلاح أمر واحد قبل الحفظ:' : `يلزم إصلاح ${n} من الأمور قبل الحفظ:`),
    titleIssue: 'أعطِ اللعبة عنواناً.',
    question: 'السؤال {n}',
    settings: 'إعدادات اللعبة',
    title: 'العنوان',
    titlePlaceholder: 'مثال: مدخل إلى لغة Go',
    titleInvalid: 'أعطِ اللعبة عنواناً يتعرّف عليه اللاعبون.',
    description: 'الوصف',
    descriptionPlaceholder: 'وصف قصير لهذه اللعبة...',
    questions: 'الأسئلة',
    points: '{n} نقطة',
    upTo: 'حتى {time}',
    addQuestion: 'أضف السؤال التالي',
    maxQuestions: 'يمكن أن تضم اللعبة حتى {max} سؤال.',
    leaveTitle: 'المغادرة دون حفظ؟',
    leaveMessage: 'لديك تغييرات لم تُحفظ، وستضيع إذا غادرت.',
    leaveConfirm: 'تجاهل التغييرات',
    leaveStay: 'متابعة التعديل',
    loading: 'جارٍ تحميل اللعبة…',
    loadFailedTitle: 'تعذّر فتح هذه اللعبة',
    loadFailedBody: 'ربما حُذفت، أو أنها أُنشئت في متصفح آخر.',
    savedNew: 'تم إنشاء اللعبة.',
    savedEdit: 'تم حفظ اللعبة.',
    fixItems: 'أصلح العناصر المميّزة ثم احفظ مرة أخرى.',
    saveFailed: 'تعذّر حفظ اللعبة. تعديلاتك ما زالت هنا.',
    startFailed: 'تعذّر بدء اللعبة.',
  },
  editor: {
    question: 'السؤال {n}',
    moveUp: 'انقل السؤال إلى الأعلى',
    moveDown: 'انقل السؤال إلى الأسفل',
    duplicate: 'كرّر السؤال',
    remove: 'احذف السؤال',
    questionText: 'نص السؤال',
    questionPlaceholder: 'اكتب سؤالك...',
    questionType: 'نوع السؤال',
    types: { mcq: 'اختيار من متعدد', tf: 'صح / خطأ', short: 'إجابة قصيرة' },
    answers: 'الإجابات',
    markCorrect: 'اجعل الخيار {n} الإجابة الصحيحة',
    markCorrectTitle: 'حدّد كإجابة صحيحة',
    option: 'الخيار {n}',
    optionA: 'الخيار أ',
    optionB: 'الخيار ب',
    removeOption: 'احذف الخيار {n}',
    addOption: 'أضف خياراً',
    addOptionHint: '(أو اضغط Enter في آخر إجابة)',
    trueLabel: 'صح',
    falseLabel: 'خطأ',
    shortPlaceholder: 'اكتب الإجابة الصحيحة كما هي بالضبط...',
    correctAnswer: 'الإجابة الصحيحة',
    shortHint: 'يكتب اللاعبون إجاباتهم، ويجب أن تتطابق تماماً مع إجابتك، مع تجاهل حالة الأحرف والمسافات الزائدة.',
    time: 'الوقت (بالثواني)',
    timePresets: 'أوقات جاهزة',
    points: 'النقاط',
  },
  issues: {
    text: 'اكتب السؤال الذي سيراه اللاعبون.',
    shortAnswer: 'اكتب الإجابة المتوقعة.',
    emptyOptions: 'املأ الإجابات الفارغة أو احذفها.',
    duplicateOptions: 'هناك إجابتان متطابقتان، ولن يستطيع اللاعبون التمييز بينهما.',
    chooseTrueFalse: 'اختر «صح» أو «خطأ» كإجابة صحيحة.',
    markCorrect: 'حدّد أي الإجابات هي الصحيحة.',
    time: 'امنح اللاعبين ثانية واحدة على الأقل.',
    points: 'يحتاج السؤال إلى نقطة واحدة على الأقل.',
  },
  errors: {
    network: 'تعذّر الوصول إلى الخادم. تحقّق من اتصالك ثم حاول مرة أخرى.',
    rateLimited: minutes =>
      `لقد أجريت عدداً كبيراً من العمليات في وقت قصير. حاول مرة أخرى بعد ${
        minutes <= 1 ? 'دقيقة' : minutes === 2 ? 'دقيقتين' : minutes <= 10 ? `${minutes} دقائق` : `${minutes} دقيقة`
      }.`,
    quizLimit: 'وصلت إلى الحد الأقصى، وهو {max} لعبة. احذف لعبة لم تعد بحاجة إليها لتتمكّن من إنشاء غيرها.',
    questionLimit: 'يمكن أن تضم اللعبة حتى {max} سؤال.',
    tooLong: 'العنوان أو الوصف طويل جداً.',
    notFound: 'لم يتم العثور على هذه اللعبة. ربما حُذفت، أو أُنشئت في متصفح آخر.',
    generic: 'حدث خطأ ما. حاول مرة أخرى.',
  },
};
