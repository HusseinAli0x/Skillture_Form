import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Pattern } from '../brand';
import { Button, EmptyState } from '../ui';

/** "Nothing here yet", with the identity's column-maze texture behind it. */
export const EmptyPanel: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="relative overflow-hidden rounded-xl border border-border bg-panel">
    <Pattern className="text-primary opacity-[0.07]" />
    <div className="relative">
      <EmptyState icon={icon} title={title} description={description} action={action} />
    </div>
  </div>
);

/** A failed load with a way out: say what happened, offer a retry. */
export const LoadFailed: React.FC<{ what: string; onRetry: () => void }> = ({ what, onRetry }) => (
  <div className="rounded-xl border border-danger-border bg-danger-soft px-5 py-8 text-center">
    <AlertCircle aria-hidden="true" className="w-6 h-6 mx-auto mb-2 text-danger" />
    <p className="font-medium text-text">Could not load {what}.</p>
    <p className="mt-1 text-sm text-muted">Check your connection, then try again. Nothing was lost.</p>
    <Button className="mt-4" variant="secondary" onClick={onRetry}>
      Try again
    </Button>
  </div>
);

/** Placeholder rows while a list loads. */
export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="rounded-xl border border-border bg-panel px-4 divide-y divide-border" role="status" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 py-3 animate-pulse">
        <div className="w-28 aspect-video rounded-md bg-panel-3" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-panel-3" />
          <div className="h-4 w-2/3 rounded bg-panel-3" />
          <div className="h-3 w-1/3 rounded bg-panel-3" />
        </div>
      </div>
    ))}
  </div>
);

/** Form-level message for a server rejection that names no single field. */
export const FormBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div role="alert" className="flex gap-3 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-text">
      <AlertCircle aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 text-danger" />
      <p>{message}</p>
    </div>
  ) : null;
