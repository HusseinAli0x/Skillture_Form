import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Pattern } from '../brand';
import { BTN_INK, WRAP } from './layout';
import { useSiteStrings } from '../../lib/useSiteContent';

/** An error that always offers the way out: a retry button. */
export const LoadError: React.FC<{ title?: string; message: string; onRetry: () => void }> = ({ title, message, onRetry }) => {
  const S = useSiteStrings();
  return (
    <div role="alert" className={`${WRAP} py-16 sm:py-24`}>
      {title && <h2 className="text-2xl sm:text-3xl mb-2">{title}</h2>}
      <p className="text-muted max-w-md text-pretty">{message}</p>
      <button type="button" onClick={onRetry} className={`${BTN_INK} mt-6`}>
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        {S.common.retry}
      </button>
    </div>
  );
};

/** A teaching empty state: what this is, and the one button that fills it. */
export const EmptyBlock: React.FC<{ title: string; body: string; action?: React.ReactNode }> = ({ title, body, action }) => (
  <div className="relative overflow-hidden rounded-xl bg-panel border border-border px-6 py-12 sm:px-10">
    <Pattern className="text-primary opacity-[0.07]" />
    <div className="relative max-w-lg">
      <p className="font-display text-2xl font-bold">{title}</p>
      <p className="mt-2 text-muted text-pretty">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  </div>
);

/** Placeholder rows shaped like WorkshopRow, so the page does not jump when data lands. */
export const RowsSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div role="status" aria-label={useSiteStrings().common.loading} className="border-b border-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid grid-cols-[4.5rem_1fr] gap-x-5 py-6 border-t border-border motion-safe:animate-pulse">
          <div>
            <div className="h-9 w-12 rounded bg-panel-3" />
            <div className="mt-2 h-3 w-14 rounded bg-panel-2" />
          </div>
          <div>
            <div className="h-5 w-3/5 rounded bg-panel-3" />
            <div className="mt-3 h-4 w-4/5 rounded bg-panel-2" />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Placeholder portraits shaped like TeamCard. */
export const PeopleSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div role="status" aria-label={useSiteStrings().common.loading} className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-9 motion-safe:animate-pulse">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="aspect-[4/5] rounded-md bg-panel-3" />
          <div className="mt-4 h-5 w-2/3 rounded bg-panel-3" />
          <div className="mt-2 h-4 w-1/2 rounded bg-panel-2" />
        </div>
      ))}
    </div>
  );
};
