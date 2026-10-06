/**
 * Scroll-driven chrome for the homepage's "journey" layout: a top progress
 * bar, fade-in-on-scroll content (`[data-reveal]`), the vertical fill line
 * between sections (`[data-waypoint]`, each holding a `[data-track]` /
 * `[data-fill]` / `[data-dot]` / `[data-stop]`), and the right-edge rail
 * that tracks which section is active (`[data-rail-item]` next to
 * `[data-section][id]`).
 *
 * Call once the page's content has rendered (after any async data has
 * landed — reveals and waypoints only exist in the DOM once their section
 * has real content). Returns a cleanup function.
 */
export function setupScrollJourney(root: HTMLElement): () => void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const reveals = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
  const waypoints = Array.from(root.querySelectorAll<HTMLElement>('[data-waypoint]'));
  const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-section][id]'));
  const railItems = Array.from(root.querySelectorAll<HTMLElement>('[data-rail-item]'));
  const bar = root.querySelector<HTMLElement>('[data-progress]');

  if (reduceMotion) {
    reveals.forEach(el => el.classList.add('is-visible'));
    waypoints.forEach(wp => {
      const fill = wp.querySelector<HTMLElement>('[data-fill]');
      const stop = wp.querySelector<HTMLElement>('[data-stop]');
      if (fill) fill.style.height = '100%';
      if (stop) {
        stop.style.opacity = '1';
        stop.style.transform = 'none';
      }
    });
    return () => {};
  }

  const io = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );
  reveals.forEach(el => io.observe(el));

  let queued = false;
  const frame = () => {
    queued = false;
    const vh = window.innerHeight;
    const doc = document.documentElement;

    if (bar) {
      const max = doc.scrollHeight - vh;
      bar.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
    }

    waypoints.forEach(wp => {
      const track = wp.querySelector<HTMLElement>('[data-track]');
      if (!track) return;
      const fill = wp.querySelector<HTMLElement>('[data-fill]');
      const dot = wp.querySelector<HTMLElement>('[data-dot]');
      const stop = wp.querySelector<HTMLElement>('[data-stop]');
      const r = track.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (vh * 0.82 - r.top) / (r.height + 40)));
      if (fill) fill.style.height = `${p * 100}%`;
      if (dot) {
        dot.style.top = `${p * 100}%`;
        dot.style.opacity = p > 0.02 && p < 0.995 ? '1' : '0';
      }
      if (stop) {
        const near = p > 0.9;
        stop.style.opacity = near ? '1' : String(0.28 + p * 0.32);
        stop.style.transform = near ? 'none' : 'translateY(6px)';
      }
    });

    let active = 0;
    sections.forEach((s, i) => {
      if (s.getBoundingClientRect().top <= vh * 0.42) active = i;
    });
    railItems.forEach((item, i) => {
      const dot = item.querySelector<HTMLElement>('[data-rail-dot]');
      const label = item.querySelector<HTMLElement>('[data-rail-label]');
      const seg = item.parentElement?.querySelector<HTMLElement>('[data-rail-seg]');
      const on = i <= active;
      const isActive = i === active;
      if (dot) {
        dot.style.background = on ? 'var(--color-primary)' : 'var(--color-bg)';
        dot.style.borderColor = on ? 'var(--color-primary)' : 'var(--color-border-strong)';
        dot.style.transform = isActive ? 'scale(1.35)' : 'scale(1)';
      }
      if (label) {
        label.style.color = isActive ? 'var(--color-primary)' : 'var(--color-muted)';
        label.style.opacity = isActive ? '1' : '.5';
      }
      if (seg) seg.style.background = i < active ? 'var(--color-primary)' : 'var(--color-border)';
    });
  };

  const onScroll = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(frame);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();

  return () => {
    io.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}
