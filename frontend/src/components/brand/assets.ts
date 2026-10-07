/**
 * Photographs and art cut from the identity deck / poster (public/brand).
 * These are the built-in defaults; an admin can replace any of them from
 * Site content → Images (see lib/siteContent.ts for the slot list). Kept in a
 * module of its own, free of React, so lib/ can import the paths without
 * importing components.
 */
export const brandAssets = {
  poster: '/brand/poster.webp', // full poster, 3:4 — "workshops that improve you."
  hand: '/brand/hand.webp', // pointing hand on the pattern, 3:2, no text
  pattern: '/brand/pattern.webp', // pattern on teal gradient, 4:6.5, no text
  pins: '/brand/mock-pins.webp', // 16:9 teal badges photograph
  badge: '/brand/mock-badge.webp', // 16:9 lanyard ID card
  cards: '/brand/mock-cards.webp', // 16:9 business cards on teal
  stationery: '/brand/mock-stationery.webp', // 16:9 stationery flat-lay
} as const;

/** The logo files in /public. */
export const logoAssets = {
  full: '/logo-full.png', // wide wordmark, 7126 × 1462
  icon: '/logo-icon.png', // brain-and-column mark, 1136 × 1077
  fullRatio: '7126 / 1462',
  iconRatio: '1136 / 1077',
} as const;
