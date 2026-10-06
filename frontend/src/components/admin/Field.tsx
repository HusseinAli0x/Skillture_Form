import React from 'react';
import { Input, Label, Textarea } from '../ui';

interface ControlProps {
  id: string;
  invalid: boolean;
  'aria-describedby': string | undefined;
}

interface FieldProps {
  id: string;
  label: React.ReactNode;
  /** One line saying what this field does or where it shows on the site. */
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  /** Right-aligned note on the label row, e.g. a character counter. */
  aside?: React.ReactNode;
  className?: string;
  children: (control: ControlProps) => React.ReactNode;
}

/** Label + control + hint + inline error, wired together for screen readers. */
export const Field: React.FC<FieldProps> = ({ id, label, hint, error, required, aside, className = '', children }) => {
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
        {aside && <span className="text-xs text-muted mb-1.5">{aside}</span>}
      </div>
      {children({ id, invalid: Boolean(error), 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted leading-relaxed">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-danger leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
};

/** Small language chip: tells the editor which language an input is for. */
export const LangTag: React.FC<{ lang: 'en' | 'ar' }> = ({ lang }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-md border border-border-strong px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-muted ${
      lang === 'ar' ? 'tracking-normal' : 'uppercase'
    }`}
  >
    {lang === 'en' ? 'EN' : 'AR'}
    <span className="font-normal text-muted/80">{lang === 'en' ? 'English' : 'العربية'}</span>
  </span>
);

interface BilingualProps {
  id: string;
  label: React.ReactNode;
  en: string;
  ar: string;
  onChange: (next: { en?: string; ar?: string }) => void;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  placeholderEn?: string;
  placeholderAr?: string;
  maxLength?: number;
}

/**
 * An English / Arabic pair, side by side with a visible language label. The
 * Arabic input is right-to-left. When the field has an error, whichever side is
 * empty is marked, since the API's rule is "both languages".
 */
export const BilingualField: React.FC<BilingualProps> = ({
  id,
  label,
  en,
  ar,
  onChange,
  multiline = false,
  rows = 3,
  required,
  hint,
  error,
  placeholderEn,
  placeholderAr,
  maxLength,
}) => {
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  const shared = { 'aria-describedby': describedBy, maxLength };
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-medium mb-1.5 text-muted">
        {label}
        {required && <span className="text-danger ms-1">*</span>}
      </legend>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="mb-1.5">
            <LangTag lang="en" />
          </div>
          {multiline ? (
            <Textarea
              id={`${id}-en`}
              aria-label={`${typeof label === 'string' ? label : id} (English)`}
              lang="en"
              dir="ltr"
              rows={rows}
              value={en}
              placeholder={placeholderEn}
              invalid={Boolean(error) && !en.trim()}
              onChange={e => onChange({ en: e.target.value })}
              {...shared}
            />
          ) : (
            <Input
              id={`${id}-en`}
              aria-label={`${typeof label === 'string' ? label : id} (English)`}
              lang="en"
              dir="ltr"
              value={en}
              placeholder={placeholderEn}
              invalid={Boolean(error) && !en.trim()}
              onChange={e => onChange({ en: e.target.value })}
              {...shared}
            />
          )}
        </div>
        <div>
          <div className="mb-1.5">
            <LangTag lang="ar" />
          </div>
          {multiline ? (
            <Textarea
              id={`${id}-ar`}
              aria-label={`${typeof label === 'string' ? label : id} (Arabic)`}
              lang="ar"
              dir="rtl"
              rows={rows}
              value={ar}
              placeholder={placeholderAr}
              invalid={Boolean(error) && !ar.trim()}
              onChange={e => onChange({ ar: e.target.value })}
              {...shared}
            />
          ) : (
            <Input
              id={`${id}-ar`}
              aria-label={`${typeof label === 'string' ? label : id} (Arabic)`}
              lang="ar"
              dir="rtl"
              value={ar}
              placeholder={placeholderAr}
              invalid={Boolean(error) && !ar.trim()}
              onChange={e => onChange({ ar: e.target.value })}
              {...shared}
            />
          )}
        </div>
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted leading-relaxed">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-danger leading-relaxed">
          {error}
        </p>
      )}
    </fieldset>
  );
};
