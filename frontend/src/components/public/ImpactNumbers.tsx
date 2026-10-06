import React from 'react';
import type { Impact } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';
import { siteStrings } from '../../lib/siteStrings';

/**
 * The headline figures as large plain numerals. Colour comes from the
 * surrounding band, and every number is computed from the workshops actually
 * listed — nothing here is typed in by hand.
 */
const ImpactNumbers: React.FC<{ impact: Impact }> = ({ impact }) => {
  const locale = useLanguageStore(s => s.locale);
  const L = siteStrings[locale].ourWork.impact;
  const tracksCovered = Object.values(impact.tracks).filter(n => n > 0).length;
  const fmt = (n: number) => n.toLocaleString('en-US');

  const stats = [
    { value: fmt(impact.workshops_held), label: L.held },
    { value: fmt(impact.attendees_total), label: L.attendees },
    { value: String(tracksCovered), label: L.tracks },
  ];

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-y-8">
      {stats.map((s, i) => (
        <div key={s.label} className={i > 0 ? 'sm:ps-8 sm:border-s border-border' : ''}>
          <dd className="numeral text-[clamp(3.5rem,9vw,6.5rem)]">{s.value}</dd>
          <dt className="mt-3 text-sm text-muted">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
};

export default ImpactNumbers;
