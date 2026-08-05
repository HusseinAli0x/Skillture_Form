import React from 'react';

interface Props {
  /** Tailwind size classes, e.g. "w-8 h-8". */
  size?: string;
  className?: string;
}

/** The spinning ring, previously re-declared inline in at least six places. */
export const Spinner: React.FC<Props> = ({ size = 'w-8 h-8', className = '' }) => (
  <span
    role="status"
    aria-label="Loading"
    className={`${size} inline-block rounded-full border-2 border-primary border-t-transparent animate-spin ${className}`}
  />
);

interface LoadingStateProps {
  message?: string;
  className?: string;
}

/** Centred spinner with a caption, for panel and page loading states. */
export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading…', className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-20 ${className}`}>
    <Spinner className="mb-4" />
    <p className="text-sm text-muted">{message}</p>
  </div>
);

export default Spinner;
