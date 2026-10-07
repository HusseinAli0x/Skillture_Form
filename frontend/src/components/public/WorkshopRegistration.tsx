import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { CheckCircle2, Lock, Users } from 'lucide-react';
import client from '../../api/client';
import type { PublicWorkshop } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';
import { formatDate } from '../../lib/formatDate';
import { useSiteStrings } from '../../lib/useSiteContent';
import { BTN_GHOST, BTN_INK, FOCUS_RING, LINK_UNDERLINE } from './layout';
import { registrationErrorKey, STATE_CHANGED, type RegistrationErrorKey } from './registrationErrors';

type Field = 'name' | 'email';
type Errors = Partial<Record<Field, string>>;

// Same shape the API checks, so a pass here is a pass there.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 120;
const MAX_EMAIL = 254;
/** At or below this many seats left, the hint is drawn as a nudge rather than a note. */
const FEW_LEFT = 10;

const INPUT =
  'w-full min-h-12 px-4 rounded-lg bg-white text-ink border border-border-strong text-base placeholder:text-ink/45 ' +
  'focus:outline-2 focus:outline-offset-1 focus:outline-ink aria-[invalid=true]:border-ink aria-[invalid=true]:border-2';

const CARD = 'bg-white text-ink rounded-2xl border border-border p-6 sm:p-8';

/** Server codes that belong beside one input rather than in the general alert. */
const FIELD_OF: Partial<Record<RegistrationErrorKey, Field>> = {
  nameRequired: 'name',
  nameInvalid: 'name',
  nameTooLong: 'name',
  emailInvalid: 'email',
};

const length = (v: string) => [...v].length;
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

interface Props {
  workshop: PublicWorkshop;
  /** Called after a sign-up, or after a failure that means the seat count or status is stale. */
  onChanged?: () => void;
}

/**
 * Sign-up for an upcoming workshop: POST /api/v1/workshops/:id/register with a
 * name and email. Shown as the form while registration is open, as a plain
 * explanation when the workshop is full or closed, and not at all once it has
 * taken place. Follows ContactForm: labels, validation on blur and submit,
 * focus on the first problem, and a failure keeps what was typed.
 */
