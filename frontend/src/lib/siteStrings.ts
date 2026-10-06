import type { Locale } from '../context/LanguageStore';

/**
 * Copy for the public pages added after the original landing page: Our Work,
 * Team, the workshop detail page and the homepage teasers. Kept apart from
 * translations.ts, whose shape is tied to the Homepage Editor CMS.
 */
export interface SiteStrings {
  nav: { ourWork: string; team: string; menu: string };
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
    workKicker: string;
    workTitle: string;
    workSubtitle: string;
    seeAll: string;
    teamKicker: string;
    teamTitle: string;
    teamSubtitle: string;
    meetTeam: string;
  };
}

export const siteStrings: Record<Locale, SiteStrings> = {
  en: {
    nav: { ourWork: 'Our Work', team: 'Team', menu: 'Menu' },
    tracks: { technical: 'Technical', career: 'Career', industry: 'Industry', business: 'Business' },
    ourWork: {
      kicker: 'OUR WORK',
      title: 'Proof, not promises.',
      subtitle:
        'Every workshop we run is measured. Here is what we have delivered, who showed up, and what they learned.',
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
      workKicker: 'OUR WORK',
      workTitle: 'Recent workshops, measured',
      workSubtitle: 'Real cohorts, real results — see what our latest sessions delivered.',
      seeAll: 'See all our work',
      teamKicker: 'THE TEAM',
      teamTitle: 'The people behind the platform',
      teamSubtitle: 'A student-led team with industry mentors on call.',
      meetTeam: 'Meet the team',
    },
  },
  ar: {
    nav: { ourWork: 'أعمالنا', team: 'الفريق', menu: 'القائمة' },
    tracks: { technical: 'تقني', career: 'مهني', industry: 'الصناعة', business: 'الأعمال' },
    ourWork: {
      kicker: 'أعمالنا',
      title: 'نتائج لا وعود.',
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
      workKicker: 'أعمالنا',
      workTitle: 'أحدث الورشات بنتائجها',
      workSubtitle: 'مجموعات حقيقية ونتائج حقيقية — اطّلع على ما حقّقته جلساتنا الأخيرة.',
      seeAll: 'شاهد كل أعمالنا',
      teamKicker: 'الفريق',
      teamTitle: 'الأشخاص خلف المنصّة',
      teamSubtitle: 'فريق يقوده الطلاب مع مرشدين من الصناعة.',
      meetTeam: 'تعرّف على الفريق',
    },
  },
};
