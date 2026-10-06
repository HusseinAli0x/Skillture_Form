import React from 'react';
import { Pattern } from '../brand';

interface Props {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Tighter padding for use inside a card or a short panel. */
  compact?: boolean;
}

/**
 * The "nothing here yet" panel. It should say what this place is for and offer
 * the one button that fills it. The column-maze texture is deliberately faint.
 */
const EmptyState: React.FC<Props> = ({ icon, title, description, action, compact = false }) => (
  <div
    className={`relative overflow-hidden flex flex-col items-center justify-center text-center px-6 ${
      compact ? 'py-10' : 'py-20'
    }`}
  >
    <Pattern className="text-primary opacity-[0.035]" />
    <div className="relative w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-primary-subtle border border-primary-border-soft text-primary">
      {icon}
    </div>
    <p className="relative font-display font-semibold text-lg mb-1 text-text">{title}</p>
    {description && <p className="relative text-sm mb-5 text-muted max-w-sm">{description}</p>}
    {action && <div className="relative">{action}</div>}
  </div>
);

export default EmptyState;
