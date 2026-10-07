import React from 'react';
import type { Impact } from '../../api/publicTypes';
import { useSiteStrings } from '../../lib/useSiteContent';

/**
 * The headline figures as large plain numerals in brand turquoise, meant for a
 * black band (turquoise is a surface colour, not text, on white). Every number is computed from the workshops actually
 * listed — nothing here is typed in by hand.
 */
const ImpactNumbers: React.FC<{ impact: Impact }> = ({ impact }) => {
  const L = useSiteStrings().ourWork.impact;
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
          <dd className="numeral text-brand text-[clamp(3.5rem,9vw,6.5rem)]">{s.value}</dd>
          <dt className="mt-3 text-base text-muted">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
};

export default ImpactNumbers;
