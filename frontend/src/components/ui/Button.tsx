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

// Brand rules (docs/BRAND_UX.md): primary is a solid turquoise block with
// black text (text-bg is near-black in the app and white inside `.site`, where
// the primary token is the darker teal). Coral is reserved for destructive
// actions, so `danger` is the only variant that uses it.
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-bg hover:bg-primary-hover active:brightness-95',
  secondary:
    'bg-panel-2 text-text border border-border hover:bg-panel-3 hover:border-border-strong active:bg-panel-3',
  ghost: 'bg-transparent text-muted hover:text-text hover:bg-hover-overlay-strong',
  danger:
    'bg-danger-soft text-danger border border-danger-border hover:bg-danger hover:text-bg active:brightness-95',
  subtle:
    'bg-primary-soft text-primary border border-primary-border hover:bg-primary hover:text-bg active:brightness-95',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg min-h-8',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-lg min-h-10',
  lg: 'px-6 py-3 text-base gap-2 rounded-xl min-h-12',
};

const buttonBase =
  'inline-flex items-center justify-center font-semibold transition-colors duration-150 select-none ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

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
    aria-busy={loading || undefined}
    className={[buttonBase, buttonVariants[variant], buttonSizes[size], block ? 'w-full' : '', className].join(' ')}
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
