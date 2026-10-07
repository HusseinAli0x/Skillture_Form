import type { Locale } from '../context/LanguageStore';
import { hostAr, hostEn, type HostStrings } from './hostSiteStrings';

/**
 * Copy for the public pages added after the original landing page: Our Work,
 * Team, the workshop detail page and the homepage sections. Kept apart from
 * translations.ts, whose shape is tied to the Homepage Editor CMS.
 */
export interface SiteStrings {
  common: { retry: string; tagline: string; skip: string; loading: string };
  nav: { ourWork: string; team: string; menu: string; joinGame: string };
  tracks: { technical: string; career: string; industry: string; business: string };
  ourWork: {
    kicker: string;
    title: string;
    subtitle: string;
    metaTitle: string;
    impact: { held: string; attendees: string; tracks: string; upcoming: string };
    upcomingTitle: string;
    archiveTitle: string;
    filterAll: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyButton: string;
    attendeesCount: (n: number) => string;
    cta: { title: string; body: string; button: string };
    loadError: string;
    cardsAlt: string;
  };
  team: {
    kicker: string;
    title: string;
    subtitle: string;
    metaTitle: string;
    groups: { leadership: string; core: string; volunteer: string; alumni: string };
    emptyTitle: string;
    emptyDescription: string;
    join: { title: string; body: string; button: string };
    linkedin: (name: string) => string;
    loadError: string;
    stationeryAlt: string;
  };
  workshop: {
    back: string;
    when: string;
    where: string;
    speaker: string;
    attendees: string;
    outcome: string;
    recap: string;
    gallery: string;
    about: string;
    register: string;
    share: string;
    copied: string;
    completed: string;
    upcoming: string;
    notFoundTitle: string;
    notFoundBody: string;
    errorTitle: string;
    errorBody: string;
    photo: (n: number, total: number) => string;
    close: string;
    prev: string;
    next: string;
    bookSimilar: string;
    registration: {
      title: string;
      intro: string;
      name: string;
      namePlaceholder: string;
      email: string;
      emailPlaceholder: string;
      submit: string;
      submitting: string;
      privacy: string;
      spotsLeft: (n: number) => string;
      errName: string;
      errNameLong: string;
      errEmail: string;
      errEmailInvalid: string;
      errEmailLong: string;
      successTitle: string;
      successBody: string;
      successAs: string;
      another: string;
      fullTitle: string;
      fullBody: string;
      closedTitle: string;
      closedBody: string;
      contactUs: string;
      externalOr: string;
      external: string;
      register: string;
      full: string;
      errors: {
        nameRequired: string;
        nameInvalid: string;
        nameTooLong: string;
        emailInvalid: string;
        notFound: string;
        ended: string;
        closed: string;
        full: string;
        already: string;
        rateLimited: string;
        network: string;
        server: string;
      };
    };
  };
  home: {
    pin: { title: string; hint: string; placeholder: string; button: string; label: string; error: string };
    ctaPrimary: string;
    ctaSecondary: string;
    participants: { title: string; body: string; steps: string[]; button: string; badgeAlt: string };
    method: { title: string; subtitle: string; steps: { label: string; body: string }[] };
    tracks: { title: string; delivered: (n: number) => string };
    results: { title: string; seeAll: string };
    upcoming: { title: string; details: string };
    team: { title: string; meet: string };
    pinsAlt: string;
    contact: {
      title: string;
      subtitle: string;
      name: string;
      email: string;
      message: string;
      namePlaceholder: string;
      emailPlaceholder: string;
      messagePlaceholder: string;
      errName: string;
      errEmail: string;
      errEmailInvalid: string;
      errMessage: string;
      errMessageLong: string;
      send: string;
      sending: string;
      successTitle: string;
      successBody: string;
      sendAnother: string;
      failure: string;
      emailDirect: string;
    };
  };
  /** Hosting a game without an account (lib/hostSiteStrings.ts). */
  host: HostStrings;
}

