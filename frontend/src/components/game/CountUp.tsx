import React, { useEffect, useState } from 'react';

/** A number that rolls up to its value — points feel better when they accumulate. */
const CountUp: React.FC<{ to: number; from?: number; durationMs?: number; className?: string }> = ({
  to,
  from = 0,
  durationMs = 900,
  className,
}) => {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, from, durationMs]);
  return <span className={`numeral ${className ?? ''}`}>{value.toLocaleString('en-US')}</span>;
};

export default CountUp;
