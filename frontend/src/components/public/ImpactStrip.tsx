import React from 'react';
import type { Impact } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';
import { siteStrings } from '../../lib/siteStrings';

/** Headline numbers, computed server-side from the workshops actually listed. */
const ImpactStrip: React.FC<{ impact: Impact }> = ({ impact }) => {
  const locale = useLanguageStore(s => s.locale);
  const S = siteStrings[locale].ourWork.impact;
  const tracksCovered = Object.values(impact.tracks).filter(n => n > 0).length;
  const fmt = (n: number) => n.toLocaleString('en-US');

  const stats = [
    { value: fmt(impact.workshops_held), label: S.held },
    { value: fmt(impact.attendees_total), label: S.attendees },
    { value: String(tracksCovered), label: S.tracks },
    { value: fmt(impact.workshops_upcoming), label: S.upcoming },
  ];

  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map(s => (
        <div key={s.label} className="bg-panel border border-border rounded-2xl px-5 py-5">
          <dd className="text-3xl font-extrabold text-primary tabular-nums leading-none mb-2">{s.value}</dd>
          <dt className="text-xs sm:text-sm text-muted">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
};

export default ImpactStrip;