export const siteStrings: Record<Locale, SiteStrings> = {
  en: {
    common: {
      retry: 'Try again',
      tagline: 'Where ideas find their way.',
      skip: 'Skip to content',
      loading: 'Loading',
    },
    nav: { ourWork: 'Our Work', team: 'Team', menu: 'Menu', joinGame: 'Join game' },
    tracks: { technical: 'Technical', career: 'Career', industry: 'Industry', business: 'Business' },
    ourWork: {
      kicker: 'OUR WORK',
      title: 'Results, not claims.',
      subtitle:
        'Every workshop is measured before and after. This is what we ran, who came, and what changed.',
      metaTitle: 'Our Work — Skillture',
      impact: {
        held: 'Workshops delivered',
        attendees: 'Students reached',
        tracks: 'Tracks covered',
        upcoming: 'Coming up',
      },
      upcomingTitle: 'Coming up next',
      archiveTitle: 'Workshop archive',
      filterAll: 'All',
      emptyTitle: 'Our first recap lands here soon',
      emptyDescription:
        'Completed workshops appear here with their results and photos. Want to be one of the first? Book a workshop for your group.',
      emptyButton: 'Book a workshop',
      attendeesCount: n => `${n} attendees`,
      cta: {
        title: 'Want a Skillture workshop at your university or company?',
        body: 'Tell us about your cohort and we will design a measured session around it.',
        button: 'Bring a workshop to your campus',
      },
      loadError: 'We could not load our work right now. Check your connection and try again.',
      cardsAlt: 'A black and a turquoise Skillture business card standing on a teal surface',
    },
    team: {
      kicker: 'THE PEOPLE',
      title: 'Meet the team behind Skillture',
      subtitle: 'Students, mentors and practitioners building the bridge from classroom to career.',
      metaTitle: 'Team — Skillture',
      groups: { leadership: 'Leadership', core: 'Core team', volunteer: 'Volunteers', alumni: 'Alumni' },
      emptyTitle: 'Our team page is coming soon',
      emptyDescription: 'We are putting the faces behind Skillture together. Meanwhile, say hello and tell us what you are working on.',
      join: {
        title: 'Want to build this with us?',
        body: 'We are always looking for student volunteers, mentors and industry speakers.',
        button: 'Get in touch',
      },
      linkedin: name => `${name} on LinkedIn`,
      loadError: 'We could not load the team right now. Check your connection and try again.',
      stationeryAlt: 'Skillture stationery: letterhead, envelopes, cards and a mug laid out on a table',
    },
    workshop: {
      back: 'All workshops',
      when: 'When',
      where: 'Where',
      speaker: 'Led by',
      attendees: 'Attendees',
      outcome: 'The outcome',
      recap: 'Recap',
      gallery: 'Gallery',
      about: 'About this workshop',
      register: 'Register now',
      share: 'Share',
      copied: 'Link copied',
      completed: 'Completed',
      upcoming: 'Upcoming',
      notFoundTitle: 'Workshop not found',
      notFoundBody: 'It may have been removed, or the link is incorrect. The full list is one tap away.',
      errorTitle: 'We could not load this workshop',
      errorBody: 'Check your connection and try again.',
      photo: (n, total) => `Photo ${n} of ${total}`,
      close: 'Close',
      prev: 'Previous photo',
      next: 'Next photo',
      bookSimilar: 'Book a session like this',
      registration: {
        title: 'Register for this workshop',
        intro: 'Save your place with your name and email. It takes under a minute.',
        name: 'Full name',
        namePlaceholder: 'Your full name',
        email: 'Email',
        emailPlaceholder: 'you@example.com',
        submit: 'Register',
        submitting: 'Registering…',
        privacy: 'We use your name and email only to organise this workshop.',
        spotsLeft: n => (n === 1 ? 'Only 1 spot left' : `${n} spots left`),
        errName: 'Please enter your name.',
        errNameLong: 'That name is too long. Please keep it under 120 characters.',
        errEmail: 'Please enter your email so we can reach you about this workshop.',
        errEmailInvalid: 'That email does not look right. Check for a missing @ or domain.',
        errEmailLong: 'That email is too long. Please use an address under 254 characters.',
        successTitle: 'You are registered',
        successBody: 'Your place is saved. Here is what we have for you.',
        successAs: 'Registered as',
        another: 'Register someone else',
        fullTitle: 'This workshop is full',
        fullBody:
          'Every seat has been taken. Tell us about your group and we can plan a session for you, or look out for the next workshop.',
        closedTitle: 'Registration is closed',
        closedBody: 'This workshop is not taking sign-ups right now. Get in touch if you would like to attend.',
        contactUs: 'Contact us',
        externalOr: 'or',
        external: 'register on the organiser’s site',
        register: 'Register now',
        full: 'Full',
        errors: {
          nameRequired: 'Please enter your name.',
          nameInvalid: 'That name cannot be used. Please check it and try again.',
          nameTooLong: 'That name is too long. Please keep it under 120 characters.',
          emailInvalid: 'That email does not look right. Check for a missing @ or domain.',
          notFound: 'We could not find this workshop. It may have been removed.',
          ended: 'This workshop has already taken place, so registration is closed.',
          closed: 'Registration for this workshop has just closed.',
          full: 'Sorry, the last seat was just taken. This workshop is now full.',
          already: 'This email is already registered for this workshop. You are all set.',
          rateLimited: 'Too many attempts from your connection. Please wait a few minutes and try again.',
          network: 'We could not reach the server. Check your connection and try again.',
          server: 'Something went wrong on our side. Your details are still here. Please try again in a moment.',
        },
      },
    },
    home: {
      pin: {
        title: 'Got a PIN? Join in two taps.',
        hint: "Type the 6-digit code on the host's screen.",
        placeholder: '000000',
        button: 'Join game',
        label: 'Game PIN',
        error: "The PIN is 6 digits. You'll find it on the host's screen.",
      },
      ctaPrimary: 'Book a workshop',
      ctaSecondary: 'See our work',
      participants: {
        title: 'In the room? Your phone is the answer sheet.',
        body: 'Every workshop ends with a live quiz. No app to install and no account to make.',
        steps: [
          "Get the 6-digit PIN from the host's screen.",
          'Pick a nickname.',
          'Answer each question as it appears and watch the board move.',
        ],
        button: 'Join a game',
        badgeAlt: 'A black Skillture lanyard ID card hanging against a patterned white background',
      },
      method: {
        title: 'Every workshop is measured twice.',
        subtitle: 'That is how we know what actually changed.',
        steps: [
          { label: 'Before', body: 'A short form asks the cohort what they already know, in Arabic or English.' },
          { label: 'During', body: 'A practitioner runs the session. Students join a live quiz on their phones with a PIN.' },
          { label: 'After', body: 'The same questions again. The gap between the two results is what we publish.' },
        ],
      },
      tracks: { title: 'What we teach', delivered: n => `${n} delivered` },
      results: { title: 'What the latest sessions delivered', seeAll: 'See all our work' },
      upcoming: { title: 'Coming up', details: 'Details' },
      team: { title: 'The people behind it', meet: 'Meet the team' },
      pinsAlt: 'A pile of turquoise Skillture badge pins',
      contact: {
        title: 'Book a workshop',
        subtitle:
          'Tell us who the cohort is, how many people, and what they need to get better at. We will come back with a measured session designed around it. Questions are welcome too.',
        name: 'Your name',
        email: 'Email',
        message: 'About your group or question',
        namePlaceholder: 'Full name',
        emailPlaceholder: 'you@example.com',
        messagePlaceholder: 'e.g. 60 second-year engineering students, interested in career skills in spring',
        errName: 'Please enter your name.',
        errEmail: 'Please enter your email so we can reply.',
        errEmailInvalid: 'That email does not look right. Check for a missing @ or domain.',
        errMessage: 'Please tell us a little about what you need.',
        errMessageLong: 'That is a bit long. Please keep it under 5,000 characters.',
        send: 'Send message',
        sending: 'Sending…',
        successTitle: 'Message sent',
        successBody: 'Thank you. We read every message and will reply to the email you gave.',
        sendAnother: 'Send another message',
        failure: 'We could not send your message. Your text is still here. Try again, or email us directly.',
        emailDirect: 'Or write to us at',
      },
    },
    host: hostEn,
  },
  ar: {
    common: {
      retry: 'حاول مرة أخرى',
      tagline: 'حيث تجد الأفكار طريقها.',
      skip: 'تخطَّ إلى المحتوى',
      loading: 'جارٍ التحميل',
    },
    nav: { ourWork: 'أعمالنا', team: 'الفريق', menu: 'القائمة', joinGame: 'انضم للعبة' },
    tracks: { technical: 'تقني', career: 'مهني', industry: 'الصناعة', business: 'الأعمال' },
    ourWork: {
      kicker: 'أعمالنا',
      title: 'نتائج، لا ادّعاءات.',
      subtitle: 'كل ورشة ننظّمها تُقاس نتائجها. هذا ما قدّمناه، ومن حضر، وماذا تعلّموا.',
      metaTitle: 'أعمالنا — سكيلتشر',
      impact: {
        held: 'ورشة منفّذة',
        attendees: 'طالب وصلنا إليهم',
        tracks: 'مسارات مغطّاة',
        upcoming: 'قريباً',
      },
      upcomingTitle: 'الورشات القادمة',
      archiveTitle: 'أرشيف الورشات',
      filterAll: 'الكل',
      emptyTitle: 'ملخّص أول ورشة سيظهر هنا قريباً',
      emptyDescription: 'تظهر هنا الورشات المنتهية مع نتائجها وصورها. تريد أن تكون من الأوائل؟ احجز ورشة لمجموعتك.',
      emptyButton: 'احجز ورشة',
      attendeesCount: n => `${n} حاضر`,
      cta: {
        title: 'تريد ورشة من سكيلتشر في جامعتك أو شركتك؟',
        body: 'أخبرنا عن مجموعتك وسنصمّم لها جلسة قابلة للقياس.',
        button: 'استضف ورشة في جامعتك',
      },
      loadError: 'تعذّر تحميل أعمالنا الآن. تحقّق من اتصالك وحاول مرة أخرى.',
      cardsAlt: 'بطاقتا أعمال لسكيلتشر، سوداء وفيروزية، قائمتان على سطح بلون التيل',
    },
    team: {
      kicker: 'الأشخاص',
      title: 'تعرّف على الفريق خلف سكيلتشر',
      subtitle: 'طلاب ومرشدون وخبراء يبنون الجسر بين قاعة الدراسة وسوق العمل.',
      metaTitle: 'الفريق — سكيلتشر',
      groups: { leadership: 'القيادة', core: 'الفريق الأساسي', volunteer: 'المتطوعون', alumni: 'الخريجون' },
      emptyTitle: 'صفحة الفريق قادمة قريباً',
      emptyDescription: 'نجهّز وجوه الفريق خلف سكيلتشر. في الأثناء، راسلنا وأخبرنا بما تعمل عليه.',
      join: {
        title: 'تريد أن تبني هذا معنا؟',
        body: 'نبحث دائماً عن طلاب متطوعين ومرشدين ومتحدثين من الصناعة.',
        button: 'تواصل معنا',
      },
      linkedin: name => `${name} على لينكدإن`,
      loadError: 'تعذّر تحميل الفريق الآن. تحقّق من اتصالك وحاول مرة أخرى.',
      stationeryAlt: 'قرطاسية سكيلتشر: ورق رسمي وأظرف وبطاقات وكوب على طاولة',
    },
    workshop: {
      back: 'كل الورشات',
      when: 'الموعد',
      where: 'المكان',
      speaker: 'يقدّمها',
      attendees: 'الحضور',
      outcome: 'النتيجة',
      recap: 'ملخّص الورشة',
      gallery: 'معرض الصور',
      about: 'عن الورشة',
      register: 'سجّل الآن',
      share: 'مشاركة',
      copied: 'تم نسخ الرابط',
      completed: 'منتهية',
      upcoming: 'قادمة',
      notFoundTitle: 'الورشة غير موجودة',
      notFoundBody: 'ربما تمت إزالتها أو أن الرابط غير صحيح. قائمة كل الورشات على بعد نقرة.',
      errorTitle: 'تعذّر تحميل هذه الورشة',
      errorBody: 'تحقّق من اتصالك وحاول مرة أخرى.',
      photo: (n, total) => `صورة ${n} من ${total}`,
      close: 'إغلاق',
      prev: 'الصورة السابقة',
      next: 'الصورة التالية',
      bookSimilar: 'احجز جلسة مثل هذه',
      registration: {
        title: 'سجّل في هذه الورشة',
        intro: 'احجز مكانك باسمك وبريدك الإلكتروني. لن يستغرق الأمر أكثر من دقيقة.',
        name: 'الاسم الكامل',
        namePlaceholder: 'اسمك الكامل',
        email: 'البريد الإلكتروني',
        emailPlaceholder: 'you@example.com',
        submit: 'سجّل',
        submitting: 'جارٍ التسجيل…',
        privacy: 'نستخدم اسمك وبريدك الإلكتروني فقط لتنظيم هذه الورشة.',
        spotsLeft: n => (n === 1 ? 'بقي مقعد واحد فقط' : n === 2 ? 'بقي مقعدان فقط' : n <= 10 ? `بقيت ${n} مقاعد` : `بقي ${n} مقعداً`),
        errName: 'يرجى إدخال اسمك.',
        errNameLong: 'الاسم طويل جداً. يرجى ألا يتجاوز 120 حرفاً.',
        errEmail: 'يرجى إدخال بريدك الإلكتروني لنتمكّن من التواصل معك بشأن الورشة.',
        errEmailInvalid: 'يبدو أن البريد الإلكتروني غير صحيح. تأكّد من وجود @ واسم النطاق.',
        errEmailLong: 'البريد الإلكتروني طويل جداً. يرجى ألا يتجاوز 254 حرفاً.',
        successTitle: 'تم تسجيلك',
        successBody: 'تم حفظ مكانك. هذه هي بياناتك وتفاصيل الورشة.',
        successAs: 'سُجّل باسم',
        another: 'سجّل شخصاً آخر',
        fullTitle: 'اكتمل العدد في هذه الورشة',
        fullBody: 'تم حجز جميع المقاعد. أخبرنا عن مجموعتك وسنخطّط لجلسة مناسبة لكم، أو تابع الورشة القادمة.',
        closedTitle: 'التسجيل مغلق',
        closedBody: 'هذه الورشة لا تستقبل تسجيلات حالياً. تواصل معنا إن رغبت في الحضور.',
        contactUs: 'تواصل معنا',
        externalOr: 'أو',
        external: 'سجّل عبر موقع الجهة المنظّمة',
        register: 'سجّل الآن',
        full: 'اكتمل العدد',
        errors: {
          nameRequired: 'يرجى إدخال اسمك.',
          nameInvalid: 'لا يمكن استخدام هذا الاسم. تحقّق منه وحاول مرة أخرى.',
          nameTooLong: 'الاسم طويل جداً. يرجى ألا يتجاوز 120 حرفاً.',
          emailInvalid: 'يبدو أن البريد الإلكتروني غير صحيح. تأكّد من وجود @ واسم النطاق.',
          notFound: 'تعذّر العثور على هذه الورشة. ربما تمت إزالتها.',
          ended: 'انتهت هذه الورشة بالفعل، لذا أُغلق التسجيل.',
          closed: 'تم إغلاق التسجيل في هذه الورشة للتو.',
          full: 'عذراً، تم حجز آخر مقعد للتو. اكتمل العدد في هذه الورشة.',
          already: 'هذا البريد الإلكتروني مسجّل بالفعل في هذه الورشة. لا حاجة لأي إجراء إضافي.',
          rateLimited: 'محاولات كثيرة من اتصالك. يرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.',
          network: 'تعذّر الوصول إلى الخادم. تحقّق من اتصالك وحاول مرة أخرى.',
          server: 'حدث خطأ من جانبنا. بياناتك ما زالت هنا. يرجى المحاولة مرة أخرى بعد قليل.',
        },
      },
    },
    home: {
      pin: {
        title: 'معك رمز؟ انضم بنقرتين.',
        hint: 'اكتب الرمز المكوّن من 6 أرقام من شاشة المقدّم.',
        placeholder: '000000',
        button: 'انضم للعبة',
        label: 'رمز اللعبة',
        error: 'الرمز مكوّن من 6 أرقام. ستجده على شاشة المقدّم.',
      },
      ctaPrimary: 'احجز ورشة',
      ctaSecondary: 'شاهد أعمالنا',
      participants: {
        title: 'أنت في القاعة؟ هاتفك هو ورقة الإجابة.',
        body: 'تنتهي كل ورشة باختبار مباشر. لا تطبيق للتثبيت ولا حساب لإنشائه.',
        steps: [
          'خذ الرمز المكوّن من 6 أرقام من شاشة المقدّم.',
          'اختر اسماً مستعاراً.',
          'أجب عن كل سؤال فور ظهوره وتابع تقدّم اللوحة.',
        ],
        button: 'انضم للعبة',
        badgeAlt: 'بطاقة تعريف سوداء من سكيلتشر معلّقة بحبل أمام خلفية بيضاء منقوشة',
      },
      method: {
        title: 'كل ورشة تُقاس مرتين.',
        subtitle: 'بهذه الطريقة نعرف ما الذي تغيّر فعلاً.',
        steps: [
          { label: 'قبل', body: 'نموذج قصير يسأل المجموعة عمّا تعرفه مسبقاً، بالعربية أو الإنجليزية.' },
          { label: 'أثناء', body: 'يقود خبير الجلسة، وينضم الطلاب إلى اختبار مباشر من هواتفهم باستخدام الرمز.' },
          { label: 'بعد', body: 'الأسئلة نفسها مرة أخرى. الفرق بين النتيجتين هو ما ننشره.' },
        ],
      },
      tracks: { title: 'ما الذي ندرّب عليه', delivered: n => `${n} منفّذة` },
      results: { title: 'ما حقّقته أحدث جلساتنا', seeAll: 'شاهد كل أعمالنا' },
      upcoming: { title: 'قريباً', details: 'التفاصيل' },
      team: { title: 'الأشخاص خلف العمل', meet: 'تعرّف على الفريق' },
      pinsAlt: 'كومة من دبابيس سكيلتشر الفيروزية',
      contact: {
        title: 'احجز ورشة',
        subtitle:
          'أخبرنا من هي المجموعة، وكم عدد أفرادها، وفي ماذا يحتاجون إلى التحسّن. سنعود إليك بجلسة قابلة للقياس مصمَّمة لهم. ويسعدنا أيضاً أن تسأل.',
        name: 'اسمك',
        email: 'البريد الإلكتروني',
        message: 'عن مجموعتك أو سؤالك',
        namePlaceholder: 'الاسم الكامل',
        emailPlaceholder: 'you@example.com',
        messagePlaceholder: 'مثال: 60 طالب هندسة في السنة الثانية، يهمّهم تطوير المهارات المهنية في الربيع',
        errName: 'يرجى إدخال اسمك.',
        errEmail: 'يرجى إدخال بريدك الإلكتروني لنتمكّن من الرد.',
        errEmailInvalid: 'يبدو أن البريد الإلكتروني غير صحيح. تأكّد من وجود @ واسم النطاق.',
        errMessage: 'يرجى إخبارنا قليلاً عمّا تحتاجه.',
        errMessageLong: 'الرسالة طويلة قليلاً. يرجى ألا تتجاوز 5000 حرف.',
        send: 'إرسال الرسالة',
        sending: 'جارٍ الإرسال…',
        successTitle: 'تم إرسال الرسالة',
        successBody: 'شكراً لك. نقرأ كل رسالة وسنردّ على البريد الذي أدخلته.',
        sendAnother: 'إرسال رسالة أخرى',
        failure: 'تعذّر إرسال رسالتك. نصّك ما زال هنا. حاول مرة أخرى، أو راسلنا مباشرة.',
        emailDirect: 'أو راسلنا على',
      },
    },
    host: hostAr,
  },
};
