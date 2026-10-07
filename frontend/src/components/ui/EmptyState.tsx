import React from 'react';

interface Props {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** The "nothing here yet" panel: tinted icon tile, title, hint, optional CTA. */
const EmptyState: React.FC<Props> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary-subtle border border-primary-border-soft text-primary">
      {icon}
    </div>
    <p className="font-medium mb-1 text-text">{title}</p>
    {description && <p className="text-sm mb-4 text-muted">{description}</p>}
    {action}
  </div>
);

export default EmptyState;
