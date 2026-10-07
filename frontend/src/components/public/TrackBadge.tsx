import React from 'react';
import type { WorkshopTrack } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';
import { siteStrings } from '../../lib/siteStrings';

/** Plain outlined tag; the label is the information, not the decoration. */
const TrackBadge: React.FC<{ track: WorkshopTrack | null }> = ({ track }) => {
  const locale = useLanguageStore(s => s.locale);
  if (!track) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-border-strong text-xs font-medium">
      {siteStrings[locale].tracks[track]}
    </span>
  );
};

export default TrackBadge;
