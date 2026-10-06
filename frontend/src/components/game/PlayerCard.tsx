import React from 'react';
import { Logo } from '../brand';
import Avatar from './Avatar';
import './game.css';

interface Props {
  id: string;
  name: string;
  avatarId?: number | null;
  avatarUrl?: string | null;
  /** `lg` is the player's own card on their phone, `md` fills the host lobby, `sm` is dense. */
  size?: 'sm' | 'md' | 'lg';
  /** Hang it from a lanyard (the player's own card). */
  strap?: boolean;
  /** Plays the swing-in. Only for a card that just arrived. */
  entering?: boolean;
  /** Small line under the name, e.g. "Ready" or a score. */
  caption?: string;
}

const dims = {
  sm: { w: 'w-36', logo: 'h-5', avatar: 44, name: 'text-base', pad: 'px-3 pt-3 pb-3', gap: 'gap-2' },
  md: { w: 'w-44', logo: 'h-6', avatar: 56, name: 'text-xl', pad: 'px-4 pt-4 pb-4', gap: 'gap-3' },
  lg: { w: 'w-56', logo: 'h-8', avatar: 84, name: 'text-3xl', pad: 'px-5 pt-6 pb-5', gap: 'gap-4' },
} as const;

/**
 * The lanyard ID badge from the identity deck, as a player card: black stock
 * with the maze pattern, the brain mark on top, the name set like the deck's
 * "Name" line (turquoise, display face), SKILLTURE tracked out at the foot.
 */
const PlayerCard: React.FC<Props> = ({ id, name, avatarId, avatarUrl, size = 'md', strap = false, entering = false, caption }) => {
  const d = dims[size];
  return (
    <div className={`flex flex-col items-center ${entering ? 'game-badge-in' : ''}`}>
      {strap && (
        <div aria-hidden="true" className="flex flex-col items-center">
          <span className="block h-14 w-7 border-x border-primary-border bg-panel-3" />
          <span className="-mt-1.5 block h-5 w-5 rounded-full border-2 border-muted bg-transparent" />
        </div>
      )}
      <div
        className={`relative ${d.w} overflow-hidden rounded-2xl border border-primary-border bg-[#0d1818] text-center shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)] ${d.pad}`}
      >
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-primary" />
        <span aria-hidden="true" className="game-card-pattern text-primary opacity-[0.12]" />
        <div className={`relative flex flex-col items-center ${d.gap}`}>
          <span aria-hidden="true" className="block h-1.5 w-8 rounded-full bg-bg ring-1 ring-border-strong" />
          <Logo variant="icon" decorative className={`${d.logo} text-text`} />
          <Avatar id={id} avatarId={avatarId} avatarUrl={avatarUrl} size={d.avatar} className="!border-primary-border" />
          <p
            title={name}
            className={`font-display ${d.name} line-clamp-2 w-full break-words font-extrabold leading-tight tracking-wide text-primary`}
          >
            {name}
          </p>
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.32em] text-text">{caption ?? 'Player'}</p>
          <p aria-hidden="true" className="pt-1 text-[0.6rem] uppercase tracking-[0.4em] text-muted">
            Skillture
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
