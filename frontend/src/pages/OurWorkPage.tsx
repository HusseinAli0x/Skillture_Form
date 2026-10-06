import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import client from '../api/client';
import { WORKSHOP_TRACKS, type Impact, type PublicWorkshop, type WorkshopTrack } from '../api/publicTypes';
import ImpactNumbers from '../components/public/ImpactNumbers';
import { BTN_INK, H1, H2, WRAP } from '../components/public/layout';
import PublicShell from '../components/public/PublicShell';
import { WorkshopRows } from '../components/public/WorkshopRow';
import { Spinner } from '../components/ui';
import { useLanguageStore } from '../context/LanguageStore';
import { siteStrings } from '../lib/siteStrings';
import { useDocumentTitle } from '../lib/useDocumentTitle';

type Filter = 'all' | WorkshopTrack;

// Used when the impact call returns something unusable, so the page still renders.
const EMPTY_IMPACT: Impact = {
  workshops_held: 0,
  workshops_upcoming: 0,
  attendees_total: 0,
  tracks: { technical: 0, career: 0, industry: 0, business: 0 },
};

const OurWorkPage: React.FC = () => {
  const locale = useLanguageStore(s => s.locale);
  const S = siteStrings[locale];
  const W = S.ourWork;

  const [impact, setImpact] = useState<Impact | null>(null);
  const [upcoming, setUpcoming] = useState<PublicWorkshop[] | null>(null);
  const [past, setPast] = useState<PublicWorkshop[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useDocumentTitle(W.metaTitle);

  useEffect(() => {
    Promise.all([
      client.get<Impact>('/api/v1/impact').then(r => setImpact(r.data?.tracks ? r.data : EMPTY_IMPACT)),
      client.get<PublicWorkshop[]>('/api/v1/workshops').then(r => setUpcoming(Array.isArray(r.data) ? r.data : [])),
      client.get<PublicWorkshop[]>('/api/v1/workshops/past').then(r => setPast(Array.isArray(r.data) ? r.data : [])),
    ]).catch(() => setFailed(true));
  }, []);

  // Only offer filters for tracks that actually have a past workshop.
  const availableTracks = useMemo(() => WORKSHOP_TRACKS.filter(t => past?.some(w => w.track === t)), [past]);
  const visible = useMemo(() => (past ?? []).filter(w => filter === 'all' || w.track === filter), [past, filter]);
  const loading = !failed && (impact === null || upcoming === null || past === null);

  const tab = (active: boolean) =>
    `inline-flex items-center min-h-11 px-1 text-base font-medium border-b-2 transition-colors cursor-pointer ${
      active ? 'border-ink' : 'border-transparent text-muted hover:text-text'
    }`;

  return (
    <PublicShell>
      <section className={`${WRAP} pt-14 sm:pt-20 pb-12 sm:pb-16`}>
        <h1 className={`${H1} max-w-3xl`}>{W.title}</h1>
        <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed text-pretty">{W.subtitle}</p>
      </section>

      {failed ? (
        <p role="alert" className={`${WRAP} text-muted py-16`}>
          {W.loadError}
        </p>
      ) : loading ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : (
        <>
          {impact && impact.workshops_held > 0 && (
            <section className="on-ink">
              <div className={`${WRAP} py-14 sm:py-20`}>
                <ImpactNumbers impact={impact} />
              </div>
            </section>
          )}

          {upcoming && upcoming.length > 0 && (
            <section className={`${WRAP} pt-16 sm:pt-20`} aria-labelledby="ow-upcoming">
              <h2 id="ow-upcoming" className={`${H2} mb-8`}>
                {W.upcomingTitle}
              </h2>
              <WorkshopRows workshops={upcoming} upcoming />
            </section>
          )}

          <section className={`${WRAP} py-16 sm:py-20`} aria-labelledby="ow-archive">
            <h2 id="ow-archive" className={`${H2} mb-6`}>
              {W.archiveTitle}
            </h2>

            {availableTracks.length > 1 && (
              <div className="flex flex-wrap gap-x-6 mb-4" role="group" aria-label={W.archiveTitle}>
                <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={tab(filter === 'all')}>
                  {W.filterAll}
                </button>
                {availableTracks.map(t => (
                  <button key={t} type="button" aria-pressed={filter === t} onClick={() => setFilter(t)} className={tab(filter === t)}>
                    {S.tracks[t]}
                  </button>
                ))}
              </div>
            )}

            {visible.length === 0 ? (
              <div className="border-t border-border py-12">
                <p className="font-semibold">{W.emptyTitle}</p>
                <p className="mt-1 text-muted max-w-md">{W.emptyDescription}</p>
              </div>
            ) : (
              <WorkshopRows workshops={visible} />
            )}
          </section>
        </>
      )}

      <section className="bg-brand text-ink">
        <div className={`${WRAP} py-14 sm:py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-8`}>
          <div className="max-w-2xl">
            <h2 className={H2}>{W.cta.title}</h2>
            <p className="mt-3 text-lg">{W.cta.body}</p>
          </div>
          <Link to="/#contact" className={`${BTN_INK} shrink-0`}>
            {W.cta.button}
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
};

export default OurWorkPage;
