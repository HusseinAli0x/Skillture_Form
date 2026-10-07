import React from 'react';
import { Info } from 'lucide-react';
import { useSiteStrings } from '../../lib/useSiteContent';

/**
 * Tells a visitor, in plain words, that there is no account: their games live
 * in this browser and unused ones expire. Shown wherever games are listed or
 * edited, because losing a game to cleared browser data is the one surprise
 * this model can cause.
 */
const HostNote: React.FC<{ className?: string }> = ({ className = '' }) => {
  const note = useSiteStrings().host.note;
  return (
    <aside className={`flex items-start gap-3 rounded-xl border border-border bg-panel px-4 py-3 text-sm ${className}`}>
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-muted">
        <strong className="font-semibold text-text">{note.title}.</strong> {note.body}
      </p>
    </aside>
  );
};

export default HostNote;
