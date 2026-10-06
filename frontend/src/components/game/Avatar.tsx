import React from 'react';
import { avatarForPlayer } from '../../lib/avatars';

interface Props {
  id: string;
  avatarId?: number | null;
  avatarUrl?: string | null;
  /** Diameter in px. */
  size?: number;
  className?: string;
}

/** A player's avatar: their uploaded photo, or their picked glyph in its colour. */
const Avatar: React.FC<Props> = ({ id, avatarId, avatarUrl, size = 40, className = '' }) => {
  const a = avatarForPlayer(id, avatarId);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-panel-2 ${className}`}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span style={{ color: a.color, fontSize: size * 0.5 }} className="leading-none">
          {a.glyph}
        </span>
      )}
    </span>
  );
};

export default Avatar;
