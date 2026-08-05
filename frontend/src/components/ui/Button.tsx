import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner and disables the button. */
  loading?: boolean;
  /** Stretch to the width of the container. */
  block?: boolean;
}

// Hover states used to be hand-wired with onMouseEnter/onMouseLeave handlers
// that reassigned style properties — six lines per button, repeated dozens of
// times. Tailwind's hover: variants do the same job declaratively.
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-bg hover:bg-primary-hover',
  secondary: 'bg-panel-2 text-text border border-border hover:bg-panel-3 hover:border-border-strong',
  ghost: 'bg-transparent text-muted hover:text-text hover:bg-hover-overlay-strong',
  danger: 'bg-danger-soft text-danger border border-danger-border hover:bg-danger hover:text-text',
  subtle: 'bg-primary-soft text-primary border border-primary-border hover:bg-primary hover:text-bg',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-lg',
  lg: 'px-6 py-3 text-base gap-2 rounded-xl',
};

const Button: React.FC<Props> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  disabled,
  className = '',
  children,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={[
      'inline-flex items-center justify-center font-semibold transition-colors duration-150',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      variants[variant],
      sizes[size],
      block ? 'w-full' : '',
      className,
    ].join(' ')}
  >
    {loading && (
      <span
        className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
        aria-hidden="true"
      />
    )}
    {children}
  </button>
);

export default Button;
