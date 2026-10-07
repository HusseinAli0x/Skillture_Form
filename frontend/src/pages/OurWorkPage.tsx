import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight } from 'lucide-react';
import client from '../api/client';
import { WORKSHOP_TRACKS, type Impact, type PublicWorkshop, type WorkshopTrack } from '../api/publicTypes';
import { Pattern } from '../components/brand';
import ImpactNumbers from '../components/public/ImpactNumbers';
import { BTN_INK, FOCUS_RING, H1, H2, WRAP } from '../components/public/layout';
import { EmptyBlock, LoadError, RowsSkeleton } from '../components/public/PageState';
import PublicShell from '../components/public/PublicShell';
import { WorkshopRows } from '../components/public/WorkshopRow';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useSiteStrings, useBrandAsset } from '../lib/useSiteContent';

type Filter = 'all' | WorkshopTrack;

// Used when the impact call returns something unusable, so the page still renders.
const EMPTY_IMPACT: Impact = {
  workshops_held: 0,
  workshops_upcoming: 0,
  attendees_total: 0,
  tracks: { technical: 0, career: 0, industry: 0, business: 0 },
};

const OurWorkPage: React.FC = () => {
  const S = useSiteStrings();
  const cardsImg = useBrandAsset('cards');
  const W = S.ourWork;
  const [params, setParams] = useSearchParams();

  const [impact, setImpact] = useState<Impact | null>(null);
  const [upcoming, setUpcoming] = useState<PublicWorkshop[] | null>(null);
  const [past, setPast] = useState<PublicWorkshop[] | null>(null);
  const [failed, setFailed] = useState(false);

  useDocumentTitle(W.metaTitle);

  const load = useCallback(() => {
    setFailed(false);
    setImpact(null);
    setUpcoming(null);
    setPast(null);
    let cancelled = false;
    Promise.all([
      client.get<Impact>('/api/v1/impact').then(r => !cancelled && setImpact(r.data?.tracks ? r.data : EMPTY_IMPACT)),
      client.get<PublicWorkshop[]>('/api/v1/workshops').then(r => !cancelled && setUpcoming(Array.isArray(r.data) ? r.data : [])),
      client.get<PublicWorkshop[]>('/api/v1/workshops/past').then(r => !cancelled && setPast(Array.isArray(r.data) ? r.data : [])),
    ]).catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  // Only offer filters for tracks that actually have a past workshop.
  const availableTracks = useMemo(() => WORKSHOP_TRACKS.filter(t => past?.some(w => w.track === t)), [past]);
  // The filter lives in the URL (?track=career), so a filtered view can be shared.
  const requested = params.get('track');
  const filter: Filter = availableTracks.find(t => t === requested) ?? 'all';
  const setFilter = (f: Filter) => setParams(f === 'all' ? {} : { track: f }, { replace: true });
  const visible = useMemo(() => (past ?? []).filter(w => filter === 'all' || w.track === filter), [past, filter]);
  const loading = !failed && (impact === null || upcoming === null || past === null);

  const chip = (active: boolean) =>
    `inline-flex items-center min-h-11 px-4 rounded-full border text-sm font-semibold transition-colors cursor-pointer ${FOCUS_RING} ${
      active ? 'bg-ink text-white border-ink' : 'border-border-strong hover:border-ink'
    }`;

  return (
    <PublicShell>
      {/* Header: the statement, with the business cards photographed once. */}
      <section className={`${WRAP} pt-12 sm:pt-16 pb-12 sm:pb-16 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center`}>
        <div>
          <h1 className={H1}>{W.title}</h1>
          <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed text-pretty">{W.subtitle}</p>
        </div>
        <img
          src={cardsImg}
          alt={W.cardsAlt}
          width={1664}
          height={937}
          fetchPriority="high"
          className="w-full aspect-[16/10] object-cover rounded-2xl"
        />
      </section>

      {failed ? (
        <LoadError message={W.loadError} onRetry={load} />
      ) : loading ? (
        <div className={`${WRAP} pb-24`}>
          <RowsSkeleton rows={4} />
        </div>
      ) : (
        <>
          {impact && impact.workshops_held > 0 && (
            <section className="on-ink relative overflow-hidden">
              <Pattern className="text-white opacity-[0.03]" />
              <div className={`${WRAP} relative py-14 sm:py-20`}>
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
              <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label={W.archiveTitle}>
                <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={chip(filter === 'all')}>
                  {W.filterAll}
                </button>
                {availableTracks.map(t => (
                  <button key={t} type="button" aria-pressed={filter === t} onClick={() => setFilter(t)} className={chip(filter === t)}>
                    {S.tracks[t]}
                  </button>
                ))}
              </div>
            )}

            {visible.length === 0 ? (
              <EmptyBlock
                title={W.emptyTitle}
                body={W.emptyDescription}
                action={
                  <Link to="/#contact" className={BTN_INK}>
                    {W.emptyButton}
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                  </Link>
                }
              />
            ) : (
              <WorkshopRows workshops={visible} />
            )}
          </section>
        </>
      )}

      <section className="on-brand relative overflow-hidden">
        <Pattern className="text-ink opacity-[0.045]" />
        <div className={`${WRAP} relative py-14 sm:py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-8`}>
          <div className="max-w-2xl">
            <h2 className={H2}>{W.cta.title}</h2>
            <p className="mt-3 text-lg">{W.cta.body}</p>
          </div>
          <Link to="/#contact" className={`${BTN_INK} shrink-0`}>
            {W.cta.button}
            <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
};

export default OurWorkPage;
