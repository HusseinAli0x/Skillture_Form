import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Calendar, Clock, Gamepad2, Mail, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import client from '../api/client';
import { Button, Spinner } from '../components/ui';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { setupScrollJourney } from '../lib/scrollJourney';
import { useLanguageStore } from '../context/LanguageStore';
import { translations } from '../lib/translations';
import { localized } from '../lib/i18n';
import { useToastStore } from '../context/ToastStore';
import { apiErrorMessage } from '../lib/apiError';

interface AboutFact {
  id: string;
  value: string;
  label: string;
}

interface OfferPillar {
  id: string;
  num: string;
  title: string;
  description: string;
  points: string[];
}

interface HomepageContent {
  hero_kicker: string;
  hero_title: string;
  hero_subtitle: string;
  about_kicker: string;
  about_title: string;
  about_body1: string;
  about_body2: string;
  about_facts: AboutFact[];
  offer_kicker: string;
  offer_title: string;
  offer_subtitle: string;
  offer_pillars: OfferPillar[];
}

interface Workshop {
  id: string;
  title: Record<string, string>;
  description: Record<string, string>;
  extra_info?: Record<string, string> | null;
  image_path: string | null;
  event_date: string;
  event_time: string | null;
}

// English defaults for the parts of Hero/About/Offer that are also editable
// through the Homepage Editor CMS (homepage_content) — see translations.ts
// for why Arabic falls back to static copy instead.
const DEFAULT_CONTENT: HomepageContent = {
  hero_kicker: translations.en.hero.kicker,
  hero_title: translations.en.hero.title,
  hero_subtitle: translations.en.hero.subtitle,
  about_kicker: translations.en.about.kicker,
  about_title: translations.en.about.title,
  about_body1: translations.en.about.body1,
  about_body2: translations.en.about.body2,
  about_facts: translations.en.about.facts.map((f, i) => ({ id: `f${i}`, ...f })),
  offer_kicker: translations.en.offer.kicker,
  offer_title: translations.en.offer.title,
  offer_subtitle: translations.en.offer.subtitle,
  offer_pillars: translations.en.offer.pillars.map((p, i) => ({
    id: `p${i}`,
    num: String(i + 1).padStart(2, '0'),
    ...p,
  })),
};

// Placeholders — replace with the real contact details.
const CONTACT_EMAIL = 'hello@skillture.com';
const CONTACT_LINKEDIN = 'https://www.linkedin.com/company/skillture';

const STATION_IDS = ['start', 'discover', 'learn', 'workshops', 'contact'] as const;

// lucide-react dropped brand/logo icons; this is the standard LinkedIn glyph.
const LinkedInIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.44-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.25 2.37 4.25 5.44v6.3zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
  </svg>
);

