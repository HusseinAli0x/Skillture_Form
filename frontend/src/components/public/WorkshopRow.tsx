import React from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import type { PublicWorkshop } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';
import { localized } from '../../lib/i18n';
import { useSiteStrings } from '../../lib/useSiteContent';

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
  const S = useSiteStrings();
  const outcome = localized(w.outcome, '', locale);
  const { day, month } = dateParts(w.event_date, locale);
  const track = w.track ? S.tracks[w.track] : null;

  const meta = [track, w.attendees != null ? S.ourWork.attendeesCount(w.attendees) : null, w.location]
    .filter(Boolean)
    .join(' · ');

  // A row is one big link to the workshop, but "Register" is a second link
  // inside it (to the form on that page). Nested anchors are invalid, so the
  // title link is stretched over the row and Register sits above it.
  const status = upcoming ? w.registration_status : undefined;
  const action =
    status === 'open' ? (
      <Link
        to={`/workshops/${w.id}#register`}
        className="relative z-10 inline-flex items-center min-h-11 font-semibold text-primary underline underline-offset-4 decoration-1 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {S.workshop.registration.register}
      </Link>
    ) : status === 'full' ? (
      <span className="inline-flex items-center min-h-7 rounded-full border border-border-strong px-3 text-xs font-semibold">
        {S.workshop.registration.full}
      </span>
    ) : !upcoming && w.attendees != null ? (
      <span className="text-muted">{S.ourWork.attendeesCount(w.attendees)}</span>
    ) : null;

  return (
    <div className="group relative grid grid-cols-[4.5rem_1fr_auto] md:grid-cols-[6rem_1fr_9rem_9rem_1.5rem] gap-x-5 gap-y-1 items-start py-6 border-t border-border hover:bg-hover-overlay transition-colors">
      <div>
        <div className="numeral text-4xl md:text-5xl">{day}</div>
        <div className="mt-1.5 text-xs text-muted">{month}</div>
      </div>

      <div className="min-w-0">
        <h3 className="text-xl md:text-2xl leading-snug text-pretty group-hover:underline underline-offset-4 decoration-1">
          <Link
            to={`/workshops/${w.id}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-primary"
          >
            {localized(w.title, '', locale)}
          </Link>
        </h3>
        {outcome && (
          <p className="mt-2 text-base font-medium leading-relaxed text-pretty">
            <span className="mark">{outcome}</span>
          </p>
        )}
        {meta && <p className="mt-2 text-sm text-muted md:hidden">{meta}</p>}
      </div>

      <div className="hidden md:block text-sm text-muted pt-1.5">{track}</div>
      {action && (
        <div
          className={`col-start-2 row-start-2 md:col-start-auto md:row-start-auto md:block text-sm md:pt-1.5 ${
            status === 'open' || status === 'full' ? '' : 'hidden'
          }`}
        >
          {action}
        </div>
      )}
      {!action && <div className="hidden md:block" aria-hidden="true" />}

      <ArrowRight
        aria-hidden="true"
        className="col-start-3 row-start-1 md:col-start-auto md:row-start-auto w-5 h-5 mt-1.5 justify-self-end transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
      />
    </div>
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
