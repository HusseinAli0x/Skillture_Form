import React from 'react';

interface Props {
  /** Remaining time and total, in milliseconds. */
  remainingMs: number;
  totalMs: number;
  size?: number;
  /** Shown in the middle; defaults to whole seconds left. */
  children?: React.ReactNode;
}

/**
 * Circular countdown that turns amber, then red, as time runs out. The number
 * is for reading, the ring is for glancing across a classroom.
 */
const TimerRing: React.FC<Props> = ({ remainingMs, totalMs, size = 120, children }) => {
  const stroke = Math.max(8, size / 10);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const colour = fraction > 0.5 ? '#2fbf71' : fraction > 0.2 ? '#ffd84d' : '#f25c54';
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${fraction <= 0.2 && fraction > 0 ? 'game-pulse' : ''}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${seconds} seconds left`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <span className="absolute numeral font-semibold" style={{ fontSize: size * 0.36 }}>
        {children ?? seconds}
      </span>
    </div>
  );
};

export default TimerRing;
