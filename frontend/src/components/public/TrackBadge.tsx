import React from 'react';
import type { WorkshopTrack } from '../../api/publicTypes';
import { useSiteStrings } from '../../lib/useSiteContent';

/** Plain outlined tag; the label is the information, not the decoration. */
const TrackBadge: React.FC<{ track: WorkshopTrack | null }> = ({ track }) => {
  const S = useSiteStrings();
  if (!track) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-border-strong text-xs font-medium">
      {S.tracks[track]}
    </span>
  );
};

export default TrackBadge;
