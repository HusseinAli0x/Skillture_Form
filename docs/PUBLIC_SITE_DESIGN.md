# Public site design direction

Scope: the public pages only (home, Our Work, workshop detail, Team). The admin
app and the live quiz screens (`/play`, `/host/*`) keep their own dark UI.

## Why this exists

The first version of the public site used the defaults that make a page read as
machine-made: near-black background with a neon accent, a blurred glow behind
the hero, small all-caps labels above every heading, centered heading +
subtitle stacks, identical rounded cards in grids, everything fading in on
scroll, and made-up statistics. This direction replaces those with choices
taken from what Skillture actually is.

## Reference findings

- Best-in-class team pages lead with large honest portraits (Miro, Harvest,
  Mother Design), not icon grids. People are the content.
- Impact numbers work best as huge plain numerals with a one-line label
  (YLLW, Collins, Klarna), not decorated stat cards.
- Event archives read best as ruled rows — date, title, place — not card walls
  (Webflow, Koto). A row scans; a card grid hides the list.
- Show the real product in the first screen.

## Direction

Purpose: convince universities and companies that Skillture's workshops are
measured, and let a student in the room join a quiz in two taps.

Tone: plain, confident, human. A results board, not a brochure.

Memorable detail: the **game PIN box in the hero** (it works), and workshops
shown as a **scoreboard of ruled rows** with the outcome highlighted like a
marker on a result sheet.

### Palette (roles)

| Role | Value | Use |
|---|---|---|
| Paper | `#F5F7F6` | page background |
| Ink | `#0E1A1B` | text, dark bands |
| Brand | `#0ABFBC` | solid colour blocks (logo teal), never a glow |
| Deep teal | `#00747A` | links, primary buttons (5:1 on paper) |
| Marker | `#FFD84D` | highlights on outcomes and key numbers only |

### Type

Readex Pro for both Arabic and Latin — one family drawn for both scripts, so
the two languages look like the same site. Weights 300–700. No all-caps
tracked eyebrows, no monospace labels.

### Layout rules

- Left-aligned (logical start) by default; centered text only where it earns it.
- Sections differ in structure: statement, method, list, results board, people.
- Radius is restrained (4–8px); one rounded block (the PIN box). No shadows.
- No reveal-on-scroll animation. Motion only answers user actions.
- Never invent numbers. Every figure on the page is computed from real rows.
- Photography first: layouts are built around real photos; without a photo they
  fall back to a plain colour block with initials, not a stock illustration.
