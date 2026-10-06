import React from 'react';
import type { QuizPlayer } from '../../api/types';
import Avatar from './Avatar';
import './game.css';

interface Props {
  rows: QuizPlayer[];
  meId?: string | null;
  size?: 'host' | 'phone';
}

/** Podium order is 2nd, 1st, 3rd so the winner stands in the middle. */
const ORDER = [1, 0, 2];
const HEIGHT = ['h-40', 'h-56', 'h-28'];
const HEIGHT_PHONE = ['h-24', 'h-32', 'h-16'];

const Podium: React.FC<Props> = ({ rows, meId, size = 'host' }) => {
  const top = rows.slice(0, 3);
  if (top.length === 0) return null;
  const host = size === 'host';
  return (
    <div className="flex items-end justify-center gap-3 border-b-2 border-primary-border sm:gap-5" role="list" aria-label="Top three">
      {ORDER.map(i => {
        const p = top[i];
        if (!p) return <div key={i} className={host ? 'w-48' : 'w-24'} aria-hidden="true" />;
        const me = p.id === meId;
        return (
          <div
            key={p.id}
            role="listitem"
            className={`game-rise flex flex-col items-center ${host ? 'w-48' : 'w-24'}`}
            style={{ animationDelay: `${(2 - i) * 0.28}s` }}
          >
            <Avatar id={p.id} avatarId={p.avatar_id} avatarUrl={p.avatar_url} size={host ? 84 : 52} className={i === 0 ? '!border-primary' : ''} />
            <p className={`mt-2 w-full truncate text-center font-display font-bold ${host ? 'text-2xl' : 'text-sm'} ${me ? 'text-primary' : ''}`}>{p.name}</p>
            <p className={`font-display font-extrabold tabular-nums text-muted ${host ? 'text-xl' : 'text-sm'}`}>{p.score}</p>
            <div
              className={`mt-2 flex w-full items-start justify-center rounded-t-xl border border-b-0 pt-2 font-display font-extrabold ${
                host ? HEIGHT[i] : HEIGHT_PHONE[i]
              } ${host ? 'text-6xl' : 'text-3xl'} ${i === 0 ? 'border-primary bg-primary text-ink' : 'border-border-strong bg-panel-2 text-text'}`}
            >
              {i + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Podium;
