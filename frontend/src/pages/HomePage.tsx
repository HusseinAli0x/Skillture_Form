import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, Mail } from 'lucide-react';
import client from '../api/client';
import {
  WORKSHOP_TRACKS,
  type Impact,
  type PublicWorkshop,
  type TeamMember,
  type WorkshopTrack,
} from '../api/publicTypes';
import ImpactNumbers from '../components/public/ImpactNumbers';
import { BTN_INK, BTN_PRIMARY, H1, H2, LINK_UNDERLINE, WRAP } from '../components/public/layout';
import LinkedInIcon from '../components/public/LinkedInIcon';
import PublicShell from '../components/public/PublicShell';
import TeamCard from '../components/public/TeamCard';
import { WorkshopRows } from '../components/public/WorkshopRow';
import { Spinner } from '../components/ui';
import { useLanguageStore } from '../context/LanguageStore';
import { useToastStore } from '../context/ToastStore';
import { apiErrorMessage } from '../lib/apiError';
import { siteStrings } from '../lib/siteStrings';
import { translations } from '../lib/translations';
import { useDocumentTitle } from '../lib/useDocumentTitle';

interface OfferPillar {
  id: string;
  num: string;
  title: string;
  description: string;
  points: string[];
}

/** Hero / About / Offer copy that an admin edits in the Homepage Editor. */
interface HomepageContent {
  hero_kicker: string;
  hero_title: string;
  hero_subtitle: string;
  about_kicker: string;
  about_title: string;
  about_body1: string;
  about_body2: string;
  offer_kicker: string;
  offer_title: string;
  offer_subtitle: string;
  offer_pillars: OfferPillar[];
}

