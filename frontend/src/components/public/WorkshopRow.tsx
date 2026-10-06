import React from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import type { PublicWorkshop } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';
import { localized } from '../../lib/i18n';
import { siteStrings } from '../../lib/siteStrings';

const dateParts = (iso: string, locale: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { day: '', month: iso };
  const tag = locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString(tag, { month: 'short', year: 'numeric' }),
  };
};

/**
 * One workshop as a ruled row — date, title, result, track, turnout — like a
 * line on a results sheet. Rows scan faster than a wall of cards, and the
 * outcome gets the highlighter mark.
 */
const WorkshopRow: React.FC<{ workshop: PublicWorkshop; upcoming?: boolean }> = ({ workshop: w, upcoming = false }) => {
  const locale = useLanguageStore(s => s.locale);
  const S = siteStrings[locale];
  const outcome = localized(w.outcome, '', locale);
  const { day, month } = dateParts(w.event_date, locale);
  const track = w.track ? S.tracks[w.track] : null;

  const meta = [track, w.attendees != null ? S.ourWork.attendeesCount(w.attendees) : null, w.location]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      to={`/workshops/${w.id}`}
      className="group grid grid-cols-[4.5rem_1fr_auto] md:grid-cols-[6rem_1fr_9rem_9rem_1.5rem] gap-x-5 gap-y-1 items-start py-6 border-t border-border hover:bg-hover-overlay transition-colors"
    >
      <div>
        <div className="numeral text-4xl md:text-5xl">{day}</div>
        <div className="mt-1.5 text-xs text-muted">{month}</div>
      </div>

      <div className="min-w-0">
        <h3 className="text-lg md:text-xl font-semibold leading-snug text-pretty group-hover:underline underline-offset-4 decoration-1">
          {localized(w.title, '', locale)}
        </h3>
        {outcome && (
          <p className="mt-2 text-base font-medium leading-relaxed text-pretty">
            <span className="mark">{outcome}</span>
          </p>
        )}
        {meta && <p className="mt-2 text-sm text-muted md:hidden">{meta}</p>}
      </div>

      <div className="hidden md:block text-sm text-muted pt-1.5">{track}</div>
      <div className="hidden md:block text-sm pt-1.5">
        {upcoming && w.registration_url ? (
          <span className="font-semibold text-primary">{S.workshop.register}</span>
        ) : w.attendees != null ? (
          <span className="text-muted">{S.ourWork.attendeesCount(w.attendees)}</span>
        ) : null}
      </div>

      <ArrowRight className="w-5 h-5 mt-1.5 justify-self-end transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
    </Link>
  );
};

export const WorkshopRows: React.FC<{ workshops: PublicWorkshop[]; upcoming?: boolean }> = ({ workshops, upcoming }) => (
  <ul className="border-b border-border">
    {workshops.map(w => (
      <li key={w.id}>
        <WorkshopRow workshop={w} upcoming={upcoming} />
      </li>
    ))}
  </ul>
);

export default WorkshopRow;
