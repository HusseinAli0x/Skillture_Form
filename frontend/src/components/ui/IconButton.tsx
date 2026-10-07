import React from 'react';

export type IconTone = 'default' | 'primary' | 'danger' | 'info';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — these buttons carry no visible text. */
  label: string;
  tone?: IconTone;
}

// The small square action buttons in table rows. Each one previously carried
// its own pair of mouse handlers to swap colour and background on hover.
const tones: Record<IconTone, string> = {
  default: 'text-muted hover:text-text hover:bg-hover-overlay-strong',
  primary: 'text-muted hover:text-primary hover:bg-primary-soft',
  danger: 'text-muted hover:text-danger hover:bg-danger-soft',
  info: 'text-muted hover:text-info hover:bg-info-soft',
};

const IconButton: React.FC<Props> = ({ label, tone = 'default', className = '', children, ...rest }) => (
  <button
    {...rest}
    title={label}
    aria-label={label}
    className={[
      'p-1.5 rounded-lg transition-colors',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      tones[tone],
      className,
    ].join(' ')}
  >
    {children}
  </button>
);

export default IconButton;
