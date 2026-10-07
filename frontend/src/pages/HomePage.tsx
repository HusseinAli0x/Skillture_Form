import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowRight, ArrowUpRight, Mail } from 'lucide-react';
import client from '../api/client';
import {
  WORKSHOP_TRACKS,
  type Impact,
  type PublicWorkshop,
  type TeamMember,
  type WorkshopTrack,
} from '../api/publicTypes';
import { Frieze, Pattern } from '../components/brand';
import ContactForm from '../components/public/ContactForm';
import ImpactNumbers from '../components/public/ImpactNumbers';
import JoinPinForm from '../components/public/JoinPinForm';
import { BTN_BRAND, BTN_INK, FOCUS_RING, H1, H2, LINK_UNDERLINE, WRAP } from '../components/public/layout';
import LinkedInIcon from '../components/public/LinkedInIcon';
import PublicShell from '../components/public/PublicShell';
import TeamCard from '../components/public/TeamCard';
import { WorkshopRows } from '../components/public/WorkshopRow';
import { Spinner } from '../components/ui';
import { useLanguageStore } from '../context/LanguageStore';
import { translations } from '../lib/translations';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useSiteStrings, useTranslations, useBrandAsset, useSiteSettings } from '../lib/useSiteContent';
import { SOCIAL_LINKS } from '../lib/siteContent';

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

