import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Calendar } from 'lucide-react';
import client from '../api/client';
import { WORKSHOP_TRACKS, type Impact, type PublicWorkshop, type WorkshopTrack } from '../api/publicTypes';
import ImpactStrip from '../components/public/ImpactStrip';
import PublicShell from '../components/public/PublicShell';
import WorkshopCard from '../components/public/WorkshopCard';
import { Spinner } from '../components/ui';
import { useLanguageStore } from '../context/LanguageStore';
import { siteStrings } from '../lib/siteStrings';
import { useDocumentTitle } from '../lib/useDocumentTitle';

type Filter = 'all' | WorkshopTrack;

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
      client.get<Impact>('/api/v1/impact').then(r => setImpact(r.data)),
      client.get<PublicWorkshop[]>('/api/v1/workshops').then(r => setUpcoming(Array.isArray(r.data) ? r.data : [])),
      client.get<PublicWorkshop[]>('/api/v1/workshops/past').then(r => setPast(Array.isArray(r.data) ? r.data : [])),
    ]).catch(() => setFailed(true));
  }, []);

  // Only offer filters for tracks that actually have a past workshop.
  const availableTracks = useMemo(
    () => WORKSHOP_TRACKS.filter(t => past?.some(w => w.track === t)),
    [past],
  );
  const visible = useMemo(
    () => (past ?? []).filter(w => filter === 'all' || w.track === filter),
    [past, filter],
  );

  const loading = !failed && (impact === null || upcoming === null || past === null);

  const chip = (active: boolean) =>
    `inline-flex items-center min-h-11 px-4 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
      active
        ? 'bg-primary text-bg border-primary'
        : 'bg-panel text-text border-border hover:border-primary-border hover:text-primary'
    }`;

  return (
    <PublicShell>
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-10 text-center">
        <p className="text-xs font-bold tracking-[.14em] uppercase text-primary mb-3">{W.kicker}</p>
        <h1
          className="font-extrabold tracking-tight text-text mb-4 text-pretty"
          style={{ fontSize: 'clamp(30px,5vw,46px)' }}
        >
          {W.title}
        </h1>
        <p className="text-base sm:text-lg leading-relaxed text-muted max-w-2xl mx-auto text-pretty">{W.subtitle}</p>
      </section>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 pb-20">
        {failed ? (
          <p role="alert" className="text-center text-muted py-16">
            {W.loadError}
          </p>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : (
          <>
            {impact && <ImpactStrip impact={impact} />}

            {upcoming && upcoming.length > 0 && (
              <section className="mt-16" aria-labelledby="ow-upcoming">
                <h2 id="ow-upcoming" className="text-xl font-bold text-text mb-5 flex items-center gap-3">
                  {W.upcomingTitle}
                  <span className="h-px flex-1 bg-border" />
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {upcoming.map(w => (
                    <WorkshopCard key={w.id} workshop={w} />
                  ))}
                </div>
              </section>
            )}

            <section className="mt-16" aria-labelledby="ow-archive">
              <h2 id="ow-archive" className="text-xl font-bold text-text mb-5 flex items-center gap-3">
                {W.archiveTitle}
                <span className="h-px flex-1 bg-border" />
              </h2>

              {availableTracks.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label={W.archiveTitle}>
                  <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={chip(filter === 'all')}>
                    {W.filterAll}
                  </button>
                  {availableTracks.map(t => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={filter === t}
                      onClick={() => setFilter(t)}
                      className={chip(filter === t)}
                    >
                      {S.tracks[t]}
                    </button>
                  ))}
                </div>
              )}

              {visible.length === 0 ? (
                <div className="flex flex-col items-center text-center py-14 px-6 border border-dashed border-border rounded-2xl">
                  <Calendar className="w-9 h-9 text-muted mb-4" />
                  <p className="font-semibold text-text mb-1.5">{W.emptyTitle}</p>
                  <p className="text-sm text-muted max-w-sm text-pretty">{W.emptyDescription}</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {visible.map(w => (
                    <WorkshopCard key={w.id} workshop={w} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <div className="mt-16 bg-panel border border-border rounded-2xl px-6 py-9 sm:px-10 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-text mb-2 text-pretty">{W.cta.title}</h2>
          <p className="text-muted mb-6 max-w-lg mx-auto text-pretty">{W.cta.body}</p>
          <Link
            to="/#contact"
            className="inline-flex items-center justify-center gap-2 min-h-11 px-6 rounded-lg bg-primary text-bg font-semibold hover:bg-primary-hover transition-colors"
          >
            {W.cta.button}
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </PublicShell>
  );
};

export default OurWorkPage;
