import React from 'react';

export type ChipTone = 'brand' | 'neutral' | 'warning' | 'info' | 'danger' | 'live';

interface Props {
  tone?: ChipTone;
  /** Leading dot. */
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

// Coral is reserved for destructive state and LIVE (docs/BRAND_UX.md), so
// `danger` and `live` are the only tones that use it.
const tones: Record<ChipTone, { chip: string; dot: string }> = {
  brand: { chip: 'bg-primary-soft border-primary-border text-primary', dot: 'bg-primary' },
  neutral: { chip: 'bg-panel-3 border-border-strong text-muted', dot: 'bg-muted' },
  warning: { chip: 'bg-warning-soft border-warning-border text-warning', dot: 'bg-warning' },
  info: { chip: 'bg-info-soft border-info/30 text-info', dot: 'bg-info' },
  danger: { chip: 'bg-danger-soft border-danger-border text-danger', dot: 'bg-danger' },
  live: { chip: 'bg-danger-soft border-danger-border text-danger', dot: 'bg-danger' },
};

/** Small status pill. Read-only; see StatusDropdown for the editable variant. */
const StatusChip: React.FC<Props> = ({ tone = 'neutral', dot = true, className = '', children }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${tones[tone].chip} ${className}`}
  >
    {dot && (
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {tone === 'live' && (
          <span className={`motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${tones.live.dot}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${tones[tone].dot}`} />
      </span>
    )}
    {children}
  </span>
);

export default StatusChip;
