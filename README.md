# Skillture Platform

Skillture is an assessment platform for building forms and running real-time quiz games.
This repository contains the Go backend and the Vite + React + TypeScript frontend,
containerized with Docker Compose.

Further reading:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the system is put together.
- [`docs/ISSUES.md`](docs/ISSUES.md) — known defects, fixed and outstanding.

## Architecture

- `/backend` — Go 1.25 application: Gin, pgx/v5, JWT auth, gorilla/websocket, Google Gemini.
- `/frontend` — React 19 SPA: Vite, TypeScript, Tailwind v4, zustand, axios.
- PostgreSQL 16 with the `pgvector` extension.

The whole application ships as one Docker image (root `Dockerfile`): Caddy serves the SPA and
proxies `/api`, `/admin`, `/uploads` and `/ws` to the Go API in the same container — so the
browser only ever talks to one origin. `docker-compose.yml` runs that image next to Postgres.

## Prerequisites

- Docker and Docker Compose, with the buildx plugin (BuildKit) — the Dockerfile uses heredocs
- Node.js 22+ for local frontend development
- Go 1.25.4+ for local backend development (see `backend/go.mod`)
- PostgreSQL 16 with `pgvector` (if running locally without Docker)

## Getting Started (Docker — recommended)

1. **Clone the repository.**

2. **Environment variables.**

   ```bash
   cp backend/.env.example backend/.env
   ```

   Then edit `backend/.env`. Two things are mandatory:

   - `JWT_SECRET` — at least 32 characters, or the backend refuses to start.
     Generate one with `openssl rand -base64 48`.
   - `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`, which must match
     `DB_USER` / `DB_PASSWORD` / `DB_NAME` in the same file.

   `GEMINI_API_KEY` is optional; leave it blank to disable the AI report panel.

3. **Run Docker Compose:**

   ```bash
   docker compose up --build -d
   ```

4. **Access the application:**
   - Public homepage: <http://localhost:5175>
   - Admin dashboard: <http://localhost:5175/admin/dashboard>
   - Backend API: <http://localhost:5175/api/v1> (the API port itself is not published)

> **Schema changes:** the backend applies its own migrations on boot from
> `backend/internal/database/migrations/`, which are embedded in the binary. Add a new
> `NNNN_description.up.sql` and restart — `docker compose up --build -d` is enough, and
> your data survives. This used to require `docker compose down -v` and total data loss,
> because the schema was mounted as a Postgres init script and those only run on an
> empty volume.

> **Run one backend replica.** WebSocket game rooms are held in process memory, so
> two replicas would split players across separate hubs: some players in one room,
> some in another, leaderboards disagreeing, and no error to indicate it. Scaling the
> backend horizontally needs a Redis or NATS broker behind the hub first — see D7 in
> [`docs/ISSUES.md`](docs/ISSUES.md).

## Default Admin Credentials

On first startup — when the `admins` table is empty — the schema seeds one account:

- **Username:** `admin`
- **Password:** `Skillture@2025`

This password is published in `backend/internal/database/migrations/0001_baseline.up.sql`,
so it is public by definition. **Change it immediately after the first login.**

## Local Development (without Docker)

### Backend

1. Ensure PostgreSQL is running and the `vector` extension is available.
2. Create an empty database. The backend applies the schema itself on first start.
3. Copy `backend/.env.example` to `backend/.env` and fill it in (see step 2 above).
4. Run:

   ```bash
   cd backend
   go run ./cmd/api
   ```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

The Vite dev server proxies `/api`, `/admin` and `/ws` to `http://127.0.0.1:8080`, so no
frontend environment variables are needed.

## Tests and checks

```bash
# Backend
cd backend
gofmt -l .          # must print nothing
go vet ./...
go test -race ./...

# Frontend
cd frontend
npx tsc -b --noEmit
npm run lint
```

Repository integration tests skip themselves unless `TEST_DATABASE_URL` points at a
scratch database:

```bash
TEST_DATABASE_URL='postgres://user:pass@localhost:5432/skillture_test' go test ./...
```

CI (`.github/workflows/ci-cd.yml`) runs all of the above, then builds and pushes the
backend and frontend images to GHCR on pushes to `main`.

## Features

- **Form Builder** — forms with eight field types, multilingual labels, draft/published/closed states.
- **Quiz Game Builder** — live, PIN-joined quizzes with speed-based scoring.
- **AI Analytics Panel** — a database activity summary generated with Google Gemini
  (`gemini-2.5-flash` by default; override with `GEMINI_MODEL`).
- **CMS Editor** — edit the public homepage copy and hero image.
- **Share Modals** — QR codes and shareable links for forms and quizzes.

## Security notes

- All admin routes require a bearer token; see `backend/internal/auth/auth.go`.
- Player-facing routes (join, answer, form submission) are intentionally unauthenticated —
  players have no accounts.
- Tokens are currently stored in `localStorage`, which is readable by any XSS on the
  origin. Moving to an httpOnly cookie is tracked in [`docs/ISSUES.md`](docs/ISSUES.md).
