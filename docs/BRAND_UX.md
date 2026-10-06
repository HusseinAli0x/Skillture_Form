# Skillture brand + UX direction

Source of truth for every screen: public site, admin app, and the live quiz
game. Derived from the identity deck (`res/presentatiom Skillture.pdf`) and the
poster (`res/1.png`). Supersedes the palette/type in `PUBLIC_SITE_DESIGN.md`
(its layout rules still hold).

## The identity, in one paragraph

A brain drawn as a maze, with a Roman column running down its centre: intellect,
structure, a path to find. Tagline **"Where ideas find their way."** The poster
adds the human beat: **"workshops that improve you."** with a hand pointing at
the viewer. Voice: direct, warm, a little playful — the type is rounded and
friendly, the geometry is strict.

## Palette (deck: "Palette" + usage ratio)

| Token | Hex | Share | Use |
|---|---|---|---|
| `ink` / black | `#000` → `#050909` | 30% | app background, black bands, text on light |
| `brand` turquoise | `#00CCCC` | 20% | solid blocks, primary action on dark, logo |
| `teal` | `#01A3A3` | 20% | gradients, secondary surfaces, poster field |
| `coral` | `#FF4040` | **5%** | the single accent: LIVE, wrong answer, the one CTA |
| white | `#FFF` | 25% | public site surface |

Rules (from the deck's "uses of the palette": not every colour goes on every
surface):

- **Turquoise is a surface, not body text, on white** (1.9:1). On white use
  `text-primary` (`#007a7a`, 5.3:1). On black, turquoise text is fine (11:1).
- **Text on a turquoise block is black** (`.on-brand`). Never white-on-turquoise.
- **Coral is rare.** One coral thing per screen at most. Never a large field.
- The app (`/admin`, `/play`, `/host`) is black-dominant. The public site is
  white-dominant with black bands (`.on-ink`) and turquoise blocks (`.on-brand`).
- Gradients: poster-style teal (`#01A3A3` → `#006b6b`, diagonal). No neon glows,
  no purple, no glassmorphism.

## Type

- Display: **Baloo Bhaijaan 2** (`font-display`; applied to h1–h3 globally).
  Closest free match to Berlin Sans FB + "All Genders" and, importantly, it has
  Arabic. Heavy weights (700–800) for headings and numerals.
- Body: **Readex Pro** (`font-sans`), Latin + Arabic.
- Arabic is first-class: the site is bilingual (`useLanguageStore`, `dir=rtl`).
  Use logical properties (`ms-*`, `ps-*`, `text-start`), never `ml/pl/text-left`
  in new code.

## Ornaments (`components/brand`)

- `<Logo variant="icon|full" className="h-8 text-brand" />` — recolourable.
- `<Pattern className="text-white opacity-[0.06]" />` — column-maze texture; the
  parent must be `relative` (and usually `overflow-hidden`).
- `<Frieze className="text-ink/30" />` — column-chain divider, replaces `<hr>`.
- Photos in `public/brand/` via `brandAssets`: `poster` (3:4), `hand` (3:2, no
  text), `pattern`, `pins`, `badge`, `cards`, `stationery` (16:9 mockups).

### Where the photos go

| Asset | Place | Why |
|---|---|---|
| `poster` | Login (left half, desktop) | It is a poster; it fills a tall panel and says what we do |
| `hand` | Home hero right side, the PIN box sits where the finger points | "Join in two taps" — the finger literally points at the action |
| `pattern` | Player join/lobby backdrop, 404/empty states | Texture with no baked-in text |
| `badge` | Home "for participants" / lobby concept | Lanyard ID = the player card |
| `pins`, `cards` | About/CTA band, Our Work header | Real brand objects, shown once each, not repeated |

Never stretch, never repeat the same photo twice on one page, always give
`alt=""` when decorative and meaningful `alt` otherwise, always set
`width`/`height` (or aspect ratio) and `loading="lazy"` below the fold.

## UX principles (what "easier and cooler" means here)

1. **One obvious next action per screen.** Primary button = brand turquoise on
   dark, black on light. Everything else is secondary/ghost.
2. **Empty states teach.** No blank tables: say what this is, give the one
   button that fills it (`EmptyState`).
3. **Never a dead end.** Every error has a recovery (retry / back / contact),
   in plain language, in the user's language.
4. **Instant feedback.** Loading skeletons or spinners on every fetch, optimistic
   toasts on every save, disabled+spinner on submit. No silent failures.
5. **Mobile first for players.** `/play` and `/quiz/:id` are used one-handed on a
   phone: 48px+ tap targets, big PIN input with numeric keypad
   (`inputMode="numeric"`), nothing that needs hover.
6. **Admins are fast, not fancy.** Keyboard-friendly, dense but calm, clear
   status chips, confirm only destructive actions, undo-style toasts.
7. **Motion answers actions** (press, join, reveal an answer, rank change).
   Respect `prefers-reduced-motion`. No scroll-reveal, no parallax.
8. **Accessible by default.** Visible focus ring (`ring-primary`), 4.5:1 text,
   labels on every input, `aria-live` for game state changes.

## Don't (this is what reads as "AI-made")

Gradient text, glow blurs, icon-in-circle feature grids, centred
heading+subtitle stacks everywhere, identical rounded-card walls, emoji as
design, made-up statistics, "Welcome to…" hero copy, lorem-style filler.
