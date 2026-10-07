import React, { useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isMuted, setMuted, subscribeMuted } from '../../lib/game/sound';

/** Sound on/off, remembered between games. Always reachable: sound in a room is a choice. */
const MuteButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={muted}
      className={`inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer ${className}`}
    >
      {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
    </button>
  );
};

export default MuteButton;
