import React from 'react';
import type { QuizPlayer } from '../../api/types';
import { avatarForPlayer } from '../../lib/avatars';

/** A player's avatar (glyph or uploaded photo) in a round badge. */
export const PlayerAvatar: React.FC<{ player: Pick<QuizPlayer, 'id' | 'avatar_id' | 'avatar_url'>; size?: number }> = ({
  player,
  size = 48,
}) => {
  const avatar = avatarForPlayer(player.id, player.avatar_id);
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center overflow-hidden rounded-full bg-white/10 border-2 border-white/25 flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {player.avatar_url ? (
        <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span style={{ color: avatar.color, fontSize: size * 0.5 }} className="leading-none">
          {avatar.glyph}
        </span>
      )}
    </span>
  );
};

/** Lobby bubble: pops in when the player arrives, then floats gently. */
const PlayerBubble: React.FC<{ player: QuizPlayer; index: number }> = ({ player, index }) => (
  <li
    className="game-pop"
    style={{ animationDelay: '0s' }}
  >
    <span
      className="game-float inline-flex items-center gap-3 pe-5 ps-2 py-2 rounded-full bg-panel-2 border border-border-strong text-lg font-semibold"
      style={{ animationDelay: `${(index % 7) * 0.35}s` }}
    >
      <PlayerAvatar player={player} size={40} />
      <span className="max-w-[12rem] truncate">{player.name}</span>
    </span>
  </li>
);

export default PlayerBubble;
