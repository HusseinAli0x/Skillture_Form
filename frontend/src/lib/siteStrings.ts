import type { Locale } from '../context/LanguageStore';

/**
 * Copy for the public pages added after the original landing page: Our Work,
 * Team, the workshop detail page and the homepage teasers. Kept apart from
 * translations.ts, whose shape is tied to the Homepage Editor CMS.
 */
export interface SiteStrings {
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
    attendeesCount: (n: number) => string;
    cta: { title: string; body: string; button: string };
    loadError: string;
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
    photo: (n: number, total: number) => string;
    close: string;
    prev: string;
    next: string;
  };
  home: {
    pin: { title: string; hint: string; placeholder: string; button: string; label: string };
    ctaPrimary: string;
    ctaSecondary: string;
    method: { title: string; subtitle: string; steps: { label: string; body: string }[] };
    tracks: { title: string; delivered: (n: number) => string };
    results: { title: string; seeAll: string };
    upcoming: { title: string; details: string };
    team: { title: string; meet: string };
  };
}

export const siteStrings: Record<Locale, SiteStrings> = {
  en: {
    nav: { ourWork: 'Our Work', team: 'Team', menu: 'Menu', joinGame: 'Join a game' },
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
      emptyDescription: 'Completed workshops appear here with their results and photos.',
      attendeesCount: n => `${n} attendees`,
      cta: {
        title: 'Want a Skillture workshop at your university or company?',
        body: 'Tell us about your cohort and we will design a measured session around it.',
        button: 'Bring a workshop to your campus',
      },
      loadError: 'We could not load our work right now. Please try again shortly.',
    },
    team: {
      kicker: 'THE PEOPLE',
      title: 'Meet the team behind Skillture',
      subtitle: 'Students, mentors and practitioners building the bridge from classroom to career.',
      metaTitle: 'Team — Skillture',
      groups: { leadership: 'Leadership', core: 'Core team', volunteer: 'Volunteers', alumni: 'Alumni' },
      emptyTitle: 'Our team page is coming soon',
      emptyDescription: 'We are putting the faces behind Skillture together. Check back shortly.',
      join: {
        title: 'Want to build this with us?',
        body: 'We are always looking for student volunteers, mentors and industry speakers.',
        button: 'Get in touch',
      },
      linkedin: name => `${name} on LinkedIn`,
      loadError: 'We could not load the team right now. Please try again shortly.',
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
      notFoundBody: 'It may have been removed, or the link is incorrect.',
      photo: (n, total) => `Photo ${n} of ${total}`,
      close: 'Close',
      prev: 'Previous photo',
      next: 'Next photo',
    },
    home: {
      pin: {
        title: 'Joining a live quiz?',
        hint: "Enter the PIN on the host's screen.",
        placeholder: '123456',
        button: 'Join',
        label: 'Game PIN',
      },
      ctaPrimary: 'See our work',
      ctaSecondary: 'Meet the team',
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
    },
  },
  ar: {
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
      emptyDescription: 'تظهر هنا الورشات المنتهية مع نتائجها وصورها.',
      attendeesCount: n => `${n} حاضر`,
      cta: {
        title: 'تريد ورشة من سكيلتشر في جامعتك أو شركتك؟',
        body: 'أخبرنا عن مجموعتك وسنصمّم لها جلسة قابلة للقياس.',
        button: 'استضف ورشة في جامعتك',
      },
      loadError: 'تعذّر تحميل أعمالنا الآن. يرجى المحاولة بعد قليل.',
    },
    team: {
      kicker: 'الأشخاص',
      title: 'تعرّف على الفريق خلف سكيلتشر',
      subtitle: 'طلاب ومرشدون وخبراء يبنون الجسر بين قاعة الدراسة وسوق العمل.',
      metaTitle: 'الفريق — سكيلتشر',
      groups: { leadership: 'القيادة', core: 'الفريق الأساسي', volunteer: 'المتطوعون', alumni: 'الخريجون' },
      emptyTitle: 'صفحة الفريق قادمة قريباً',
      emptyDescription: 'نجهّز وجوه الفريق خلف سكيلتشر. عد قريباً.',
      join: {
        title: 'تريد أن تبني هذا معنا؟',
        body: 'نبحث دائماً عن طلاب متطوعين ومرشدين ومتحدثين من الصناعة.',
        button: 'تواصل معنا',
      },
      linkedin: name => `${name} على لينكدإن`,
      loadError: 'تعذّر تحميل الفريق الآن. يرجى المحاولة بعد قليل.',
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
      notFoundBody: 'ربما تمت إزالتها أو أن الرابط غير صحيح.',
      photo: (n, total) => `صورة ${n} من ${total}`,
      close: 'إغلاق',
      prev: 'الصورة السابقة',
      next: 'الصورة التالية',
    },
    home: {
      pin: {
        title: 'هل تنضم إلى اختبار مباشر؟',
        hint: 'أدخل الرمز الظاهر على شاشة المقدّم.',
        placeholder: '123456',
        button: 'انضمام',
        label: 'رمز اللعبة',
      },
      ctaPrimary: 'شاهد أعمالنا',
      ctaSecondary: 'تعرّف على الفريق',
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
    },
  },
};
