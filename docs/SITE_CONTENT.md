# Editing the public site

Everything a visitor reads or sees on the public site can be changed from the
dashboard, without a deploy: **Admin → Site content** (`/admin/site`) for wording,
images and contact links, plus the dedicated editors for the homepage text,
workshops and team.

| What | Where | Notes |
|---|---|---|
| Wording on every public page, English and Arabic | Site content → Wording | Searchable; "Use default" restores the original |
| Photographs and both logos | Site content → Images & logos | Live the moment they are uploaded |
| Contact email and social links | Site content → Contact & links | Shown on the homepage and in every footer |
| English homepage hero / about / tracks | Homepage Editor | Lives in the database; the *Arabic* version is under Wording |
| Workshops (text, dates, photos, registration) | Workshops | Includes who has registered |
| Team members and photos | Team | |

## How it works

The built-in wording and images stay in the code as **defaults**
(`frontend/src/lib/siteStrings.ts`, `translations.ts`, `components/brand/assets.ts`).
The database stores **only what an admin changed**, so resetting something is deleting
a row, and the site still renders from the defaults if the content request fails.

```
GET /api/v1/site  →  { text: { en: {key: value}, ar: {…} }, images: {slot: path}, settings: {key: value} }
```

- **Text** is addressed by the dotted path of the string in its table, prefixed with the
  table: `site.home.ctaPrimary`, `core.hero.title`. The frontend merges the overrides over the
  defaults (`applyOverrides`) and every public component reads the result through the hooks in
  `lib/useSiteContent.ts` (`useSiteStrings`, `useTranslations`, `useBrandAsset`, `useLogoSrc`,
  `useSiteSettings`). The content is loaded once at start (`context/SiteStore.ts`); the public
  shell waits a moment for it so the built-in text never flashes into the edited text, and gives
  up after 2.5 s.
- **Images** are fixed *slots* (`logo_full`, `logo_icon`, `hand`, `badge`, `pins`, `cards`,
  `stationery`, `poster`). The server accepts only those names and only files under `/uploads/`.
- **Settings** are the contact email and five social links. Links must be `http(s)` because they
  become `href` values on a public page. Emptying a link **hides** it (even LinkedIn, which has a
  built-in default); emptying the email puts the default address back.

Tables: `site_text_overrides(key, locale, value)`, `site_assets(slot, path)`,
`site_settings(key, value)` (migration `0010`). Writes: `PUT /api/v1/admin/site/text`,
`PUT /api/v1/admin/site/images/:slot`, `POST /api/v1/admin/site/image` (upload),
`PUT /api/v1/admin/site/settings`; all require an admin token.

## Adding new editable wording

Add the string to the English **and** Arabic objects of `siteStrings.ts` (or
`translations.ts`) and read it through the hook. It appears in the editor automatically — the
list is generated from those tables (`buildTextCatalog`). Two rules, both enforced by tests:

- keys are letters, digits and underscores joined by dots (the server rejects anything else), and
- a string that is defined but never displayed should be listed in `UNUSED_KEY`
  (`lib/siteContent.ts`) so the editor does not offer a field that does nothing.

Functions in the tables (such as `delivered(n)`) are not editable text and are left alone.

## Adding a new image slot

Add the slot name to `siteImageSlots` (`backend/internal/server/handlers/site_handler.go`) and to
`IMAGE_SLOTS` (`lib/siteContent.ts`, with its default file and proportions), then read it with
`useBrandAsset`. Each list is asserted in its own tests (`site_handler_test.go`,
`siteContent.test.ts`) against the same set of slot names, so remember to update both lists and
those two assertions together — a slot added to only one side is not caught automatically.

## Not editable here

The browser tab icon and the link-preview image live in `frontend/index.html` and
`frontend/public/`; changing them needs a rebuild. Quiz and game screens have their own wording
in `lib/game/*`.
