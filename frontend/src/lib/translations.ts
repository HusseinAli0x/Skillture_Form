import type { Locale } from '../context/LanguageStore';

/**
 * Static UI copy for the public site (Navbar + HomePage), in English and
 * Arabic. Scope note: the Hero/About/What-We-Offer paragraph copy is also
 * editable by an admin through the Homepage Editor CMS (see
 * homepage_handler.go / HomepageEditor.tsx) — that content lives in the
 * database in English only. Rather than migrating it to bilingual JSONB (a
 * separate, larger change to the CMS), the English locale reads the live
 * admin-edited text and the Arabic locale falls back to a professional
 * translation of that copy's current default, keyed here under `about`/
 * `offer`/`hero`. Workshops and Contact are fully dynamic in both languages
 * (workshops are stored as bilingual JSONB from the start — see
 * 0005_workshops.up.sql).
 */
export interface Translations {
  nav: {
    home: string;
    about: string;
    offer: string;
    workshops: string;
    contact: string;
    language: string;
  };
  hero: {
    kicker: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  about: {
    kicker: string;
    title: string;
    body1: string;
    body2: string;
    facts: { value: string; label: string }[];
  };
  offer: {
    kicker: string;
    title: string;
    subtitle: string;
    pillars: { title: string; description: string; points: string[] }[];
  };
  workshops: {
    kicker: string;
    title: string;
    subtitle: string;
    dateLabel: string;
    timeLabel: string;
    viewDetails: string;
    close: string;
    emptyTitle: string;
    emptyDescription: string;
  };
  contact: {
    kicker: string;
    title: string;
    subtitle: string;
    emailLabel: string;
    linkedinLabel: string;
    formTitle: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    messagePlaceholder: string;
    send: string;
    sending: string;
    success: string;
    error: string;
  };
  footer: {
    rights: string;
    privacy: string;
    terms: string;
  };
}

export const translations: Record<Locale, Translations> = {
  en: {
    nav: {
      home: 'Home',
      about: 'About',
      offer: 'What We Offer',
      workshops: 'Upcoming Workshops',
      contact: 'Contact',
      language: 'العربية',
    },
    hero: {
      kicker: 'SKILL ASSESSMENT & LIVE LEARNING',
      title: 'From university to industry — one measured step at a time.',
      subtitle:
        'Skillture is the assessment platform behind student-led workshops: multilingual forms to capture what a cohort knows, and live PIN-joined quizzes to prove what they learned.',
      ctaPrimary: 'Explore Upcoming Workshops',
      ctaSecondary: 'See a Live Session',
    },
    about: {
      kicker: 'About Us',
      title: 'Built by students who were tired of guessing.',
      body1:
        'Skillture began in a university lab where nobody could answer a simple question: which skills does a graduate actually have on the day they walk into industry? Transcripts said one thing, hiring interviews said another, and the gap between them was where good people got lost.',
      body2:
        'So we built the measurement layer we wanted for ourselves — a form builder for honest self-assessment in any language, and a live quiz engine that makes progress visible in the room. Today the same tooling runs cohort workshops, university programmes, and industry onboarding.',
      facts: [
        { value: '2,400+', label: 'Students assessed across cohort programmes' },
        { value: '18', label: 'Partner universities and industry teams' },
        { value: '9', label: 'Languages supported in form and quiz labels' },
      ],
    },
    offer: {
      kicker: 'What We Offer',
      title: 'Four tracks, one journey.',
      subtitle:
        'Every track uses the same two tools — forms to measure, live quizzes to practise — pointed at a different part of the leap from study to work.',
      pillars: [
        {
          title: 'Technical',
          description: 'Close the distance between coursework and the codebase a team actually ships.',
          points: ['Skill-gap diagnostics per stack', 'Live code-concept quizzes', 'Progress tracked across a cohort'],
        },
        {
          title: 'Career',
          description: 'Turn a transcript into a story a hiring manager can read in a minute.',
          points: ['Strengths mapping from responses', 'Interview drill sessions', 'AI-summarised progress reports'],
        },
        {
          title: 'Industry',
          description: 'Meet the people who do the work, and find out what they wish you knew.',
          points: ['Practitioner-led workshops', 'Real-brief case sessions', 'Company onboarding assessments'],
        },
        {
          title: 'Business',
          description: 'Understand the commercial side that surrounds every technical decision.',
          points: ['Product and pricing fundamentals', 'Stakeholder communication labs', 'Team simulation quizzes'],
        },
      ],
    },
    workshops: {
      kicker: 'Our Workshops',
      title: 'Upcoming Workshops',
      subtitle: 'Small cohorts, a live host, and a leaderboard that updates as the room learns.',
      dateLabel: 'Date',
      timeLabel: 'Time',
      viewDetails: 'View Details',
      close: 'Close',
      emptyTitle: 'No workshops scheduled yet',
      emptyDescription: 'Check back soon — new sessions are announced here as soon as they open.',
    },
    contact: {
      kicker: 'Get in Touch',
      title: 'Contact Us',
      subtitle: "Questions about a workshop, a partnership, or the platform? We'd love to hear from you.",
      emailLabel: 'Email',
      linkedinLabel: 'LinkedIn',
      formTitle: 'Send us a message',
      namePlaceholder: 'Your name',
      emailPlaceholder: 'you@example.com',
      messagePlaceholder: 'How can we help?',
      send: 'Send Message',
      sending: 'Sending…',
      success: "Message sent — we'll get back to you soon.",
      error: 'Failed to send your message. Please try again.',
    },
    footer: {
      rights: 'All rights reserved.',
      privacy: 'Privacy',
      terms: 'Terms',
    },
  },
  ar: {
    nav: {
      home: 'الرئيسية',
      about: 'من نحن',
      offer: 'ماذا نقدم',
      workshops: 'الورشات القادمة',
      contact: 'تواصل معنا',
      language: 'English',
    },
    hero: {
      kicker: 'تقييم المهارات والتعلم المباشر',
      title: 'من الجامعة إلى سوق العمل — خطوة مدروسة في كل مرة.',
      subtitle:
        'سكيلتشر هي منصة التقييم وراء الورشات التي يقودها الطلاب: نماذج متعددة اللغات لرصد ما يعرفه الفوج، واختبارات مباشرة عبر رمز PIN لإثبات ما تعلموه.',
      ctaPrimary: 'اكتشف الورشات القادمة',
      ctaSecondary: 'شاهد جلسة مباشرة',
    },
    about: {
      kicker: 'من نحن',
      title: 'بناه طلاب سئموا التخمين.',
      body1:
        'بدأت سكيلتشر في مختبر جامعي لم يستطع أحد فيه الإجابة عن سؤال بسيط: ما هي المهارات التي يمتلكها الخريج فعليًا يوم دخوله سوق العمل؟ السجل الأكاديمي يقول شيئًا، ومقابلات التوظيف تقول شيئًا آخر، وفي تلك الفجوة كان يضيع أشخاص جيدون.',
      body2:
        'لذلك بنينا طبقة القياس التي كنا نتمناها لأنفسنا — أداة لبناء نماذج تقييم ذاتي صادقة بأي لغة، ومحرك اختبارات مباشر يجعل التقدم مرئيًا داخل الغرفة. اليوم تُشغّل نفس الأدوات ورشات الأفواج والبرامج الجامعية وتأهيل الموظفين الجدد.',
      facts: [
        { value: '2,400+', label: 'طالب تم تقييمهم عبر برامج الأفواج' },
        { value: '18', label: 'جامعة وفريق صناعي شريك' },
        { value: '9', label: 'لغات مدعومة في النماذج والاختبارات' },
      ],
    },
    offer: {
      kicker: 'ماذا نقدم',
      title: 'أربعة مسارات، رحلة واحدة.',
      subtitle:
        'كل مسار يستخدم نفس الأداتين — نماذج للقياس، واختبارات مباشرة للتدرّب — موجهتين نحو جزء مختلف من القفزة من الدراسة إلى العمل.',
      pillars: [
        {
          title: 'تقني',
          description: 'تقليص الفجوة بين المقررات الدراسية والكود الذي يشحنه الفريق فعليًا.',
          points: ['تشخيص فجوات المهارات لكل تقنية', 'اختبارات مباشرة لمفاهيم البرمجة', 'تتبع التقدم عبر الفوج'],
        },
        {
          title: 'مهني',
          description: 'حوّل السجل الأكاديمي إلى قصة يقرأها مدير التوظيف في دقيقة واحدة.',
          points: ['رسم نقاط القوة من الإجابات', 'جلسات تدريب على المقابلات', 'تقارير تقدم ملخصة بالذكاء الاصطناعي'],
        },
        {
          title: 'صناعي',
          description: 'تعرّف على من يمارسون العمل فعليًا، واكتشف ما كانوا يتمنون معرفته.',
          points: ['ورشات يقودها ممارسون', 'جلسات حالات عملية واقعية', 'تقييمات تأهيل الموظفين الجدد'],
        },
        {
          title: 'أعمال',
          description: 'افهم الجانب التجاري المحيط بكل قرار تقني.',
          points: ['أساسيات المنتج والتسعير', 'ورشات التواصل مع أصحاب المصلحة', 'اختبارات محاكاة الفريق'],
        },
      ],
    },
    workshops: {
      kicker: 'ورشاتنا',
      title: 'الورشات القادمة',
      subtitle: 'أفواج صغيرة، مضيف مباشر، ولوحة صدارة تتحدث مع تعلم الغرفة.',
      dateLabel: 'التاريخ',
      timeLabel: 'الوقت',
      viewDetails: 'عرض التفاصيل',
      close: 'إغلاق',
      emptyTitle: 'لا توجد ورشات مجدولة حاليًا',
      emptyDescription: 'تابعونا قريبًا — سيتم الإعلان عن الجلسات الجديدة هنا فور فتحها.',
    },
    contact: {
      kicker: 'تواصل معنا',
      title: 'اتصل بنا',
      subtitle: 'لديك أسئلة حول ورشة عمل أو شراكة أو المنصة؟ يسعدنا أن نسمع منك.',
      emailLabel: 'البريد الإلكتروني',
      linkedinLabel: 'لينكدإن',
      formTitle: 'أرسل لنا رسالة',
      namePlaceholder: 'اسمك',
      emailPlaceholder: 'you@example.com',
      messagePlaceholder: 'كيف يمكننا المساعدة؟',
      send: 'إرسال الرسالة',
      sending: 'جارٍ الإرسال…',
      success: 'تم إرسال الرسالة — سنتواصل معك قريبًا.',
      error: 'فشل إرسال رسالتك. حاول مرة أخرى.',
    },
    footer: {
      rights: 'جميع الحقوق محفوظة.',
      privacy: 'الخصوصية',
      terms: 'الشروط',
    },
  },
};
