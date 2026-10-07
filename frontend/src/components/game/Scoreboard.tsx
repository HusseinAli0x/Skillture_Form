import React from 'react';
import { ArrowDown, ArrowUp, Crown } from 'lucide-react';
import type { QuizPlayer } from '../../api/types';
import CountUp from './CountUp';
import { PlayerAvatar } from './PlayerBubble';
import { useGameLocale } from '../../lib/game/useGameLocale';
import { hostStrings } from '../../lib/game/hostStrings';

export interface ScoreRow {
  player: QuizPlayer;
  rank: number;
  /** Rank on the previous scoreboard, if the player was on it. */
  previousRank?: number;
  previousScore: number;
}

/** Top of the table with animated bars and rank-change arrows. */
const Scoreboard: React.FC<{ rows: ScoreRow[] }> = ({ rows }) => {
  const { locale } = useGameLocale();
  const H = hostStrings[locale];
  const top = Math.max(1, rows[0]?.player.score ?? 1);

  return (
    <ol className="w-full max-w-3xl mx-auto space-y-3">
      {rows.map((row, i) => {
        const change = row.previousRank !== undefined ? row.previousRank - row.rank : 0;
        const pct = Math.max(6, Math.round((row.player.score / top) * 100));
        return (
          <li
            key={row.player.id}
            className="game-rise flex items-center gap-4 rounded-2xl bg-panel-2 border border-border px-4 sm:px-6 py-4"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <span className="numeral text-3xl font-semibold w-9 text-center text-muted flex-shrink-0">
              {row.rank === 1 ? <Crown className="w-8 h-8 text-mark mx-auto" aria-label={H.firstPlace} /> : row.rank}
            </span>
            <PlayerAvatar player={row.player} size={52} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xl sm:text-2xl font-semibold truncate">{row.player.name}</span>
                {change !== 0 && (
                  <span
                    className={`inline-flex items-center gap-1 text-sm font-semibold flex-shrink-0 ${
                      change > 0 ? 'text-leaf' : 'text-coral'
                    }`}
                    aria-label={change > 0 ? H.rankUp(change) : H.rankDown(-change)}
                  >
                    {change > 0 ? <ArrowUp className="w-4 h-4" aria-hidden="true" /> : <ArrowDown className="w-4 h-4" aria-hidden="true" />}
                    {Math.abs(change)}
                  </span>
                )}
              </div>
              <div className="mt-2 h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="game-wipe h-full rounded-full bg-primary"
                  style={{ width: `${pct}%`, animationDelay: `${i * 0.1 + 0.15}s` }}
                />
              </div>
            </div>
            <CountUp from={row.previousScore} to={row.player.score} className="text-2xl sm:text-3xl font-semibold flex-shrink-0 min-w-[4.5rem] text-end" />
          </li>
        );
      })}
    </ol>
  );
};

export default Scoreboard;