const WorkshopRegistration: React.FC<Props> = ({ workshop: w, onChanged }) => {
  const locale = useLanguageStore(s => s.locale);
  const S = useSiteStrings().workshop;
  const R = S.registration;
  const { hash, key } = useLocation();

  const [values, setValues] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<RegistrationErrorKey | null>(null);
  const [done, setDone] = useState<{ name: string; email: string } | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const refs = { name: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null) };
  // The honeypot is read from the DOM, not state: a real visitor never touches
  // it, so it is empty; a script that fills every input is what it catches.
  const trap = useRef<HTMLInputElement>(null);

  // Arriving with #register (from the list's Register link): bring the section
  // into view and move focus to its heading so screen readers start there.
  useEffect(() => {
    if (hash !== '#register') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    headingRef.current?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
  }, [hash, key]);

  // The form is replaced by the confirmation; keep keyboard focus on the page.
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const check = (field: Field, v: string): string | undefined => {
    const t = v.trim();
    if (field === 'name') {
      if (!t) return R.errName;
      return length(t) > MAX_NAME ? R.errNameLong : undefined;
    }
    if (!t) return R.errEmail;
    if (t.length > MAX_EMAIL) return R.errEmailLong;
    return EMAIL_RE.test(t) ? undefined : R.errEmailInvalid;
  };

  const set = (field: Field, v: string) => {
    setValues(prev => ({ ...prev, [field]: v }));
    // Clear a shown error as soon as the fix is typed, but never add one mid-typing.
    if (errors[field] && !check(field, v)) setErrors(prev => ({ ...prev, [field]: undefined }));
    if (failure) setFailure(null);
  };

  const blur = (field: Field) => {
    if (!values[field]) return; // an untouched field is not an error yet
    setErrors(prev => ({ ...prev, [field]: check(field, values[field]) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next: Errors = { name: check('name', values.name), email: check('email', values.email) };
    setErrors(next);
    const firstBad = (['name', 'email'] as Field[]).find(f => next[f]);
    if (firstBad) {
      refs[firstBad].current?.focus();
      return;
    }
    setBusy(true);
    setFailure(null);
    const name = values.name.trim();
    const email = values.email.trim();
    try {
      await client.post(`/api/v1/workshops/${w.id}/register`, { name, email, website: trap.current?.value ?? '' });
      setDone({ name, email });
      setValues({ name: '', email: '' });
      setErrors({});
      onChanged?.();
    } catch (err) {
      const code = registrationErrorKey(err);
      const field = FIELD_OF[code];
      if (field) {
        setErrors(prev => ({ ...prev, [field]: R.errors[code] }));
        refs[field].current?.focus();
      } else {
        setFailure(code);
      }
      if (STATE_CHANGED.includes(code)) onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const anotherPerson = () => {
    setDone(null);
    setErrors({});
    setFailure(null);
    requestAnimationFrame(() => refs.name.current?.focus());
  };

  const externalLink = (className: string, text: string) =>
    w.registration_url ? (
      <a href={w.registration_url} target="_blank" rel="noopener noreferrer" className={className}>
        {text}
      </a>
    ) : null;

  const wrap = (children: React.ReactNode) => (
    <section id="register" aria-labelledby="register-title" className="mt-12 scroll-mt-24">
      {children}
    </section>
  );

  // ---- Confirmation -------------------------------------------------------
  if (done) {
    const when = [formatDate(w.event_date, locale), w.event_time].filter(Boolean).join(' · ');
    const details = [
      { label: R.successAs, value: `${done.name} · ${done.email}` },
      { label: S.when, value: when },
      ...(w.location ? [{ label: S.where, value: w.location }] : []),
    ];
    return wrap(
      <div role="status" className={CARD}>
        <CheckCircle2 className="w-9 h-9 text-primary" aria-hidden="true" />
        <h2 id="register-title" ref={doneRef} tabIndex={-1} className="mt-4 text-2xl outline-none">
          {R.successTitle}
        </h2>
        <p className="mt-2 text-base text-pretty">{R.successBody}</p>
        <dl className="mt-5 border-t border-border">
          {details.map(d => (
            <div key={d.label} className="py-3 border-b border-border">
              <dt className="text-sm text-muted">{d.label}</dt>
              <dd className="mt-0.5 font-medium break-words">{d.value}</dd>
            </div>
          ))}
        </dl>
        {w.spots_left !== 0 && (
          <button type="button" onClick={anotherPerson} className={`${BTN_GHOST} mt-6`}>
            {R.another}
          </button>
        )}
      </div>
    );
  }

  if (w.registration_status === 'ended') return null;

  // ---- Full or closed -----------------------------------------------------
  if (w.registration_status === 'full' || w.registration_status === 'closed') {
    const full = w.registration_status === 'full';
    const Icon = full ? Users : Lock;
    return wrap(
      <div className={CARD}>
        <Icon className="w-9 h-9 text-primary" aria-hidden="true" />
        <h2 id="register-title" ref={headingRef} tabIndex={-1} className="mt-4 text-2xl outline-none">
          {full ? R.fullTitle : R.closedTitle}
        </h2>
        <p className="mt-2 text-base text-pretty">{full ? R.fullBody : R.closedBody}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link to="/#contact" className={BTN_INK}>
            {R.contactUs}
          </Link>
          {externalLink(BTN_GHOST, cap(R.external))}
        </div>
      </div>
    );
  }

  // ---- Open ---------------------------------------------------------------
  const fieldProps = (f: Field) => ({
    id: `register-${f}`,
    name: f,
    value: values[f],
    'aria-invalid': errors[f] ? (true as const) : undefined,
    'aria-describedby': errors[f] ? `register-${f}-error` : undefined,
    onBlur: () => blur(f),
    className: INPUT,
  });

  const label = (f: Field, text: string) => (
    <label htmlFor={`register-${f}`} className="block mb-1.5 text-sm font-semibold">
      {text}
    </label>
  );
  const error = (f: Field) =>
    errors[f] ? (
      <p id={`register-${f}-error`} className="mt-1.5 text-sm font-medium text-[#b3261e]">
        {errors[f]}
      </p>
    ) : null;

  const few = w.spots_left != null && w.spots_left <= FEW_LEFT;

  return wrap(
    <form onSubmit={submit} noValidate className={`${CARD} relative space-y-5`}>
      <div>
        <h2 id="register-title" ref={headingRef} tabIndex={-1} className="text-2xl outline-none">
          {R.title}
        </h2>
        <p className="mt-2 text-base text-pretty">{R.intro}</p>
        {w.spots_left != null && (
          <p
            className={
              few
                ? 'mt-3 inline-flex items-center gap-2 rounded-full bg-coral/15 px-3 py-1.5 text-sm font-semibold'
                : 'mt-3 inline-flex items-center gap-2 text-sm font-medium text-muted'
            }
          >
            <Users className="w-4 h-4" aria-hidden="true" />
            {R.spotsLeft(w.spots_left)}
          </p>
        )}
      </div>

      <div>
        {label('name', R.name)}
        <input
          {...fieldProps('name')}
          ref={refs.name}
          type="text"
          autoComplete="name"
          placeholder={R.namePlaceholder}
          onChange={e => set('name', e.target.value)}
        />
        {error('name')}
      </div>
      <div>
        {label('email', R.email)}
        <input
          {...fieldProps('email')}
          ref={refs.email}
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          placeholder={R.emailPlaceholder}
          onChange={e => set('email', e.target.value)}
          className={`${INPUT} ${locale === 'ar' ? 'text-end' : ''}`}
        />
        {error('email')}
      </div>

      {/* Honeypot: invisible and unreachable for people, tempting for form-filling bots. */}
      <div aria-hidden="true" className="absolute -start-[9999px] top-auto h-px w-px overflow-hidden">
        <label>
          Website
          <input ref={trap} type="text" name="ref_code_x" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div aria-live="polite">
        {failure && (
          <p role="alert" className="rounded-lg border-2 border-coral bg-coral/10 px-4 py-3 text-sm font-medium">
            {R.errors[failure]}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="submit" disabled={busy} aria-busy={busy} className={`${BTN_INK} w-full sm:w-auto`}>
          {busy && (
            <span
              aria-hidden="true"
              className="w-4 h-4 rounded-full border-2 border-white border-t-transparent motion-safe:animate-spin"
            />
          )}
          {busy ? R.submitting : R.submit}
        </button>
        {w.registration_url && (
          <p className="text-sm">
            <span className="text-muted">{R.externalOr} </span>
            {externalLink(`${LINK_UNDERLINE} ${FOCUS_RING}`, R.external)}
          </p>
        )}
      </div>

      <p className="text-sm text-muted text-pretty">{R.privacy}</p>
    </form>
  );
};

export default WorkshopRegistration;