// English defaults for the editable copy — see translations.ts for why Arabic
// falls back to static copy instead of the CMS.
const DEFAULT_CONTENT: HomepageContent = {
  hero_kicker: translations.en.hero.kicker,
  hero_title: translations.en.hero.title,
  hero_subtitle: translations.en.hero.subtitle,
  about_kicker: translations.en.about.kicker,
  about_title: translations.en.about.title,
  about_body1: translations.en.about.body1,
  about_body2: translations.en.about.body2,
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

const FIELD =
  'w-full min-h-12 px-4 rounded-md bg-panel border border-border-strong text-base placeholder:text-muted/70 focus:outline-2 focus:outline-primary focus:border-primary';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const locale = useLanguageStore(s => s.locale);
  const T = translations[locale];
  const S = siteStrings[locale];
  const H = S.home;
  const isRTL = locale === 'ar';
  const { addToast } = useToastStore();

  const [content, setContent] = useState<HomepageContent | null>(null);
  const [upcoming, setUpcoming] = useState<PublicWorkshop[]>([]);
  const [past, setPast] = useState<PublicWorkshop[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [pin, setPin] = useState('');
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [isSending, setIsSending] = useState(false);

  useDocumentTitle('Skillture');

  // Only the editable copy gates the first paint. The rest are extras: if a
  // call fails its section simply stays hidden.
  useEffect(() => {
    client
      .get<HomepageContent>('/api/v1/homepage')
      .then(res => setContent({ ...DEFAULT_CONTENT, ...res.data }))
      .catch(err => console.error('Failed to load homepage content', err))
      .finally(() => setIsLoading(false));
    client.get<PublicWorkshop[]>('/api/v1/workshops').then(r => setUpcoming(Array.isArray(r.data) ? r.data : [])).catch(() => undefined);
    client.get<PublicWorkshop[]>('/api/v1/workshops/past').then(r => setPast(Array.isArray(r.data) ? r.data.slice(0, 4) : [])).catch(() => undefined);
    // A malformed response (no per-track counts) is ignored rather than rendered.
    client.get<Impact>('/api/v1/impact').then(r => setImpact(r.data?.tracks ? r.data : null)).catch(() => undefined);
    client.get<TeamMember[]>('/api/v1/team').then(r => setTeam(Array.isArray(r.data) ? r.data : [])).catch(() => undefined);
  }, []);

  // Arriving via /#contact: the section only exists once content has rendered.
  useEffect(() => {
    if (isLoading) return;
    const id = hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [isLoading, hash]);

  const c = content ?? DEFAULT_CONTENT;
  const hero = isRTL ? { title: T.hero.title, subtitle: T.hero.subtitle } : { title: c.hero_title, subtitle: c.hero_subtitle };
  const about = isRTL
    ? { title: T.about.title, body1: T.about.body1, body2: T.about.body2 }
    : { title: c.about_title, body1: c.about_body1, body2: c.about_body2 };
  const offer = isRTL
    ? { title: T.offer.title, subtitle: T.offer.subtitle, pillars: T.offer.pillars.map((p, i) => ({ ...p, id: `p${i}` })) }
    : { title: c.offer_title, subtitle: c.offer_subtitle, pillars: c.offer_pillars };

  const joinGame = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(pin ? `/play?pin=${pin}` : '/play');
  };

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

  // Count of delivered workshops per track. The CMS pillar titles are free
  // text, so match by name, and fall back to position in Arabic (fixed order).
  const deliveredFor = (title: string, index: number): number | null => {
    if (!impact) return null;
    const lower = title.trim().toLowerCase();
    const key: WorkshopTrack | undefined = (WORKSHOP_TRACKS as readonly string[]).includes(lower)
      ? (lower as WorkshopTrack)
      : isRTL
        ? WORKSHOP_TRACKS[index]
        : undefined;
    const n = key ? impact.tracks[key] : 0;
    return n > 0 ? n : null;
  };

  if (isLoading) {
    return (
      <PublicShell>
        <div className="flex justify-center py-40">
          <Spinner />
        </div>
      </PublicShell>
    );
  }

  const featuredTeam = team.slice(0, 4);

  return (
    <PublicShell>
      {/* Hero: the statement, and the one thing a student in the room needs. */}
      <section className={`${WRAP} pt-12 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-20 items-center`}>
        <div>
          <h1 className={H1}>{hero.title}</h1>
          <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed text-pretty">{hero.subtitle}</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link to="/our-work" className={BTN_PRIMARY}>
              {H.ctaPrimary}
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
            <Link to="/team" className={LINK_UNDERLINE}>
              {H.ctaSecondary}
            </Link>
          </div>
        </div>

        <form onSubmit={joinGame} className="bg-brand text-ink rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold">{H.pin.title}</h2>
          <p className="mt-1.5 text-base">{H.pin.hint}</p>
          <label htmlFor="home-pin" className="sr-only">
            {H.pin.label}
          </label>
          <input
            id="home-pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder={H.pin.placeholder}
            dir="ltr"
            className="mt-6 w-full h-16 rounded-lg bg-white text-ink text-center text-3xl numeral tracking-[0.25em] placeholder:text-ink/25 focus:outline-2 focus:outline-ink"
          />
          <button type="submit" className={`${BTN_INK} w-full mt-3 cursor-pointer`}>
            {H.pin.button}
          </button>
        </form>
      </section>

      {/* Method: how we know a workshop worked. */}
      <section className="border-t border-border">
        <div className={`${WRAP} py-16 sm:py-24 grid lg:grid-cols-[1fr_2fr] gap-10 lg:gap-20`}>
          <div>
            <h2 className={H2}>{H.method.title}</h2>
            <p className="mt-4 text-lg text-muted text-pretty">{H.method.subtitle}</p>
          </div>
          <ol className="grid sm:grid-cols-3 gap-x-8 gap-y-8">
            {H.method.steps.map(step => (
              <li key={step.label} className="border-t-2 border-ink pt-4">
                <p className="text-lg font-semibold">{step.label}</p>
                <p className="mt-2 text-muted leading-relaxed text-pretty">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tracks: what we teach, with the real count delivered. */}
      <section className="bg-panel border-y border-border">
        <div className={`${WRAP} py-16 sm:py-24 grid lg:grid-cols-[1fr_2fr] gap-10 lg:gap-20`}>
          <div>
            <h2 className={H2}>{H.tracks.title}</h2>
            <p className="mt-4 text-lg text-muted text-pretty">{offer.subtitle}</p>
          </div>
          <ul className="border-b border-border">
            {offer.pillars.map((p, i) => {
              const n = deliveredFor(p.title, i);
              return (
                <li key={p.id} className="grid grid-cols-[1fr_auto] gap-x-6 py-6 border-t border-border">
                  <div>
                    <h3 className="text-xl font-semibold">{p.title}</h3>
                    <p className="mt-2 text-muted leading-relaxed max-w-lg text-pretty">{p.description}</p>
                  </div>
                  {n !== null && <p className="text-sm text-muted pt-1.5 whitespace-nowrap">{H.tracks.delivered(n)}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Results board: only real, computed numbers and real workshops. */}
      {impact && impact.workshops_held > 0 && (
        <section className="on-ink">
          <div className={`${WRAP} py-16 sm:py-24`}>
            <h2 className={`${H2} max-w-2xl`}>{H.results.title}</h2>
            <div className="mt-12">
              <ImpactNumbers impact={impact} />
            </div>
            {past.length > 0 && (
              <div className="mt-16">
                <WorkshopRows workshops={past} />
                <Link to="/our-work" className="mt-8 inline-flex items-center gap-2 min-h-11 font-semibold underline underline-offset-4 hover:text-primary">
                  {H.results.seeAll}
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className={`${WRAP} py-16 sm:py-24`} aria-labelledby="home-upcoming">
          <h2 id="home-upcoming" className={`${H2} mb-8`}>
            {H.upcoming.title}
          </h2>
          <WorkshopRows workshops={upcoming} upcoming />
        </section>
      )}

      {/* The people, led by the story. */}
      <section className="bg-panel border-y border-border">
        <div className={`${WRAP} py-16 sm:py-24`}>
          <div className="grid lg:grid-cols-[1fr_1fr] gap-10 lg:gap-20">
            <h2 className={H2}>{about.title}</h2>
            <div className="space-y-5 text-lg leading-relaxed text-pretty">
              <p>{about.body1}</p>
              <p className="text-muted">{about.body2}</p>
            </div>
          </div>

          {featuredTeam.length > 0 && (
            <div className="mt-14">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-9">
                {featuredTeam.map(m => (
                  <TeamCard key={m.id} member={m} />
                ))}
              </div>
              <Link to="/team" className="mt-10 inline-flex items-center gap-2 min-h-11 font-semibold underline underline-offset-4 hover:text-primary">
                {H.team.meet}
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className={`${WRAP} py-16 sm:py-24 grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-20`}>
        <div>
          <h2 className={H2}>{T.contact.title}</h2>
          <p className="mt-4 text-lg text-muted max-w-md text-pretty">{T.contact.subtitle}</p>
          <ul className="mt-8 space-y-1">
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-3 min-h-11 font-medium hover:text-primary transition-colors">
                <Mail className="w-5 h-5" />
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <a
                href={CONTACT_LINKEDIN}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 min-h-11 font-medium hover:text-primary transition-colors"
              >
                <LinkedInIcon className="w-5 h-5" />
                {T.contact.linkedinLabel}
              </a>
            </li>
          </ul>
        </div>

        <form onSubmit={handleContactSubmit} className="space-y-4">
          <input
            type="text"
            required
            autoComplete="name"
            value={contactForm.name}
            onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
            placeholder={T.contact.namePlaceholder}
            aria-label={T.contact.namePlaceholder}
            className={FIELD}
          />
          <input
            type="email"
            required
            autoComplete="email"
            value={contactForm.email}
            onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
            placeholder={T.contact.emailPlaceholder}
            aria-label={T.contact.emailPlaceholder}
            className={FIELD}
          />
          <textarea
            required
            rows={5}
            value={contactForm.message}
            onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
            placeholder={T.contact.messagePlaceholder}
            aria-label={T.contact.messagePlaceholder}
            className={`${FIELD} py-3 resize-y`}
          />
          <button type="submit" disabled={isSending} className={`${BTN_INK} cursor-pointer disabled:opacity-60`}>
            {isSending ? T.contact.sending : T.contact.send}
          </button>
        </form>
      </section>
    </PublicShell>
  );
};

export default HomePage;
