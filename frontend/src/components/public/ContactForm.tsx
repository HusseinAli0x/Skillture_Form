import React, { useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import client from '../../api/client';
import { useLanguageStore } from '../../context/LanguageStore';
import { siteStrings } from '../../lib/siteStrings';
import { BTN_INK, BTN_GHOST } from './layout';

type Field = 'name' | 'email' | 'message';
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

const EMPTY: Values = { name: '', email: '', message: '' };
// Same shape the API checks (contact_handler.go), so a pass here is a pass there.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 5000;

const INPUT =
  'w-full min-h-12 px-4 rounded-lg bg-white text-ink border border-border-strong text-base placeholder:text-ink/45 ' +
  'focus:outline-2 focus:outline-offset-1 focus:outline-ink aria-[invalid=true]:border-ink aria-[invalid=true]:border-2';

/**
 * Book-a-workshop / contact form against POST /api/v1/contact. Each field is
 * labelled and validated on blur and on submit; the submit button is disabled
 * while sending; success replaces the form; a failure keeps what was typed.
 */
const ContactForm: React.FC<{ className?: string }> = ({ className = '' }) => {
  const locale = useLanguageStore(s => s.locale);
  const C = siteStrings[locale].home.contact;

  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState(false);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
  };

  const check = (field: Field, v: string): string | undefined => {
    const t = v.trim();
    if (field === 'name') return t ? undefined : C.errName;
    if (field === 'email') return !t ? C.errEmail : EMAIL_RE.test(t) ? undefined : C.errEmailInvalid;
    if (!t) return C.errMessage;
    return t.length > MAX_MESSAGE ? C.errMessageLong : undefined;
  };

  const set = (field: Field, v: string) => {
    setValues(prev => ({ ...prev, [field]: v }));
    // Clear a shown error as soon as the fix is typed, but never add one mid-typing.
    if (errors[field] && !check(field, v)) setErrors(prev => ({ ...prev, [field]: undefined }));
    if (failed) setFailed(false);
  };

  const blur = (field: Field) => {
    if (!values[field]) return; // an untouched field is not an error yet
    setErrors(prev => ({ ...prev, [field]: check(field, values[field]) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const next: Errors = {};
    (['name', 'email', 'message'] as Field[]).forEach(f => {
      next[f] = check(f, values[f]);
    });
    setErrors(next);
    const firstBad = (['name', 'email', 'message'] as Field[]).find(f => next[f]);
    if (firstBad) {
      refs[firstBad].current?.focus();
      return;
    }
    setSending(true);
    setFailed(false);
    try {
      await client.post('/api/v1/contact', {
        name: values.name.trim(),
        email: values.email.trim(),
        message: values.message.trim(),
      });
      setSent(true);
      setValues(EMPTY);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className={`bg-white text-ink rounded-2xl p-6 sm:p-8 ${className}`}>
        <CheckCircle2 className="w-9 h-9 text-primary" aria-hidden="true" />
        <h3 className="mt-4 text-2xl">{C.successTitle}</h3>
        <p className="mt-2 text-base text-pretty">{C.successBody}</p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setErrors({});
          }}
          className={`${BTN_GHOST} mt-6`}
        >
          {C.sendAnother}
        </button>
      </div>
    );
  }

  const fieldProps = (f: Field) => ({
    id: `contact-${f}`,
    name: f,
    value: values[f],
    'aria-invalid': errors[f] ? (true as const) : undefined,
    'aria-describedby': errors[f] ? `contact-${f}-error` : undefined,
    onBlur: () => blur(f),
    className: INPUT,
  });

  const label = (f: Field, text: string) => (
    <label htmlFor={`contact-${f}`} className="block mb-1.5 text-sm font-semibold">
      {text}
    </label>
  );
  const error = (f: Field) =>
    errors[f] ? (
      <p id={`contact-${f}-error`} className="mt-1.5 text-sm font-medium text-[#b3261e]">
        {errors[f]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate className={`bg-white text-ink rounded-2xl p-6 sm:p-8 space-y-5 ${className}`}>
      <div>
        {label('name', C.name)}
        <input
          {...fieldProps('name')}
          ref={refs.name}
          type="text"
          autoComplete="name"
          placeholder={C.namePlaceholder}
          onChange={e => set('name', e.target.value)}
        />
        {error('name')}
      </div>
      <div>
        {label('email', C.email)}
        <input
          {...fieldProps('email')}
          ref={refs.email}
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          placeholder={C.emailPlaceholder}
          onChange={e => set('email', e.target.value)}
          className={`${INPUT} ${locale === 'ar' ? 'text-end' : ''}`}
        />
        {error('email')}
      </div>
      <div>
        {label('message', C.message)}
        <textarea
          {...fieldProps('message')}
          ref={refs.message}
          rows={5}
          placeholder={C.messagePlaceholder}
          onChange={e => set('message', e.target.value)}
          className={`${INPUT} py-3 resize-y`}
        />
        {error('message')}
      </div>

      {failed && (
        <p role="alert" className="rounded-lg border-2 border-coral bg-coral/10 px-4 py-3 text-sm font-medium">
          {C.failure}
        </p>
      )}

      <button type="submit" disabled={sending} aria-busy={sending} className={`${BTN_INK} w-full sm:w-auto`}>
        {sending && <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-white border-t-transparent motion-safe:animate-spin" />}
        {sending ? C.sending : C.send}
      </button>
    </form>
  );
};

export default ContactForm;