const HomePage: React.FC = () => {
  const { hash } = useLocation();
  const locale = useLanguageStore(s => s.locale);
  const T = useTranslations();
  const S = useSiteStrings();
  const H = S.home;
  const settings = useSiteSettings();
  const handImg = useBrandAsset('hand');
  const badgeImg = useBrandAsset('badge');
  const pinsImg = useBrandAsset('pins');
  const isRTL = locale === 'ar';

  const [content, setContent] = useState<HomepageContent | null>(null);
  const [upcoming, setUpcoming] = useState<PublicWorkshop[]>([]);
  const [past, setPast] = useState<PublicWorkshop[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      {/* Hero: two audiences, two obvious next steps. Left: book a workshop.
          Right: the poster's pointing hand, with the game-PIN box sitting where
          the finger points. In Arabic the photo is mirrored so the finger still
          points at the box. */}
      <section className={`${WRAP} pt-10 pb-14 sm:pt-16 sm:pb-20 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center`}>
        <div>
          <h1 className={H1}>{hero.title}</h1>
          <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed text-pretty">{hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link to="/#contact" className={BTN_INK}>
              {H.ctaPrimary}
              <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
            <Link to="/our-work" className={LINK_UNDERLINE}>
              {H.ctaSecondary}
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] sm:aspect-[3/2] overflow-hidden rounded-2xl bg-teal">
            <img
              src={handImg}
              alt=""
              width={1600}
              height={1066}
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover object-left rtl:-scale-x-100 rtl:object-right"
            />
          </div>
          <JoinPinForm className="relative mt-3 me-4 sm:me-10 shadow-[0_18px_40px_-18px_rgba(5,9,9,0.45)]" />
        </div>
      </section>

      {/* For participants: the lanyard ID is the player card. */}
      <section className="on-ink relative overflow-hidden">
        <Pattern className="text-white opacity-[0.035]" />
        <div className={`${WRAP} relative py-16 sm:py-24 grid md:grid-cols-[1.2fr_1fr] gap-12 md:gap-16 items-center`}>
          <div>
            <h2 className={`${H2} max-w-xl`}>{H.participants.title}</h2>
            <p className="mt-4 text-lg text-muted max-w-xl text-pretty">{H.participants.body}</p>
            <ol className="mt-8 space-y-4 max-w-xl">
              {H.participants.steps.map((step, i) => (
                <li key={step} className="flex items-baseline gap-4">
                  <span className="numeral text-4xl text-brand w-8 shrink-0" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="text-lg leading-snug">{step}</span>
                </li>
              ))}
            </ol>
            <Link to="/play" className={`${BTN_BRAND} mt-9`}>
              {H.participants.button}
              <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
          {/* The source image is a type-specimen slide with the card on its
              right; the crop keeps only the card and lanyard. */}
          <div className="relative mx-auto w-full max-w-xs md:max-w-none aspect-[3/4] overflow-hidden rounded-2xl bg-white">
            <img
              src={badgeImg}
              alt={H.participants.badgeAlt}
              width={1664}
              height={937}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover object-[95%_50%]"
            />
          </div>
        </div>
      </section>

      {/* Method: how we know a workshop worked. */}
      <section>
        <div className={`${WRAP} py-16 sm:py-24 grid lg:grid-cols-[1fr_2fr] gap-10 lg:gap-20`}>
          <div>
            <h2 className={H2}>{H.method.title}</h2>
            <p className="mt-4 text-lg text-muted text-pretty">{H.method.subtitle}</p>
          </div>
          <ol className="grid sm:grid-cols-3 gap-x-8 gap-y-8">
            {H.method.steps.map(step => (
              <li key={step.label} className="border-t-4 border-brand pt-4">
                <p className="font-display text-2xl font-bold">{step.label}</p>
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
          <ul className="border-b border-border-strong">
            {offer.pillars.map((p, i) => {
              const n = deliveredFor(p.title, i);
              return (
                <li key={p.id} className="grid grid-cols-[1fr_auto] gap-x-6 py-6 border-t border-border-strong">
                  <div>
                    <h3 className="text-2xl">{p.title}</h3>
                    <p className="mt-2 text-muted leading-relaxed max-w-lg text-pretty">{p.description}</p>
                  </div>
                  {n !== null && <p className="text-sm font-medium text-primary pt-2 whitespace-nowrap">{H.tracks.delivered(n)}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Results board: only real, computed numbers and real workshops. */}
      {impact && impact.workshops_held > 0 && (
        <section className="on-ink relative overflow-hidden">
          <Pattern className="text-white opacity-[0.03]" />
          <div className={`${WRAP} relative py-16 sm:py-24`}>
            <h2 className={`${H2} max-w-2xl`}>{H.results.title}</h2>
            <div className="mt-12">
              <ImpactNumbers impact={impact} />
            </div>
            {past.length > 0 && (
              <div className="mt-16">
                <WorkshopRows workshops={past} />
                <Link to="/our-work" className={`mt-8 inline-flex items-center gap-2 min-h-11 font-semibold underline underline-offset-4 hover:text-primary ${FOCUS_RING}`}>
                  {H.results.seeAll}
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
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

      {/* The people, led by the story. The pins photograph is the company's
          real merchandise, shown once. */}
      <section>
        <Frieze className="text-ink/25" />
        <div className={`${WRAP} py-16 sm:py-24`}>
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
            <div>
              <h2 className={H2}>{about.title}</h2>
              <div className="mt-6 space-y-5 text-lg leading-relaxed text-pretty">
                <p>{about.body1}</p>
                <p className="text-muted">{about.body2}</p>
              </div>
            </div>
            <img
              src={pinsImg}
              alt={H.pinsAlt}
              width={1665}
              height={937}
              loading="lazy"
              className="w-full aspect-[16/10] object-cover rounded-2xl"
            />
          </div>

          {featuredTeam.length > 0 && (
            <div className="mt-16">
              <h3 className="text-2xl mb-8">{H.team.title}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-9">
                {featuredTeam.map(m => (
                  <TeamCard key={m.id} member={m} />
                ))}
              </div>
              <Link to="/team" className={`mt-10 inline-flex items-center gap-2 min-h-11 font-semibold underline underline-offset-4 hover:text-primary ${FOCUS_RING}`}>
                {H.team.meet}
                <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Book a workshop / contact: a solid turquoise field, like the poster. */}
      <section id="contact" className="on-brand relative overflow-hidden scroll-mt-16">
        <Pattern className="text-ink opacity-[0.045]" />
        <div className={`${WRAP} relative py-16 sm:py-24 grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-start`}>
          <div>
            <h2 className={H2}>{H.contact.title}</h2>
            <p className="mt-4 text-lg max-w-md text-pretty">{H.contact.subtitle}</p>
            <p className="mt-8 text-sm font-medium">{H.contact.emailDirect}</p>
            <ul className="mt-1 space-y-1">
              {settings.contact_email && (
                <li>
                  <a href={`mailto:${settings.contact_email}`} className={`inline-flex items-center gap-3 min-h-11 font-semibold underline underline-offset-4 ${FOCUS_RING}`}>
                    <Mail className="w-5 h-5" aria-hidden="true" />
                    <span dir="ltr">{settings.contact_email}</span>
                  </a>
                </li>
              )}
              {SOCIAL_LINKS.filter(l => settings[l.key]).map(l => (
                <li key={l.key}>
                  <a
                    href={settings[l.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-3 min-h-11 font-semibold underline underline-offset-4 ${FOCUS_RING}`}
                  >
                    {l.key === 'linkedin_url' ? <LinkedInIcon className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" aria-hidden="true" />}
                    {l.key === 'linkedin_url' ? T.contact.linkedinLabel : l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <ContactForm />
        </div>
      </section>
    </PublicShell>
  );
};

export default HomePage;
