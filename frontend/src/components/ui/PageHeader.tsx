import React from 'react';

interface Props {
  title: string;
  description?: string;
  /** Rendered on the right; wraps below the title on narrow screens. */
  action?: React.ReactNode;
}

const PageHeader: React.FC<Props> = ({ title, description, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
    {action}
  </div>
);

export default PageHeader;
