/**
 * A small canvas confetti burst — no dependency, removes itself when done, and
 * does nothing for people who have asked their system to reduce motion.
 */
const COLORS = ['#f25c54', '#2e86ff', '#ffd84d', '#2fbf71', '#0abfbc', '#ffffff'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  round: boolean;
}

export interface ConfettiOptions {
  /** Number of pieces. */
  count?: number;
  /** Where the burst starts, as fractions of the viewport (0–1). */
  origin?: { x: number; y: number };
  /** Spread in radians around straight up. */
  spread?: number;
  /** Seconds the burst lasts. */
  duration?: number;
}

export function fireConfetti(options: ConfettiOptions = {}): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const { count = 120, origin = { x: 0.5, y: 0.6 }, spread = Math.PI * 0.9, duration = 3.2 } = options;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:200';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  if (!g) {
    canvas.remove();
    return;
  }
  g.scale(dpr, dpr);

  const pieces: Piece[] = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
    const speed = 7 + Math.random() * 9;
    return {
      x: origin.x * window.innerWidth,
      y: origin.y * window.innerHeight,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() < 0.3,
    };
  });

  const start = performance.now();
  const frame = (now: number) => {
    const t = (now - start) / 1000;
    g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of pieces) {
      p.vy += 0.28; // gravity
      p.vx *= 0.992; // air drag
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.globalAlpha = Math.max(0, 1 - t / duration);
      g.fillStyle = p.color;
      if (p.round) {
        g.beginPath();
        g.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      g.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** Two bursts from the lower corners, for a winner's moment. */
export function fireCelebration(): void {
  fireConfetti({ count: 90, origin: { x: 0.15, y: 0.85 }, spread: Math.PI * 0.5 });
  fireConfetti({ count: 90, origin: { x: 0.85, y: 0.85 }, spread: Math.PI * 0.5 });
  window.setTimeout(() => fireConfetti({ count: 120, origin: { x: 0.5, y: 0.5 } }), 350);
}
