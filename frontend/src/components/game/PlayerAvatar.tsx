import React from 'react';
import { avatarForPlayer } from '../../lib/avatars';

interface Props {
  id: string;
  avatarId?: number | null;
  avatarUrl?: string | null;
  /** Pixel size of the round badge. */
  size?: number;
  className?: string;
}

/** A player's round badge: their photo if they uploaded one, otherwise their glyph. */
const PlayerAvatar: React.FC<Props> = ({ id, avatarId, avatarUrl, size = 48, className = '' }) => {
  const glyph = avatarForPlayer(id, avatarId);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 bg-panel-2 border-2 border-border-strong ${className}`}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span style={{ color: glyph.color, fontSize: size * 0.5 }} className="leading-none">
          {glyph.glyph}
        </span>
      )}
    </span>
  );
};

export default PlayerAvatar;
