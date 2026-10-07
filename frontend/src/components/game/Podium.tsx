import React from 'react';
import { Crown } from 'lucide-react';
import type { QuizPlayer } from '../../api/types';
import CountUp from './CountUp';
import { PlayerAvatar } from './PlayerBubble';

const MEDALS = ['#ffd84d', '#c9d6d8', '#e0a15f'];

/**
 * Top three on podium blocks (2nd, 1st, 3rd left to right), rising 3rd, 2nd,
 * then 1st for suspense. Works with one or two players too.
 */
const Podium: React.FC<{ players: QuizPlayer[] }> = ({ players }) => {
  const top = players.slice(0, 3);
  // Visual order: 2nd, 1st, 3rd, keeping the original index for rank and height.
  const order = [1, 0, 2].filter(i => top[i]);
  const heights = ['16rem', '12rem', '9rem'];
  const delay = [0.9, 0.5, 0.1];

  return (
    <ol className="flex items-end justify-center gap-3 sm:gap-6 w-full max-w-3xl mx-auto" dir="ltr">
      {order.map(i => {
        const p = top[i];
        return (
          <li key={p.id} className="flex-1 min-w-0 flex flex-col items-center">
            <div className="game-pop flex flex-col items-center gap-2 mb-3" style={{ animationDelay: `${delay[i] + 0.5}s` }}>
              {i === 0 && <Crown className="w-10 h-10 text-mark game-float" aria-hidden="true" />}
              <PlayerAvatar player={p} size={i === 0 ? 84 : 64} />
              <span className="text-xl sm:text-2xl font-semibold text-center max-w-full truncate">{p.name}</span>
              <CountUp to={p.score} className="text-xl font-semibold text-muted" durationMs={1400} />
            </div>
            <div
              className="game-grow-y w-full rounded-t-2xl flex items-start justify-center pt-4"
              style={{ height: heights[i], background: MEDALS[i], animationDelay: `${delay[i]}s` }}
            >
              <span className="numeral text-5xl font-semibold text-ink">{i + 1}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default Podium;
