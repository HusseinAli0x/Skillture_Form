# Skillture — Frontend

React 19 SPA for the Skillture assessment platform: form building, public form
submission, and the real-time quiz game (host and player views).

The backend, Docker Compose setup and full getting-started instructions live in
the [repository README](../README.md).

## Stack

- **Vite 8** + **React 19** + **TypeScript** (strict)
- **Tailwind v4**, configured entirely through the `@theme` block in `src/index.css`
- **zustand** for auth and toast state, **axios** for HTTP, native `WebSocket` for the game
- **oxlint** for linting

## Running it

```bash
npm ci
npm run dev      # http://localhost:5173, proxying /api, /admin and /ws to :8080
```

The dev server proxies to a backend on `127.0.0.1:8080` (see `vite.config.ts`), so
start the backend first or those requests fail.

```bash
npm run build         # tsc -b && vite build
npm run lint          # oxlint
npm test              # vitest run
npm run test:watch    # vitest, in watch mode
npm run test:coverage # vitest run --coverage
npm run preview       # serve the production build locally
```

`npm run build` typechecks first. Note that a bare `tsc --noEmit` checks **nothing**
here — the root `tsconfig.json` holds only project references, so use `tsc -b`.

## Layout

```
src/
  api/          axios client, WebSocket URL helpers, and the types mirroring the Go entities
  components/
    ui/         shared primitives — Button, Input, Card, Modal, Spinner, ConfirmDialog…
    forms/      form-builder field editor and the respondent-facing field input
    quiz/       quiz-builder question editor
    responses/  print-only PDF template for the responses export
    dashboard/  dashboard panels
    layout/     admin shell
  context/      zustand stores (auth, toasts)
  lib/          i18n helpers, id generation, public link builders, export helpers
  pages/        one file per route
  test/         Vitest setup (jest-dom matchers, unmount between tests)
```

Tests live beside what they cover (`lib/i18n.test.ts` next to `lib/i18n.ts`) and
run under Vitest with jsdom and Testing Library. `vitest.config.ts` is standalone
rather than merged with `vite.config.ts` — a test run needs neither the dev-server
proxy nor the Tailwind plugin.

## Conventions

- **`src/api/types.ts` mirrors the Go entities.** Nearly every user-visible bug found
  in the August 2026 audit came from those two drifting apart — statuses are `int16`,
  not string unions. `strict` is on, so the next mismatch fails the build.
- **No colour literals.** Every colour is a token from the `@theme` block in
  `src/index.css`; `bg-primary`, `text-muted`, `border-border` and friends are
  generated from it. The one deliberate exception is the fixed answer-tile palette
  in `PlayerLiveBoard`, documented in place.
- **No inline `style` objects for hover or focus.** Use the primitives, or Tailwind's
  `hover:` / `focus:` variants.
- **Multilingual fields go through `lib/i18n`.** Titles, labels and question text are
  JSONB maps (`{"en": "...", "ar": "..."}`), never plain strings.
- **No native `alert()` or `confirm()`.** Use the toast store and `ConfirmDialog`.
- **Editor state lives beside its editor, not in it.** `fieldState.ts` and
  `questionState.ts` hold the shapes and constants so the `.tsx` files export only
  components, which is what React Fast Refresh needs to preserve state on edit.