/** A hairline vertical line that fills as the reader scrolls past it. */
const Waypoint: React.FC = () => (
  <div data-waypoint className="flex flex-col items-center px-8 pb-11 pt-2">
    <div data-track className="relative w-px bg-border" style={{ height: 120 }}>
      <div data-fill className="absolute top-0 left-0 w-px bg-primary" style={{ height: 0 }} />
      <div
        data-dot
        className="absolute w-[7px] h-[7px] rounded-full bg-primary opacity-0"
        style={{ top: 0, left: -3 }}
      />
    </div>
  </div>
);

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const formatDate = (isoDate: string, locale: string) => {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  // -u-nu-latn keeps Western digits in the Arabic locale too (ar-EG defaults
  // to Eastern Arabic-Indic numerals otherwise), matching the Western digits
  // already used in the About stats — one numeral convention across the page.
  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const locale = useLanguageStore(s => s.locale);
  const T = translations[locale];
  const isRTL = locale === 'ar';
  const { addToast } = useToastStore();

  const [content, setContent] = useState<HomepageContent | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<Workshop | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    Promise.all([
      client.get<HomepageContent>('/api/v1/homepage').then(res => setContent(res.data)),
      client.get<Workshop[]>('/api/v1/workshops').then(res => setWorkshops(Array.isArray(res.data) ? res.data : [])),
    ])
      .catch(err => console.error('Failed to load homepage content', err))
      .finally(() => setIsLoading(false));
  }, []);

  // Public site only — the Admin Dashboard and builder tools stay LTR/English
  // regardless of this, so the direction is restored on unmount.
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    };
  }, [isRTL, locale]);

  // The reveal/waypoint/rail elements only exist once content has rendered,
  // so this waits for isLoading to clear rather than running on mount. Reruns
  // on locale change since RTL flips which edge the rail measures from.
  useEffect(() => {
    if (isLoading || !rootRef.current) return;
    return setupScrollJourney(rootRef.current);
  }, [isLoading, locale]);

  if (isLoading || !content || !workshops) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const c: HomepageContent = {
    ...DEFAULT_CONTENT,
    ...content,
    about_facts: content.about_facts?.length ? content.about_facts : DEFAULT_CONTENT.about_facts,
    offer_pillars: content.offer_pillars?.length ? content.offer_pillars : DEFAULT_CONTENT.offer_pillars,
  };

  // English reads the CMS-editable copy; Arabic falls back to the static
  // translation (see translations.ts doc comment).
  const hero = isRTL ? { kicker: T.hero.kicker, title: T.hero.title, subtitle: T.hero.subtitle } : {
    kicker: c.hero_kicker,
    title: c.hero_title,
    subtitle: c.hero_subtitle,
  };
  const about = isRTL
    ? { kicker: T.about.kicker, title: T.about.title, body1: T.about.body1, body2: T.about.body2, facts: T.about.facts }
    : { kicker: c.about_kicker, title: c.about_title, body1: c.about_body1, body2: c.about_body2, facts: c.about_facts };
  const offer = isRTL
    ? { kicker: T.offer.kicker, title: T.offer.title, subtitle: T.offer.subtitle, pillars: T.offer.pillars.map((p, i) => ({ ...p, id: `p${i}`, num: String(i + 1).padStart(2, '0') })) }
    : { kicker: c.offer_kicker, title: c.offer_title, subtitle: c.offer_subtitle, pillars: c.offer_pillars };

  const NAV = [
    { key: 'home', label: T.nav.home, href: '#start' },
    { key: 'about', label: T.nav.about, href: '#discover' },
    { key: 'offer', label: T.nav.offer, href: '#learn' },
    { key: 'workshops', label: T.nav.workshops, href: '#workshops' },
    { key: 'contact', label: T.nav.contact, href: '#contact' },
  ];

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) return;
    setIsSending(true);
    try {
      await client.post('/api/v1/contact', contactForm);
      addToast('success', T.contact.success);
      setContactForm({ name: '', email: '', message: '' });
    } catch (err) {
      addToast('error', apiErrorMessage(err, T.contact.error));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      ref={rootRef}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-bg text-text font-sans selection:bg-primary/30"
    >
      <div className="fixed top-0 inset-x-0 h-0.5 z-[60]">
        <div data-progress className="h-0.5 bg-primary" style={{ width: 0 }} />
      </div>

      <aside
        data-rail
        className="hidden min-[1180px]:flex fixed end-7 top-1/2 -translate-y-1/2 z-[55] flex-col items-end rtl:items-start"
      >
        {STATION_IDS.map((id, i) => (
          <div key={id} className="flex flex-col items-end rtl:items-start">
            <a data-rail-item href={`#${id}`} className="flex items-center gap-2.5">
              <span
                data-rail-label
                className="text-[10px] font-bold tracking-[.16em] uppercase text-muted opacity-50 transition-colors duration-300 whitespace-nowrap"
              >
                {NAV[i].label}
              </span>
              <span
                data-rail-dot
                className="w-[9px] h-[9px] rounded-full border border-border-strong bg-bg transition-all duration-300"
              />
            </a>
            {i < STATION_IDS.length - 1 && (
              <span
                data-rail-seg
                className="w-px bg-border transition-colors duration-500"
                style={{ height: 34, marginInlineEnd: 4 }}
              />
            )}
          </div>
        ))}
      </aside>

      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-5 sm:px-8 py-4 bg-bg/88 backdrop-blur-md border-b border-border">
        <a href="#start" className="flex items-center gap-2.5">
          <img src="/logo-icon.png" alt="" className="w-7 h-7 object-contain" />
          <span className="text-lg font-bold tracking-tight text-text">Skillture</span>
        </a>
        <nav className="flex items-center gap-6 sm:gap-7">
          {NAV.map(nl => (
            <a
              key={nl.key}
              href={nl.href}
              className="hidden sm:inline text-sm font-medium text-text whitespace-nowrap transition-colors duration-200 hover:text-primary"
            >
              {nl.label}
            </a>
          ))}
          <LanguageSwitcher />
        </nav>
      </header>

      {/* ── Start ─────────────────────────────────────────────────── */}
      <section id="start" data-section className="relative text-center overflow-hidden px-5 sm:px-8 pt-20 pb-20">
        <div
          className="absolute -top-36 left-1/2 -translate-x-1/2 w-[680px] h-[340px] rounded-full pointer-events-none"
          style={{ background: 'rgba(10,191,188,.08)', filter: 'blur(90px)' }}
        />
        <div className="relative max-w-3xl mx-auto flex flex-col items-center">
          <img
            src="/logo-full.png"
            alt="Skillture"
            className="animate-logo-in w-[440px] max-w-full h-auto object-contain mb-7"
          />
          <span
            data-reveal
            className="reveal inline-block px-3.5 py-1.5 rounded-full text-primary text-xs font-bold tracking-[.1em] mb-5"
            style={{ background: 'rgba(10,191,188,.1)', border: '1px solid rgba(10,191,188,.2)' }}
          >
            {hero.kicker}
          </span>
          <h1
            data-reveal
            className="reveal font-extrabold tracking-tight leading-[1.15] text-text mb-4 text-pretty"
            style={{ fontSize: 'clamp(30px,5vw,46px)', transitionDelay: '60ms' }}
          >
            {hero.title}
          </h1>
          <p
            data-reveal
            className="reveal text-[17px] leading-relaxed text-muted max-w-xl mb-8 text-pretty"
            style={{ transitionDelay: '120ms' }}
          >
            {hero.subtitle}
          </p>
          <div data-reveal className="reveal flex gap-3.5 justify-center flex-wrap" style={{ transitionDelay: '180ms' }}>
            <Button size="lg" onClick={() => scrollToId('workshops')}>
              {T.hero.ctaPrimary} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/play')}>
              <Gamepad2 className="w-4 h-4" /> {T.hero.ctaSecondary}
            </Button>
          </div>
        </div>
      </section>

      <Waypoint />

      {/* ── Discover: About Us ────────────────────────────────────── */}
      <section id="discover" data-section className="max-w-5xl mx-auto px-5 sm:px-8 pb-10">
        <div className="grid sm:grid-cols-2 gap-12 items-start">
          <div>
            <p data-reveal className="reveal text-xs font-bold tracking-[.14em] uppercase text-primary mb-3">
              {about.kicker}
            </p>
            <h2
              data-reveal
              className="reveal font-extrabold tracking-tight leading-[1.2] text-text mb-[18px] text-pretty"
              style={{ fontSize: 'clamp(26px,3.4vw,34px)', transitionDelay: '60ms' }}
            >
              {about.title}
            </h2>
            <p data-reveal className="reveal text-base leading-[1.75] text-muted mb-4 text-pretty" style={{ transitionDelay: '120ms' }}>
              {about.body1}
            </p>
            <p data-reveal className="reveal text-base leading-[1.75] text-muted text-pretty" style={{ transitionDelay: '160ms' }}>
              {about.body2}
            </p>
          </div>
          <div className="flex flex-col gap-3.5">
            {about.facts.map((f, i) => (
              <div
                key={i}
                data-reveal
                className="reveal bg-panel border border-border rounded-xl px-6 py-[22px] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary-border-soft hover:shadow-md"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="text-2xl font-extrabold text-primary tracking-tight tabular-nums">{f.value}</div>
                <div className="text-[13px] text-muted leading-snug mt-1">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Waypoint />

      {/* ── Learn: What We Offer ─────────────────────────────────── */}
      <section id="learn" data-section className="max-w-5xl mx-auto px-5 sm:px-8 pb-10">
        <p data-reveal className="reveal text-xs font-bold tracking-[.14em] uppercase text-primary mb-3 text-center">
          {offer.kicker}
        </p>
        <h2
          data-reveal
          className="reveal font-extrabold tracking-tight text-text mb-3 text-center"
          style={{ fontSize: 'clamp(26px,3.4vw,34px)', transitionDelay: '60ms' }}
        >
          {offer.title}
        </h2>
        <p
          data-reveal
          className="reveal text-base leading-relaxed text-muted max-w-xl mx-auto mb-11 text-center text-pretty"
          style={{ transitionDelay: '100ms' }}
        >
          {offer.subtitle}
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {offer.pillars.map((p, i) => (
            <div
              key={i}
              data-reveal
              className="reveal group bg-panel border border-border rounded-2xl p-[26px] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-primary-border hover:shadow-lg"
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <div className="w-[42px] h-[42px] rounded-xl bg-primary-soft border border-primary-border flex items-center justify-center mb-[18px] transition-transform duration-300 ease-out group-hover:scale-110">
                <span className="text-[13px] font-extrabold text-primary tabular-nums">
                  {p.num}
                </span>
              </div>
              <h3 className="text-lg font-bold text-text mb-2">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted mb-4 text-pretty">{p.description}</p>
              <div className="flex flex-col gap-1.5">
                {p.points.map(point => (
                  <div key={point} className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    <span className="text-[13px] text-text leading-snug">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Waypoint />

      {/* ── Workshops ─────────────────────────────────────────────── */}
      <section id="workshops" data-section className="max-w-5xl mx-auto px-5 sm:px-8 pb-10">
        <p data-reveal className="reveal text-xs font-bold tracking-[.14em] uppercase text-primary mb-3 text-center">
          {T.workshops.kicker}
        </p>
        <h2
          data-reveal
          className="reveal font-extrabold tracking-tight text-text mb-3 text-center"
          style={{ fontSize: 'clamp(26px,3.4vw,34px)', transitionDelay: '60ms' }}
        >
          {T.workshops.title}
        </h2>
        <p
          data-reveal
          className="reveal text-base leading-relaxed text-muted max-w-xl mx-auto mb-11 text-center text-pretty"
          style={{ transitionDelay: '100ms' }}
        >
          {T.workshops.subtitle}
        </p>

        {workshops.length === 0 ? (
          <div data-reveal className="reveal flex flex-col items-center text-center py-14 px-6 border border-dashed border-border rounded-2xl">
            <Calendar className="w-9 h-9 text-muted mb-4" />
            <p className="font-semibold text-text mb-1.5">{T.workshops.emptyTitle}</p>
            <p className="text-sm text-muted max-w-sm text-pretty">{T.workshops.emptyDescription}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {workshops.map((w, i) => (
              <div
                key={w.id}
                data-reveal
                className="reveal bg-panel border border-border rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-primary-border hover:shadow-lg"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="aspect-video bg-panel-2 overflow-hidden">
                  {w.image_path ? (
                    <img src={w.image_path} alt="" className="w-full h-full object-cover transition-transform duration-500 ease-out hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <Calendar className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-[17px] font-bold text-text mb-2 leading-snug">{localized(w.title, '', locale)}</h3>
                  <p className="text-sm leading-relaxed text-muted mb-4 line-clamp-3 text-pretty flex-1">
                    {localized(w.description, '', locale)}
                  </p>
                  <div className="flex items-center gap-3.5 text-xs text-muted mb-4 flex-wrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" /> {formatDate(w.event_date, locale)}
                    </span>
                    {w.event_time && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" /> {w.event_time}
                      </span>
                    )}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setDetail(w)} className="mt-auto">
                    {T.workshops.viewDetails}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Waypoint />

      {/* ── Contact ───────────────────────────────────────────────── */}
      <section id="contact" data-section className="max-w-5xl mx-auto px-5 sm:px-8 pb-20">
        <p data-reveal className="reveal text-xs font-bold tracking-[.14em] uppercase text-primary mb-3 text-center">
          {T.contact.kicker}
        </p>
        <h2
          data-reveal
          className="reveal font-extrabold tracking-tight text-text mb-3 text-center"
          style={{ fontSize: 'clamp(26px,3.4vw,34px)', transitionDelay: '60ms' }}
        >
          {T.contact.title}
        </h2>
        <p
          data-reveal
          className="reveal text-base leading-relaxed text-muted max-w-xl mx-auto mb-11 text-center text-pretty"
          style={{ transitionDelay: '100ms' }}
        >
          {T.contact.subtitle}
        </p>

        <div className="grid sm:grid-cols-2 gap-8">
          <div data-reveal className="reveal flex flex-col gap-4">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="group flex items-center gap-4 bg-panel border border-border rounded-xl px-5 py-4 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-primary-border hover:shadow-md"
            >
              <span className="w-11 h-11 rounded-xl bg-primary-soft border border-primary-border flex items-center justify-center flex-shrink-0 transition-transform duration-300 ease-out group-hover:scale-110">
                <Mail className="w-5 h-5 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted mb-0.5">{T.contact.emailLabel}</span>
                <span className="block text-sm font-semibold text-text truncate">{CONTACT_EMAIL}</span>
              </span>
            </a>
            <a
              href={CONTACT_LINKEDIN}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-4 bg-panel border border-border rounded-xl px-5 py-4 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-primary-border hover:shadow-md"
            >
              <span className="w-11 h-11 rounded-xl bg-primary-soft border border-primary-border flex items-center justify-center flex-shrink-0 transition-transform duration-300 ease-out group-hover:scale-110">
                <LinkedInIcon className="w-5 h-5 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted mb-0.5">{T.contact.linkedinLabel}</span>
                <span className="block text-sm font-semibold text-text truncate">Skillture</span>
              </span>
            </a>
          </div>

          <form
            data-reveal
            onSubmit={handleContactSubmit}
            className="reveal bg-panel border border-border rounded-2xl p-6 flex flex-col gap-3.5"
            style={{ transitionDelay: '80ms' }}
          >
            <h3 className="text-sm font-bold text-text mb-1">{T.contact.formTitle}</h3>
            <input
              required
              type="text"
              placeholder={T.contact.namePlaceholder}
              value={contactForm.name}
              onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
            />
            <input
              required
              type="email"
              placeholder={T.contact.emailPlaceholder}
              value={contactForm.email}
              onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
            />
            <textarea
              required
              rows={4}
              placeholder={T.contact.messagePlaceholder}
              value={contactForm.message}
              onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
              className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-primary resize-none"
            />
            <Button type="submit" loading={isSending} className="mt-1">
              {isSending ? T.contact.sending : T.contact.send}
            </Button>
          </form>
        </div>
      </section>

      <footer className="border-t border-border px-5 sm:px-8 py-7 flex items-center justify-between gap-5 flex-wrap max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo-icon.png" alt="" className="w-5 h-5 object-contain" />
          <span className="text-xs text-muted">
            © {new Date().getFullYear()} Skillture. {T.footer.rights}
          </span>
        </div>
        <div className="flex gap-6 flex-wrap">
          <a href="#" className="text-xs text-muted hover:text-text transition-colors duration-200">
            {T.footer.privacy}
          </a>
          <a href="#" className="text-xs text-muted hover:text-text transition-colors duration-200">
            {T.footer.terms}
          </a>
        </div>
      </footer>

      {detail && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setDetail(null)}
          role="presentation"
        >
          <div
            className="bg-panel border border-border rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {detail.image_path && (
              <div className="aspect-video overflow-hidden">
                <img src={detail.image_path} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="text-xl font-bold text-text">{localized(detail.title, '', locale)}</h3>
                <button
                  onClick={() => setDetail(null)}
                  aria-label={T.workshops.close}
                  className="text-muted hover:text-text transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted mb-4 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" /> {formatDate(detail.event_date, locale)}
                </span>
                {detail.event_time && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" /> {detail.event_time}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-text text-pretty whitespace-pre-wrap">
                {localized(detail.description, '', locale)}
              </p>
              {detail.extra_info && localized(detail.extra_info, '', locale) && (
                <p className="text-sm leading-relaxed text-muted mt-4 pt-4 border-t border-border text-pretty whitespace-pre-wrap">
                  {localized(detail.extra_info, '', locale)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
