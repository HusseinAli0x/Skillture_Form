import React from 'react';
import { Calendar, Clock, Copy, ExternalLink, MapPin, Pencil, Search, Trash2, User, Users, X } from 'lucide-react';
import { IconButton, Input, Select } from '../../ui';
import {
  TRACKS,
  needsRecap,
  phaseOf,
  type Phase,
  type Track,
  type Workshop,
  type WorkshopFilter,
} from './workshopModel';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const prettyDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : DATE_FMT.format(d);
};

const trackLabel = (t: Track) => TRACKS.find(x => x.value === t)?.label ?? t;

/* ------------------------------------------------------------------ toolbar */

interface ToolbarProps {
  filter: WorkshopFilter;
  onChange: (f: WorkshopFilter) => void;
  shown: number;
  total: number;
  counts: { upcoming: number; past: number };
}

export const WorkshopToolbar: React.FC<ToolbarProps> = ({ filter, onChange, shown, total, counts }) => {
  const phases: { value: Phase | 'all'; label: string; n: number }[] = [
    { value: 'all', label: 'All', n: total },
    { value: 'upcoming', label: 'Upcoming', n: counts.upcoming },
    { value: 'past', label: 'Past', n: counts.past },
  ];
  const filtered = filter.query !== '' || filter.phase !== 'all' || filter.track !== 'all';

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <Input
            type="search"
            aria-label="Search workshops"
            placeholder="Search title, speaker or location"
            value={filter.query}
            onChange={e => onChange({ ...filter, query: e.target.value })}
            className="!ps-9"
          />
        </div>
        <Select
          aria-label="Filter by track"
          value={filter.track}
          onChange={e => onChange({ ...filter, track: e.target.value as Track | 'all' })}
          className="sm:w-44"
        >
          <option value="all">All tracks</option>
          {TRACKS.map(t => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by status" className="inline-flex rounded-lg border border-border p-0.5 bg-bg">
          {phases.map(p => (
            <button
              key={p.value}
              type="button"
              aria-pressed={filter.phase === p.value}
              onClick={() => onChange({ ...filter, phase: p.value })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                filter.phase === p.value ? 'bg-primary text-bg' : 'text-muted hover:text-text'
              }`}
            >
              {p.label} <span className="opacity-70">{p.n}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted ms-auto" aria-live="polite">
          {filtered ? `Showing ${shown} of ${total}` : `${total} workshop${total === 1 ? '' : 's'}`}
        </p>
        {filtered && (
          <button
            type="button"
            onClick={() => onChange({ query: '', phase: 'all', track: 'all' })}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
          >
            <X aria-hidden="true" className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------- rows */

interface RowProps {
  workshop: Workshop;
  onEdit: (w: Workshop) => void;
  onDuplicate: (w: Workshop) => void;
  onDelete: (w: Workshop) => void;
}

const Row: React.FC<RowProps> = ({ workshop: w, onEdit, onDuplicate, onDelete }) => {
  const phase = phaseOf(w);
  const recap = needsRecap(w);
  return (
    <li className="group flex flex-col sm:flex-row sm:items-stretch gap-1 sm:gap-4 py-3 border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => onEdit(w)}
        aria-label={`Edit ${w.title.en}`}
        className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 text-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="w-20 sm:w-28 aspect-video shrink-0 overflow-hidden rounded-md border border-border bg-panel-2">
          {w.image_path ? (
            <img src={w.image_path} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted">
              <Calendar aria-hidden="true" className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                phase === 'upcoming' ? 'bg-primary-soft text-primary border border-primary-border' : 'bg-panel-3 text-muted'
              }`}
            >
              {phase === 'upcoming' ? 'Upcoming' : 'Past'}
            </span>
            {w.track && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-border-strong text-muted">
                {trackLabel(w.track)}
              </span>
            )}
            {recap && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-warning-border bg-warning-soft text-warning">
                Add results
              </span>
            )}
          </div>
          <p className="font-semibold text-text sm:truncate">{w.title.en}</p>
          <p lang="ar" dir="rtl" className="text-xs text-muted truncate w-fit max-w-full">
            {w.title.ar}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Calendar aria-hidden="true" className="w-3.5 h-3.5" /> {prettyDate(w.event_date)}
            </span>
            {w.event_time && (
              <span className="inline-flex items-center gap-1">
                <Clock aria-hidden="true" className="w-3.5 h-3.5" /> {w.event_time.slice(0, 5)}
              </span>
            )}
            {w.location && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[10rem]">{w.location}</span>
              </span>
            )}
            {w.speaker && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <User aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[10rem]">{w.speaker}</span>
              </span>
            )}
            {w.attendees != null && (
              <span className="inline-flex items-center gap-1">
                <Users aria-hidden="true" className="w-3.5 h-3.5" /> {w.attendees}
              </span>
            )}
          </div>
          {w.outcome?.en && <p className="mt-1 text-xs text-text/80 truncate">Outcome: {w.outcome.en}</p>}
        </div>
      </button>
      <div className="flex items-center justify-end gap-0.5 shrink-0 border-t border-border pt-1 sm:border-0 sm:pt-0">
        <a
          href={`/workshops/${w.id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${w.title.en} on the site`}
          title="View on site"
          className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ExternalLink aria-hidden="true" className="w-4 h-4" />
        </a>
        <IconButton label={`Duplicate ${w.title.en}`} tone="primary" onClick={() => onDuplicate(w)}>
          <Copy className="w-4 h-4" />
        </IconButton>
        <IconButton label={`Edit ${w.title.en}`} tone="primary" onClick={() => onEdit(w)}>
          <Pencil className="w-4 h-4" />
        </IconButton>
        <IconButton label={`Delete ${w.title.en}`} tone="danger" onClick={() => onDelete(w)}>
          <Trash2 className="w-4 h-4" />
        </IconButton>
      </div>
    </li>
  );
};

/* --------------------------------------------------------------------- list */

interface ListProps extends Omit<RowProps, 'workshop'> {
  heading: string;
  note?: string;
  workshops: Workshop[];
}

export const WorkshopGroup: React.FC<ListProps> = ({ heading, note, workshops, ...handlers }) => {
  if (workshops.length === 0) return null;
  return (
    <section aria-label={heading}>
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="text-sm font-bold text-text">
          {heading} <span className="text-muted font-medium">· {workshops.length}</span>
        </h2>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
      <ul className="rounded-xl border border-border bg-panel px-3 sm:px-4">
        {workshops.map(w => (
          <Row key={w.id} workshop={w} {...handlers} />
        ))}
      </ul>
    </section>
  );
};
