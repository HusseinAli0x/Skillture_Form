import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Check, Share2 } from 'lucide-react';
import { isAxiosError } from 'axios';
import client from '../api/client';
import type { PublicWorkshop } from '../api/publicTypes';
import { BTN_PRIMARY, H1, WRAP } from '../components/public/layout';
import Lightbox from '../components/public/Lightbox';
import PublicShell from '../components/public/PublicShell';
import TrackBadge from '../components/public/TrackBadge';
import { Spinner } from '../components/ui';
import { useLanguageStore } from '../context/LanguageStore';
import { formatDate, isPastDate } from '../lib/formatDate';
import { localized } from '../lib/i18n';
import { siteStrings } from '../lib/siteStrings';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const WorkshopDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const locale = useLanguageStore(s => s.locale);
  const S = siteStrings[locale].workshop;

  const [workshop, setWorkshop] = useState<PublicWorkshop | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const title = workshop ? localized(workshop.title, '', locale) : '';
  useDocumentTitle(title ? `${title} — Skillture` : 'Skillture');

  useEffect(() => {
    setState('loading');
    client
      .get<PublicWorkshop>(`/api/v1/workshops/${id}`)
      .then(res => {
        setWorkshop(res.data);
        setState('ready');
      })
      .catch(err => setState(isAxiosError(err) && err.response?.status === 404 ? 'missing' : 'error'));
  }, [id]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // User dismissed the share sheet, or clipboard is blocked — nothing to recover.
    }
  };

  const back = (
    <Link to="/our-work" className="inline-flex items-center gap-2 min-h-11 text-sm font-medium hover:text-primary transition-colors">
      <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
      {S.back}
    </Link>
  );

  if (state === 'loading') {
    return (
      <PublicShell>
        <div className="flex justify-center py-32">
          <Spinner />
        </div>
      </PublicShell>
    );
  }

  if (state !== 'ready' || !workshop) {
    return (
      <PublicShell>
        <div className={`${WRAP} py-24`}>
          <h1 className="text-3xl font-semibold mb-2">{S.notFoundTitle}</h1>
          <p className="text-muted mb-6">{S.notFoundBody}</p>
          {back}
        </div>
      </PublicShell>
    );
  }

  const w = workshop;
  const past = isPastDate(w.event_date);
  const outcome = localized(w.outcome, '', locale);
  const recap = localized(w.recap, '', locale);
  const extra = localized(w.extra_info, '', locale);

  const facts: { label: string; value: string }[] = [
    { label: S.when, value: [formatDate(w.event_date, locale), w.event_time].filter(Boolean).join(' · ') },
    ...(w.location ? [{ label: S.where, value: w.location }] : []),
    ...(w.speaker ? [{ label: S.speaker, value: w.speaker }] : []),
    ...(w.attendees != null ? [{ label: S.attendees, value: w.attendees.toLocaleString('en-US') }] : []),
  ];

  return (
    <PublicShell>
      <article className={`${WRAP} pt-6 pb-20`}>
        {back}

        <header className="mt-6 max-w-4xl">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">{past ? S.completed : S.upcoming}</span>
            <TrackBadge track={w.track} />
          </div>
          <h1 className={`${H1} mt-4`}>{title}</h1>
        </header>

        {w.image_path && (
          <div className="mt-10 aspect-[16/8] overflow-hidden rounded-md bg-panel-2">
            <img src={w.image_path} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="mt-12 grid lg:grid-cols-[18rem_1fr] gap-x-16 gap-y-10">
          <dl className="self-start border-t border-ink">
            {facts.map(f => (
              <div key={f.label} className="py-4 border-b border-border">
                <dt className="text-sm text-muted">{f.label}</dt>
                <dd className="mt-1 font-medium break-words">{f.value}</dd>
              </div>
            ))}
          </dl>

          <div className="max-w-2xl">
            {outcome && (
              <section aria-labelledby="ws-outcome" className="mb-12">
                <h2 id="ws-outcome" className="text-sm text-muted mb-3">
                  {S.outcome}
                </h2>
                <p className="text-[clamp(1.5rem,3.4vw,2.25rem)] font-semibold leading-snug text-pretty">
                  <span className="mark">{outcome}</span>
                </p>
              </section>
            )}

            <section aria-labelledby="ws-about">
              <h2 id="ws-about" className="text-sm text-muted mb-3">
                {S.about}
              </h2>
              <p className="text-lg leading-relaxed whitespace-pre-wrap text-pretty">{localized(w.description, '', locale)}</p>
              {extra && <p className="mt-5 text-muted leading-relaxed whitespace-pre-wrap text-pretty">{extra}</p>}
            </section>

            {recap && (
              <section aria-labelledby="ws-recap" className="mt-12">
                <h2 id="ws-recap" className="text-sm text-muted mb-3">
                  {S.recap}
                </h2>
                <p className="text-lg leading-relaxed whitespace-pre-wrap text-pretty">{recap}</p>
              </section>
            )}

            <div className="mt-12 flex flex-wrap items-center gap-3">
              {!past && w.registration_url && (
                <a href={w.registration_url} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY}>
                  {S.register}
                </a>
              )}
              <button
                type="button"
                onClick={share}
                className="inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-md border border-border-strong font-semibold hover:border-ink transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Share2 className="w-4 h-4" />}
                {copied ? S.copied : S.share}
              </button>
              <span role="status" className="sr-only">
                {copied ? S.copied : ''}
              </span>
            </div>
          </div>
        </div>

        {w.gallery.length > 0 && (
          <section className="mt-16 border-t border-ink pt-5" aria-labelledby="ws-gallery">
            <h2 id="ws-gallery" className="text-xl font-semibold mb-6">
              {S.gallery}
            </h2>
            <ul className="columns-2 md:columns-3 gap-3">
              {w.gallery.map((src, i) => (
                <li key={src} className="mb-3 break-inside-avoid">
                  <button
                    type="button"
                    onClick={() => setLightbox(i)}
                    aria-label={S.photo(i + 1, w.gallery.length)}
                    className="block w-full overflow-hidden rounded-md bg-panel-2 cursor-pointer"
                  >
                    <img src={src} alt="" loading="lazy" className="w-full h-auto block transition-opacity hover:opacity-90" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      {lightbox !== null && (
        <Lightbox images={w.gallery} index={lightbox} onIndexChange={setLightbox} onClose={() => setLightbox(null)} />
      )}
    </PublicShell>
  );
};

export default WorkshopDetailPage;
