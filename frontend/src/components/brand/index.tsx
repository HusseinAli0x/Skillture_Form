import React from 'react';
import { logoAssets } from './assets';
import { useLogoSrc } from '../../lib/useSiteContent';

/**
 * Skillture identity pieces. All are recolourable: they paint with
 * `currentColor`, so tone is just a text colour class (text-brand on black,
 * text-white on teal, text-ink on white, …).
 */

const maskStyle = (url: string): React.CSSProperties => ({
  backgroundColor: 'currentColor',
  WebkitMask: `url("${url}") center / contain no-repeat`,
  mask: `url("${url}") center / contain no-repeat`,
});

interface LogoProps {
  /** `icon` is the brain-and-column mark; `full` adds the SKILLTURE wordmark. */
  variant?: 'icon' | 'full';
  className?: string;
  /** Hide from screen readers when the name is already written next to it. */
  decorative?: boolean;
}

/** Height-driven: give it `h-8` etc; width follows the artwork's ratio. */
export const Logo: React.FC<LogoProps> = ({ variant = 'icon', className = '', decorative = false }) => {
  // The admin can replace either logo file (Site content → Images).
  const src = useLogoSrc(variant === 'full' ? 'full' : 'icon');
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Skillture'}
      aria-hidden={decorative ? true : undefined}
      className={`inline-block shrink-0 text-brand ${className}`}
      style={{
        ...maskStyle(src),
        aspectRatio: variant === 'full' ? logoAssets.fullRatio : logoAssets.iconRatio,
      }}
    />
  );
};

/** Faint column-maze texture. Parent must be `relative`; it fills the parent. */
export const Pattern: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span aria-hidden="true" className={`brand-pattern ${className}`} />
);

/** Ionic-column chain used as a section divider. Colour with `text-*`. */
export const Frieze: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span aria-hidden="true" className={`brand-frieze ${className}`} />
);
