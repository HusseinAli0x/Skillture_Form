import React from 'react';

interface Props {
  title: string;
  description?: string;
  /** Rendered at the end edge; wraps below the title on narrow screens. */
  action?: React.ReactNode;
}

const PageHeader: React.FC<Props> = ({ title, description, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-3xl font-bold tracking-tight text-text">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
    {action && <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>}
  </div>
);

export default PageHeader;
