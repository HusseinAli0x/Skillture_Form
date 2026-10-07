import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Skeleton } from '../ui';

interface Props {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  /** One quiet line under the number, e.g. "3 published". */
  hint?: string;
  /** Shows a placeholder instead of the number. */
  loading?: boolean;
  /** Accent for the icon. Defaults to the brand turquoise. */
  tone?: 'primary' | 'success';
  onClick?: () => void;
}

const tones = {
  primary: 'text-primary',
  success: 'text-success',
};

const StatCard: React.FC<Props> = ({ icon, label, value, hint, loading = false, tone = 'primary', onClick }) => {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={tones[tone]} aria-hidden="true">
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-16" />
      ) : (
        <p className="mt-2 font-display text-4xl font-bold leading-none tabular-nums text-text">{value}</p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 min-h-5 text-xs text-muted">
        <span>{loading ? <Skeleton className="h-3 w-24" /> : hint}</span>
        {onClick && (
          <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
        )}
      </div>
    </>
  );

  const base = 'block rounded-xl border border-border bg-panel p-5 text-start w-full';
  if (!onClick) return <div className={base}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} group transition-colors hover:border-primary-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
    >
      {body}
    </button>
  );
};

export default StatCard;
