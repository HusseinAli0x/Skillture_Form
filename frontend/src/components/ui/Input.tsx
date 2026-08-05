import React from 'react';

// Shared field chrome. The focus ring used to be hand-wired with onFocus and
// onBlur handlers that assigned borderColor directly.
const fieldClass =
  'w-full rounded-lg text-sm bg-bg text-text border border-border outline-none ' +
  'transition-colors placeholder:text-muted ' +
  'focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Icon rendered inside the field on the left; padding adjusts to fit. */
  icon?: React.ReactNode;
  invalid?: boolean;
}

export const Input: React.FC<InputProps> = ({ icon, invalid, className = '', ...rest }) => {
  const field = (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={[
        fieldClass,
        icon ? 'pl-9 pr-4 py-2' : 'px-4 py-2',
        invalid ? 'border-danger focus:border-danger' : '',
        className,
      ].join(' ')}
    />
  );

  if (!icon) return field;

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
        {icon}
      </span>
      {field}
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
    className={[
      fieldClass,
      'px-4 py-3 resize-y',
      invalid ? 'border-danger focus:border-danger' : '',
      className,
    ].join(' ')}
  />
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select: React.FC<SelectProps> = ({ invalid, className = '', children, ...rest }) => (
  <select
    {...rest}
    aria-invalid={invalid || undefined}
    className={[
      fieldClass,
      'px-3 py-2 appearance-none cursor-pointer',
      invalid ? 'border-danger focus:border-danger' : '',
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
    {required && <span className="text-danger ml-1">*</span>}
  </label>
);

export default Input;
