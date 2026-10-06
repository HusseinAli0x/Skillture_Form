import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Calendar, Check, Clock, MapPin, Share2, TrendingUp, User, Users } from 'lucide-react';
import { isAxiosError } from 'axios';
import client from '../api/client';
import type { PublicWorkshop } from '../api/publicTypes';
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
    <Link
      to="/our-work"
      className="inline-flex items-center gap-2 min-h-11 text-sm font-medium text-muted hover:text-primary transition-colors"
    >
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
        <div className="max-w-xl mx-auto px-5 py-24 text-center">
          <h1 className="text-2xl font-bold text-text mb-2">{S.notFoundTitle}</h1>
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

  const meta = [
    { icon: Calendar, label: S.when, value: [formatDate(w.event_date, locale), w.event_time].filter(Boolean).join(' · ') },
    w.location && { icon: MapPin, label: S.where, value: w.location },
    w.speaker && { icon: User, label: S.speaker, value: w.speaker },
    w.attendees != null && { icon: Users, label: S.attendees, value: w.attendees.toLocaleString('en-US') },
  ].filter((m): m is { icon: typeof Clock; label: string; value: string } => Boolean(m));

  return (
    <PublicShell>
      <article className="max-w-3xl mx-auto px-5 sm:px-8 pt-6 pb-20">
        {back}

        {w.image_path && (
          <div className="mt-3 aspect-video rounded-2xl overflow-hidden bg-panel-2 border border-border">
            <img src={w.image_path} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="mt-7 flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border ${
              past ? 'bg-panel-2 text-muted border-border' : 'bg-success-soft text-success border-success/30'
            }`}
          >
            {past ? S.completed : S.upcoming}
          </span>
          <TrackBadge track={w.track} />
        </div>

        <h1
          className="mt-4 font-extrabold tracking-tight text-text leading-tight text-pretty"
          style={{ fontSize: 'clamp(28px,4.6vw,40px)' }}
        >
          {title}
        </h1>

        <dl className="mt-6 grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
          {meta.map(m => (
            <div key={m.label} className="flex items-start gap-3 bg-panel border border-border rounded-xl px-4 py-3">
              <m.icon className="w-4 h-4 mt-1 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <dt className="text-xs text-muted">{m.label}</dt>
                <dd className="text-sm font-semibold text-text break-words">{m.value}</dd>
              </div>
            </div>
          ))}
        </dl>

        {outcome && (
          <aside className="mt-8 flex items-start gap-3 rounded-2xl border border-primary-border bg-primary-soft px-5 py-5">
            <TrendingUp className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold tracking-wider uppercase text-primary mb-1">{S.outcome}</p>
              <p className="text-lg font-bold text-text text-pretty">{outcome}</p>
            </div>
          </aside>
        )}

        <section className="mt-9" aria-labelledby="ws-about">
          <h2 id="ws-about" className="text-lg font-bold text-text mb-3">
            {S.about}
          </h2>
          <p className="leading-relaxed text-text/90 whitespace-pre-wrap text-pretty">
            {localized(w.description, '', locale)}
          </p>
          {extra && <p className="mt-4 pt-4 border-t border-border leading-relaxed text-muted whitespace-pre-wrap text-pretty">{extra}</p>}
        </section>

        {recap && (
          <section className="mt-9" aria-labelledby="ws-recap">
            <h2 id="ws-recap" className="text-lg font-bold text-text mb-3">
              {S.recap}
            </h2>
            <p className="leading-relaxed text-text/90 whitespace-pre-wrap text-pretty">{recap}</p>
          </section>
        )}

        {w.gallery.length > 0 && (
          <section className="mt-9" aria-labelledby="ws-gallery">
            <h2 id="ws-gallery" className="text-lg font-bold text-text mb-3">
              {S.gallery}
            </h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {w.gallery.map((src, i) => (
                <li key={src}>
                  <button
                    type="button"
                    onClick={() => setLightbox(i)}
                    aria-label={S.photo(i + 1, w.gallery.length)}
                    className="block w-full aspect-square rounded-xl overflow-hidden bg-panel-2 border border-border hover:border-primary-border transition-colors cursor-pointer"
                  >
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-3">
          {!past && w.registration_url && (
            <a
              href={w.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center min-h-12 px-7 rounded-lg bg-primary text-bg font-bold hover:bg-primary-hover transition-colors"
            >
              {S.register}
            </a>
          )}
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-lg border border-border bg-panel text-text font-semibold hover:border-primary-border hover:text-primary transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-primary" /> : <Share2 className="w-4 h-4" />}
            {copied ? S.copied : S.share}
          </button>
          <span role="status" className="sr-only">
            {copied ? S.copied : ''}
          </span>
        </div>
      </article>

      {lightbox !== null && (
        <Lightbox
          images={w.gallery}
          index={lightbox}
          onIndexChange={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </PublicShell>
  );
};

export default WorkshopDetailPage;
