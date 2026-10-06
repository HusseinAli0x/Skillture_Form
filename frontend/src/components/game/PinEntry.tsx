import React, { useEffect, useRef } from 'react';
import { Delete } from 'lucide-react';
import { PIN_LENGTH, sanitizePin } from './gameLogic';
import './game.css';

interface Props {
  value: string;
  onChange: (pin: string) => void;
  /** Fired the moment the sixth digit lands — the player never taps "Enter". */
  onComplete: (pin: string) => void;
  /** Bump to replay the shake after a wrong PIN. */
  shakeKey?: number;
  disabled?: boolean;
  invalid?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Six boxes and a thumb-sized numeric pad. Digits advance on their own and the
 * sixth submits. A physical keyboard and paste work too, for the host testing
 * on a laptop.
 */
const PinEntry: React.FC<Props> = ({ value, onChange, onComplete, shakeKey = 0, disabled = false, invalid = false }) => {
  // The window handlers below must see the latest props without re-binding on
  // every keystroke.
  const latest = useRef({ value, onChange, onComplete, disabled });
  latest.current = { value, onChange, onComplete, disabled };

  const set = (next: string) => {
    const { value: cur, onChange: change, onComplete: complete, disabled: off } = latest.current;
    if (off) return;
    const clean = sanitizePin(next);
    if (clean === cur) return;
    change(clean);
    if (clean.length === PIN_LENGTH) complete(clean);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      // Leave real text fields alone.
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.id !== 'pin-sink') return;
      const { value: cur } = latest.current;
      if (/^\d$/.test(e.key)) set(cur + e.key);
      else if (e.key === 'Backspace') set(cur.slice(0, -1));
      else if (e.key === 'Enter' && cur.length === PIN_LENGTH) latest.current.onComplete(cur);
    };
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text') ?? '';
      if (/\d/.test(text)) {
        e.preventDefault();
        set(text);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyClass =
    'game-motion flex h-16 items-center justify-center rounded-2xl border border-border bg-panel-2 font-display text-3xl font-bold text-text transition-colors active:bg-primary active:text-bg disabled:opacity-40 sm:h-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <div className="w-full">
      <div
        key={shakeKey}
        role="group"
        aria-label={`Game PIN, ${value.length} of ${PIN_LENGTH} digits entered`}
        className={`mb-5 flex justify-center gap-2 ${invalid ? 'game-shake' : ''}`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => {
          const filled = i < value.length;
          const active = i === value.length && !disabled;
          return (
            <span
              key={i}
              aria-hidden="true"
              className={`flex h-16 w-12 items-center justify-center rounded-xl border-2 font-display text-4xl font-extrabold tabular-nums sm:w-14 ${
                invalid
                  ? 'border-danger text-danger'
                  : filled
                    ? 'border-primary bg-primary-soft text-primary'
                    : active
                      ? 'border-primary-border text-text'
                      : 'border-border text-muted'
              }`}
            >
              {value[i] ?? (active ? <span className="game-live h-6 w-0.5 bg-primary" /> : '')}
            </span>
          );
        })}
      </div>

      <div className="mx-auto grid max-w-xs grid-cols-3 gap-2.5" role="group" aria-label="Number pad">
        {KEYS.map(k => (
          <button key={k} type="button" disabled={disabled} className={keyClass} onClick={() => set(value + k)}>
            {k}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" disabled={disabled} className={keyClass} onClick={() => set(value + '0')}>
          0
        </button>
        <button
          type="button"
          disabled={disabled || value.length === 0}
          aria-label="Delete last digit"
          className={keyClass}
          onClick={() => set(value.slice(0, -1))}
        >
          <Delete className="h-7 w-7" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default PinEntry;
