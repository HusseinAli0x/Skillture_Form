import { useEffect, useRef, useState } from 'react';

/**
 * Counts down to a deadline using the clock, not a chain of one-second
 * timeouts. A timeout chain drifts, and is throttled to once a second or worse
 * in a background tab, so a phone that was briefly backgrounded came back with
 * a wrong timer. Here the remaining time is always `deadline - now`.
 *
 * Expiry is deliberately NOT driven by animation frames. Browsers stop firing
 * requestAnimationFrame in a background tab, so a host who switched windows (or
 * whose screen dimmed) had a frozen countdown that never ended the question and
 * left every player waiting for results. Instead a plain timeout is armed for
 * the exact deadline (timeouts still fire in the background, merely coarser),
 * and when the tab becomes visible again the time is re-read from the clock.
 * The animation frames only keep the on-screen number smooth.
 *
 * Pass `null` to stop. `onExpire` fires once when time runs out.
 */
export function useDeadline(durationSec: number | null, running: boolean, onExpire?: () => void) {
  const [remainingMs, setRemainingMs] = useState(durationSec === null ? 0 : durationSec * 1000);
  const onExpireRef = useRef(onExpire);
  const startedAt = useRef(0);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (durationSec === null || !running) return;
    const total = durationSec * 1000;
    const start = performance.now();
    startedAt.current = start;
    setRemainingMs(total);

    let raf = 0;
    let fired = false;

    const left = () => Math.max(0, total - (performance.now() - start));
    const expire = () => {
      setRemainingMs(0);
      if (!fired) {
        fired = true;
        onExpireRef.current?.();
      }
    };
    // Re-read the clock; used by every path so they can never disagree.
    const sync = () => {
      const remaining = left();
      if (remaining <= 0) expire();
      else setRemainingMs(remaining);
    };

    const tick = () => {
      sync();
      if (!fired) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // The authoritative expiry: works in a hidden tab.
    const timeout = setTimeout(expire, total);
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [durationSec, running]);

  /** Milliseconds since the countdown started — the "time taken" to report. */
  const elapsedMs = () => Math.max(0, performance.now() - startedAt.current);

  return { remainingMs, remainingSec: Math.ceil(remainingMs / 1000), elapsedMs };
}
