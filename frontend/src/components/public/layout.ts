/** Page gutter and max width shared by every public section. */
export const WRAP = 'max-w-6xl mx-auto px-5 sm:px-8';

/** Display size for each page's single h1 (Baloo Bhaijaan 2 via the global heading rule). */
export const H1 = 'text-[clamp(2.5rem,6.2vw,4.6rem)] text-balance';

/** Display size for section headings. */
export const H2 = 'text-[clamp(1.9rem,3.8vw,2.8rem)] text-balance';

const BTN =
  'inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-lg font-semibold transition-colors cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 disabled:cursor-not-allowed';

/** The default action: black on light surfaces (it also sits fine on a turquoise block). */
export const BTN_INK = `${BTN} bg-ink text-white hover:bg-[#13302f]`;

/** Same button, kept under its older name for the pages that already use it. */
export const BTN_PRIMARY = BTN_INK;

/** The default action on a black band: a solid turquoise block with black text. */
export const BTN_BRAND = `${BTN} bg-brand text-ink hover:bg-primary-hover`;

/** The one coral thing on a screen. Black text: white on coral is only 3.4:1. */
export const BTN_CORAL = `${BTN} bg-coral text-ink hover:brightness-95`;

/** Quiet secondary action. */
export const BTN_GHOST = `${BTN} border border-border-strong hover:border-ink hover:bg-hover-overlay`;

export const LINK_UNDERLINE =
  'inline-flex items-center min-h-11 font-medium underline underline-offset-4 decoration-1 hover:text-primary transition-colors';

/** Visible keyboard focus on links/buttons that have no other styling. */
export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
