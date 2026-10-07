import React from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import Button from './Button';

interface Props {
  title?: string;
  message?: string;
  /** Shows a Retry button when provided. */
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
  compact?: boolean;
}

/** A failed load with a way out: plain language and one Retry button. */
const ErrorState: React.FC<Props> = ({
  title = 'Could not load this',
  message = 'Check your connection and try again.',
  onRetry,
  retrying = false,
  retryLabel = 'Retry',
  compact = false,
}) => (
  <div
    role="alert"
    className={`flex flex-col items-center justify-center text-center px-6 ${compact ? 'py-8' : 'py-16'}`}
  >
    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-danger-soft border border-danger-border text-danger">
      <TriangleAlert className="w-5 h-5" />
    </div>
    <p className="font-display font-semibold text-text">{title}</p>
    <p className="mt-1 text-sm text-muted max-w-sm">{message}</p>
    {onRetry && (
      <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry} loading={retrying}>
        {!retrying && <RefreshCw className="w-3.5 h-3.5" />} {retryLabel}
      </Button>
    )}
  </div>
);

export default ErrorState;
