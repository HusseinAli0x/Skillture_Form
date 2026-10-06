import React from 'react';
import type { WorkshopTrack } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';
import { siteStrings } from '../../lib/siteStrings';

const TrackBadge: React.FC<{ track: WorkshopTrack | null }> = ({ track }) => {
  const locale = useLanguageStore(s => s.locale);
  if (!track) return null;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-primary-soft text-primary border border-primary-border">
      {siteStrings[locale].tracks[track]}
    </span>
  );
};

export default TrackBadge;
