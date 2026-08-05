import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds default padding. Turn off for tables and custom layouts. */
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({ padded = false, className = '', children, ...rest }) => (
  <div
    {...rest}
    className={['rounded-xl border border-border bg-panel', padded ? 'p-6' : '', className].join(' ')}
  >
    {children}
  </div>
);

// `title` is omitted from the base attributes because HTMLAttributes types it
// as the string tooltip attribute, which conflicts with a ReactNode heading.
interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  /** Rendered on the right of the header row. */
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, action, className = '', ...rest }) => (
  <div
    {...rest}
    className={['flex items-center justify-between px-5 py-4 border-b border-border', className].join(' ')}
  >
    <h2 className="font-semibold text-sm text-text">{title}</h2>
    {action}
  </div>
);

export default Card;
