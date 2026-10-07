import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { BTN_INK } from './layout';
import { useSiteStrings } from '../../lib/useSiteContent';

const PIN_LENGTH = 6;

/**
 * The two-tap join: type the PIN, press Join. Hands the PIN to /play, which
 * looks it up straight away. A short PIN is explained here instead of bouncing
 * the player to a second screen.
 */
const JoinPinForm: React.FC<{ className?: string }> = ({ className = '' }) => {
  const navigate = useNavigate();
  const S = useSiteStrings();
  const P = S.home.pin;
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== PIN_LENGTH) {
      setError(true);
      inputRef.current?.focus();
      return;
    }
    navigate(`/play?pin=${pin}`);
  };

  return (
    <form onSubmit={submit} noValidate className={`bg-brand text-ink rounded-2xl p-5 sm:p-7 ${className}`}>
      <h2 className="text-2xl sm:text-[1.7rem]">{P.title}</h2>
      <p className="mt-1.5 text-base">{P.hint}</p>
      <label htmlFor="home-pin" className="sr-only">
        {P.label}
      </label>
      <input
        ref={inputRef}
        id="home-pin"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={PIN_LENGTH}
        value={pin}
        onChange={e => {
          setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH));
          if (error) setError(false);
        }}
        placeholder={P.placeholder}
        aria-invalid={error}
        aria-describedby={error ? 'home-pin-error' : undefined}
        dir="ltr"
        // Inline: the global mobile rule pins every input to 16px, which would shrink the PIN.
        style={{ fontSize: '2.25rem' }}
        className="mt-5 w-full h-16 rounded-xl bg-white text-ink text-center numeral tracking-[0.3em] placeholder:text-ink/20 focus:outline-3 focus:outline-ink aria-[invalid=true]:outline-2 aria-[invalid=true]:outline-ink"
      />
      {error && (
        <p id="home-pin-error" role="alert" className="mt-2 text-sm font-medium">
          {P.error}
        </p>
      )}
      <button type="submit" className={`${BTN_INK} w-full mt-3`}>
        {P.button}
        <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
      </button>
      {/* The other way into a game: running one. */}
      <p className="mt-4 pt-4 border-t border-ink/25 text-base">
        {S.host.home.line}{' '}
        <Link
          to="/create"
          className="inline-flex items-center min-h-11 font-semibold underline underline-offset-4 decoration-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {S.host.home.link}
          <ArrowRight className="ms-1 w-4 h-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </p>
    </form>
  );
};

export default JoinPinForm;
