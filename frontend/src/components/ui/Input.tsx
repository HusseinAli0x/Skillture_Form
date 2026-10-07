import React from 'react';

// Shared field chrome. Focus shows both a turquoise border and a soft ring so it
// stays visible on the near-black surfaces (docs/BRAND_UX.md: visible focus).
const fieldClass =
  'w-full rounded-lg text-sm bg-bg text-text border border-border outline-none ' +
  'transition-colors placeholder:text-muted ' +
  'hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/30 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const invalidClass = 'border-danger hover:border-danger focus:border-danger focus:ring-danger/30';

interface InputProps extends React.ComponentPropsWithRef<'input'> {
  /** Icon rendered inside the field at the start edge; padding adjusts to fit. */
  icon?: React.ReactNode;
  /** Rendered inside the field at the end edge (e.g. a show/hide toggle). */
  endAdornment?: React.ReactNode;
  invalid?: boolean;
}

export const Input: React.FC<InputProps> = ({ icon, endAdornment, invalid, className = '', ...rest }) => {
  const field = (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={[
        fieldClass,
        icon ? 'ps-9' : 'ps-4',
        endAdornment ? 'pe-11' : 'pe-4',
        'py-2',
        invalid ? invalidClass : '',
        className,
      ].join(' ')}
    />
  );

  if (!icon && !endAdornment) return field;

  return (
    <div className="relative">
      {icon && (
        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">{icon}</span>
      )}
      {field}
      {endAdornment && <span className="absolute end-1 top-1/2 -translate-y-1/2 flex">{endAdornment}</span>}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({ invalid, className = '', ...rest }) => (
  <textarea
    {...rest}
    aria-invalid={invalid || undefined}
    className={[fieldClass, 'px-4 py-3 resize-y', invalid ? invalidClass : '', className].join(' ')}
  />
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

// A chevron painted as a background so the native arrow (removed by
// appearance-none) is replaced rather than lost.
const chevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2388a2a2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] " +
  'bg-no-repeat bg-[position:right_0.65rem_center] rtl:bg-[position:left_0.65rem_center]';

export const Select: React.FC<SelectProps> = ({ invalid, className = '', children, ...rest }) => (
  <select
    {...rest}
    aria-invalid={invalid || undefined}
    className={[
      fieldClass,
      'ps-3 pe-9 py-2 appearance-none cursor-pointer',
      chevron,
      invalid ? invalidClass : '',
      className,
    ].join(' ')}
  >
    {children}
  </select>
);

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label: React.FC<LabelProps> = ({ required, className = '', children, ...rest }) => (
  <label {...rest} className={['block text-xs font-medium mb-1.5 text-muted', className].join(' ')}>
    {children}
    {required && (
      <span className="text-danger ms-1" aria-hidden="true">
        *
      </span>
    )}
  </label>
);

export default Input;
