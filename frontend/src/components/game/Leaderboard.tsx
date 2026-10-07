import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { QuizPlayer } from '../../api/types';
import Avatar from './Avatar';
import { useCountUp } from './hooks';
import { rankChanges } from './gameLogic';
import './game.css';

interface Props {
  /** Current standings, best first. */
  rows: QuizPlayer[];
  /** Standings before this question. Rows glide from there to here and show rank movement. */
  previous?: QuizPlayer[];
  variant?: 'host' | 'phone';
  /** Highlights the viewer's own row. */
  meId?: string | null;
  limit?: number;
}

const SIZES = {
  host: { row: 84, gap: 10, avatar: 52, name: 'text-3xl', score: 'text-3xl', rank: 'text-4xl w-14', pad: 'px-5' },
  phone: { row: 60, gap: 6, avatar: 36, name: 'text-base', score: 'text-lg', rank: 'text-xl w-8', pad: 'px-3' },
} as const;

const Row: React.FC<{
  player: QuizPlayer;
  rank: number;
  slot: number;
  fromScore: number;
  delta: number;
  showDelta: boolean;
  me: boolean;
  variant: 'host' | 'phone';
}> = ({ player, rank, slot, fromScore, delta, showDelta, me, variant }) => {
  const s = SIZES[variant];
  const score = useCountUp(player.score, fromScore, 900);
  return (
    <li
      className={`game-motion absolute inset-x-0 top-0 flex items-center gap-3 rounded-2xl border transition-transform duration-700 ease-out ${s.pad} ${
        me ? 'border-primary bg-primary-soft' : 'border-border bg-panel'
      }`}
      style={{ height: s.row - s.gap, transform: `translateY(${slot * s.row}px)` }}
    >
      <span className={`shrink-0 text-center font-display font-extrabold tabular-nums ${s.rank} ${rank === 1 ? 'text-primary' : 'text-muted'}`}>
        {rank}
      </span>
      <Avatar id={player.id} avatarId={player.avatar_id} avatarUrl={player.avatar_url} size={s.avatar} />
      <span className={`min-w-0 flex-1 truncate font-display font-bold ${s.name} ${me ? 'text-primary' : 'text-text'}`}>
        {player.name}
        {me && <span className="ms-2 text-xs font-medium uppercase tracking-widest text-muted">you</span>}
      </span>
      {showDelta && delta !== 0 && (
        <span
          className={`game-pop inline-flex shrink-0 items-center gap-0.5 text-sm font-bold ${delta > 0 ? 'text-primary' : 'text-muted'}`}
          aria-label={delta > 0 ? `up ${delta}` : `down ${-delta}`}
        >
          {delta > 0 ? <ArrowUp className="h-4 w-4" aria-hidden="true" /> : <ArrowDown className="h-4 w-4" aria-hidden="true" />}
          {Math.abs(delta)}
        </span>
      )}
      <span className={`shrink-0 font-display font-extrabold tabular-nums text-text ${s.score}`}>{score}</span>
    </li>
  );
};

/**
 * Standings that move. Rows start where they stood before the question, then
 * glide to their new place (CSS transform, so it is smooth on a phone and a
 * projector alike) while the scores count up. Under reduced motion they just
 * appear in the new order.
 */
const Leaderboard: React.FC<Props> = ({ rows, previous, variant = 'host', meId, limit = 8 }) => {
  const s = SIZES[variant];
  const [settled, setSettled] = useState(!previous);

  useEffect(() => {
    if (!previous) return;
    const t = setTimeout(() => setSettled(true), 650);
    return () => clearTimeout(t);
  }, [previous]);

  const shown = rows.slice(0, limit);
  // Before anyone has scored, "previous" is just join order — movement from it means nothing.
  const changes = useMemo(
    () => (previous?.some(p => p.score > 0) ? rankChanges(previous, rows) : {}),
    [previous, rows]
  );
  const prevIndex = useMemo(() => new Map((previous ?? []).map((p, i) => [p.id, i])), [previous]);
  const prevScore = useMemo(() => new Map((previous ?? []).map(p => [p.id, p.score])), [previous]);

  return (
    <ol className="relative w-full" style={{ height: shown.length * s.row - s.gap }}>
      {shown.map((p, i) => {
        const was = prevIndex.get(p.id);
        const slot = !settled && was !== undefined ? Math.min(was, shown.length - 1) : i;
        return (
          <Row
            key={p.id}
            player={p}
            rank={i + 1}
            slot={slot}
            fromScore={prevScore.get(p.id) ?? 0}
            delta={changes[p.id] ?? 0}
            showDelta={settled}
            me={p.id === meId}
            variant={variant}
          />
        );
      })}
    </ol>
  );
};

export default Leaderboard;
