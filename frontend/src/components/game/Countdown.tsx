import React from 'react';
import './game.css';

interface Props {
  /** Seconds left; null for an untimed question. */
  left: number | null;
  total: number;
  /** `host` is the big projector numeral; `phone` is a slim bar. */
  variant?: 'host' | 'phone';
}

/** Amber under a third of the time, never coral: coral means wrong or live. */
const Countdown: React.FC<Props> = ({ left, total, variant = 'phone' }) => {
  if (left === null) return null;
  const pct = total > 0 ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;
  const low = left <= Math.max(3, Math.floor(total / 3));
  const bar = low ? 'bg-warning' : 'bg-primary';

  if (variant === 'phone') {
    return (
      <div className="flex items-center gap-3" role="timer" aria-label={`${left} seconds left`}>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-3">
          <div
            className={`game-motion h-full rounded-full transition-[width] duration-1000 ease-linear ${bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`w-9 text-end font-display text-2xl font-extrabold tabular-nums ${low ? 'text-warning' : 'text-text'}`}>
          {left}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4" role="timer" aria-label={`${left} seconds left`}>
      <span
        key={left}
        className={`game-tick w-24 text-center font-display text-7xl font-extrabold leading-none tabular-nums ${low ? 'text-warning' : 'text-primary'}`}
      >
        {left}
      </span>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-panel-3">
        <div
          className={`game-motion h-full rounded-full transition-[width] duration-1000 ease-linear ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default Countdown;
