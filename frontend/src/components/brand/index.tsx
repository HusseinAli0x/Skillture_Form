import React from 'react';

/**
 * Skillture identity pieces. All are recolourable: they paint with
 * `currentColor`, so tone is just a text colour class (text-brand on black,
 * text-white on teal, text-ink on white, …).
 */

/** Photographs and art cut from the identity deck / poster (public/brand). */
export const brandAssets = {
  poster: '/brand/poster.webp', // full poster, 3:4 — "workshops that improve you."
  hand: '/brand/hand.webp', // pointing hand on the pattern, 3:2, no text
  pattern: '/brand/pattern.webp', // pattern on teal gradient, 4:6.5, no text
  pins: '/brand/mock-pins.webp', // 16:9 teal badges photograph
  badge: '/brand/mock-badge.webp', // 16:9 lanyard ID card
  cards: '/brand/mock-cards.webp', // 16:9 business cards on teal
  stationery: '/brand/mock-stationery.webp', // 16:9 stationery flat-lay
} as const;

const maskStyle = (url: string): React.CSSProperties => ({
  backgroundColor: 'currentColor',
  WebkitMask: `url(${url}) center / contain no-repeat`,
  mask: `url(${url}) center / contain no-repeat`,
});

interface LogoProps {
  /** `icon` is the brain-and-column mark; `full` adds the SKILLTURE wordmark. */
  variant?: 'icon' | 'full';
  className?: string;
  /** Hide from screen readers when the name is already written next to it. */
  decorative?: boolean;
}

/** Height-driven: give it `h-8` etc; width follows the artwork's ratio. */
export const Logo: React.FC<LogoProps> = ({ variant = 'icon', className = '', decorative = false }) => (
  <span
    role={decorative ? undefined : 'img'}
    aria-label={decorative ? undefined : 'Skillture'}
    aria-hidden={decorative ? true : undefined}
    className={`inline-block shrink-0 text-brand ${className}`}
    style={{
      ...maskStyle(variant === 'full' ? '/logo-full.png' : '/logo-icon.png'),
      aspectRatio: variant === 'full' ? '7126 / 1462' : '1136 / 1077',
    }}
  />
);

/** Faint column-maze texture. Parent must be `relative`; it fills the parent. */
export const Pattern: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span aria-hidden="true" className={`brand-pattern ${className}`} />
);

/** Ionic-column chain used as a section divider. Colour with `text-*`. */
export const Frieze: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span aria-hidden="true" className={`brand-frieze ${className}`} />
);
