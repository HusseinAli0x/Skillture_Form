import React from 'react';
import { Link } from 'react-router';
import { Calendar, MapPin, TrendingUp, Users } from 'lucide-react';
import type { PublicWorkshop } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';
import { formatDate } from '../../lib/formatDate';
import { localized } from '../../lib/i18n';
import { siteStrings } from '../../lib/siteStrings';
import TrackBadge from './TrackBadge';

/** Card for one workshop; the whole card links to its shareable detail page. */
const WorkshopCard: React.FC<{ workshop: PublicWorkshop }> = ({ workshop: w }) => {
  const locale = useLanguageStore(s => s.locale);
  const S = siteStrings[locale];
  const outcome = localized(w.outcome, '', locale);

  return (
    <Link
      to={`/workshops/${w.id}`}
      className="group bg-panel border border-border rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-primary-border hover:shadow-lg focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="aspect-video bg-panel-2 overflow-hidden">
        {w.image_path ? (
          <img
            src={w.image_path}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted">
            <Calendar className="w-8 h-8" />
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1 gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TrackBadge track={w.track} />
          <span className="text-xs text-muted">{formatDate(w.event_date, locale)}</span>
        </div>
        <h3 className="text-[17px] font-bold text-text leading-snug text-pretty">{localized(w.title, '', locale)}</h3>
        {outcome && (
          <p className="inline-flex items-start gap-2 text-sm font-semibold text-primary">
            <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="text-pretty">{outcome}</span>
          </p>
        )}
        <div className="mt-auto pt-1 flex items-center gap-4 text-xs text-muted flex-wrap">
          {w.attendees != null && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" /> {S.ourWork.attendeesCount(w.attendees)}
            </span>
          )}
          {w.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" /> {w.location}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default WorkshopCard;
