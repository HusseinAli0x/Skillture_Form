import React from 'react';

interface SkeletonProps {
  /** Tailwind size classes, e.g. "h-4 w-32". */
  className?: string;
}

/** A pulsing placeholder block. Respects reduced motion via Tailwind's `motion-safe`. */
export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => (
  <span
    aria-hidden="true"
    className={`block rounded-md bg-panel-3/70 motion-safe:animate-pulse ${className}`}
  />
);

interface SkeletonRowsProps {
  rows?: number;
  /** Accessible label announced while content loads. */
  label?: string;
  className?: string;
}

/** Stacked list-row placeholders (icon tile, two text lines, a chip). */
export const SkeletonRows: React.FC<SkeletonRowsProps> = ({
  rows = 4,
  label = 'Loading',
  className = '',
}) => (
  <div role="status" aria-label={label} className={className}>
    {Array.from({ length: rows }, (_, i) => (
      <div
        key={i}
        className={`flex items-center gap-3 px-5 py-3.5 ${i < rows - 1 ? 'border-b border-border' : ''}`}
      >
        <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    ))}
  </div>
);

export default Skeleton;
