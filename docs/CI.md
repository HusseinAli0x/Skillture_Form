# Continuous integration

Everything CI runs, you can run locally with one command:

```sh
make ci       # the whole pipeline (needs Docker)
make check    # the fast part: lint, tests, vulnerability scan, frontend
make help     # every target
```

## Pipelines

| Workflow | Runs on | Purpose |
|---|---|---|
| `ci.yml` | every push, PR, merge queue, `v*` tag | build, test, scan, smoke-test, publish |
| `security.yml` | push to main, PRs, **weekly** | CodeQL, secret scan, dependency review, vulnerability sweep |
| `dependabot.yml` | weekly | grouped dependency updates for Go, npm, Actions, Docker |

### `ci.yml`

```
changes ─┬─ backend-lint ─────────┐
         ├─ backend-test ─────────┤
         ├─ backend-vulncheck ────┼─► CI gate ─► publish (main / v* tags only)
         ├─ frontend ─────────────┤
         └─ docker ───────────────┘
```

| Job | What it enforces |
|---|---|
| **Detect changes** | PRs only run the jobs their files affect. Pushes run everything. |
| **Backend lint** | `go.mod` tidy, `gofmt`, `go vet`, `golangci-lint` (errcheck, staticcheck, gosec, errorlint, bodyclose, …) |
| **Backend tests** | `go test -race -shuffle=on` against a **real Postgres + pgvector**, a guard that the DB tests were not silently skipped, and a coverage floor |
| **Backend vulnerabilities** | `govulncheck`: fails only on vulnerabilities the code can actually reach |
| **Frontend** | lint, type-check, tests with coverage thresholds, production build, bundle-size report, `npm audit` on production dependencies |
| **Docker image** | Hadolint, build, **Trivy** scan (fixable HIGH/CRITICAL), then the **smoke test** |
| **CI gate** | the one required check — see below |
| **Publish** | pushes the image to GHCR with provenance and an SBOM, after the gate is green |

### The smoke test (`scripts/ci-smoke.sh`)

Unit tests prove the parts. This proves the **shipped image** works: it starts
a real Postgres and the production container, then drives it through Caddy
exactly as a browser would — SPA routes, hashed assets and cache headers,
migrations on boot, sign-in, creating and reading workshops and team members,
validation rejections, image upload and serving, and that the container runs
as a non-root user. About 40 checks, ~1 minute. It exits non-zero on any
failure and prints the container logs.

## Branch protection (one-time setup)

CI cannot configure this itself. In **Settings → Branches → Branch protection
rule** for `main` (and `dev`/`stage` if used):

1. **Require a pull request before merging**
2. **Require status checks to pass** → add exactly one: **`CI gate`**
3. **Require branches to be up to date before merging**
4. (Recommended) **Require conversation resolution**, **Do not allow bypassing**

Require only `CI gate`, not the individual jobs. It fails when any job fails,
and it treats jobs skipped by path filtering as success, so a docs-only PR
isn't blocked by a check that legitimately did not run.

Also enable under **Settings → Code security**: Dependabot alerts and security
updates, and secret scanning with push protection.

## Floors and thresholds

These stop quality from sliding; they are not targets.

| Gate | Where | Value |
|---|---|---|
| Backend coverage | `BACKEND_COVERAGE_FLOOR` in `ci.yml` (and `Makefile`) | 12.0% |
| Frontend coverage | `coverage.thresholds` in `frontend/vitest.config.ts` | 70 / 75 / 60 / 70 (statements / branches / functions / lines) |

Raise them when coverage rises. Never lower one to make a red build green.

## Conventions worth knowing

- **Database tests skip without `TEST_DATABASE_URL`.** CI provides a Postgres;
  locally `make backend-test` starts a throwaway one. A guard step fails the
  build if the DB tests ever go back to skipping.
- **Migrations are append-only.** A migration that has run anywhere is never
  edited; fix it with a new numbered file. The schema test enforces, for
  example, that no column is `TIMESTAMP WITHOUT TIME ZONE`.
- **`govulncheck` is pinned** (`v1.1.4`) because newer releases need Go 1.26 to
  build, while the scan must run on the project's own toolchain to report the
  right standard-library advisories. Bump both together.
- **Go version** comes from `backend/go.mod` (`check-latest` picks the newest
  patch). The Dockerfile pins the same minor — update both when bumping.
- **Actions are pinned to major versions** and kept current by Dependabot.
  For stricter supply-chain hygiene, pin to commit SHAs.

## When CI is red

| Symptom | Likely cause and fix |
|---|---|
| `go.mod/go.sum are not tidy` | run `go mod tidy` in `backend/`, commit |
| `golangci-lint` finding | fix it; if it is a false positive, `//nolint:linter // reason` (the reason is required) |
| `govulncheck` reports a vuln | `go get module@fixed-version && go mod tidy`; or bump the Go patch version |
| `Database integration tests were skipped` | `TEST_DATABASE_URL` is not reaching the tests; check the Postgres service |
| Trivy finds a vulnerability | bump the base image tag or the Go/npm dependency it names |
| Smoke test fails | the logs are printed in the job; reproduce with `make docker smoke` |
| Coverage below floor | add tests; do not lower the floor |
