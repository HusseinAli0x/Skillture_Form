# Run the same checks CI runs, locally. `make ci` is the whole pipeline.
#
# Needs: go, node 22, docker. The linters run via `go run` at the versions CI
# pins, so there is nothing to install.
#
#   make help      list targets
#   make ci        everything CI does
#   make check     fast checks only (no Docker)

GOLANGCI_LINT_VERSION ?= v2.14.0
GOVULNCHECK_VERSION   ?= v1.1.4
TEST_DB_PORT          ?= 55433
TEST_DB_NAME          := skillture-ci-pg
TEST_DATABASE_URL     := postgres://test:test@localhost:$(TEST_DB_PORT)/skillture_test?sslmode=disable
IMAGE                 ?= skillture:ci

.DEFAULT_GOAL := help
.PHONY: help ci check backend-lint backend-test backend-vulncheck frontend docker smoke db-up db-down

help: ## List targets
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

ci: check docker smoke ## Everything CI runs

check: backend-lint backend-test backend-vulncheck frontend ## Fast checks (no Docker image)

backend-lint: ## gofmt, go vet, go.mod tidy, golangci-lint
	@cd backend && test -z "$$(gofmt -l .)" || { echo "not gofmt'd:"; gofmt -l .; exit 1; }
	cd backend && go vet ./...
	@cd backend && before=$$(mktemp -d) && cp go.mod go.sum $$before && go mod tidy && \
		{ diff -q $$before/go.mod go.mod >/dev/null && diff -q $$before/go.sum go.sum >/dev/null || \
		{ echo "go.mod/go.sum are not tidy; 'go mod tidy' has fixed them in place"; exit 1; }; }
	cd backend && go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@$(GOLANGCI_LINT_VERSION) run ./...

backend-test: db-up ## Backend tests against a real Postgres, with the coverage floor
	cd backend && TEST_DATABASE_URL='$(TEST_DATABASE_URL)' \
		go test -race -shuffle=on -count=1 -p 1 -covermode=atomic -coverprofile=coverage.out ./...
	@cd backend && total=$$(go tool cover -func=coverage.out | awk '/^total:/ {gsub("%","",$$3); print $$3}'); \
		echo "backend coverage: $$total%"; \
		awk -v t="$$total" 'BEGIN { exit (t+0 < 12.0) }' || { echo "below the 12.0% floor"; exit 1; }
	@$(MAKE) --no-print-directory db-down

backend-vulncheck: ## Reachable Go vulnerabilities
	cd backend && go run golang.org/x/vuln/cmd/govulncheck@$(GOVULNCHECK_VERSION) ./...

frontend: ## lint, type-check, tests + coverage, build, production audit
	cd frontend && npm ci && npm run lint && npx tsc -b && npm run test:coverage && npm run build
	cd frontend && npm audit --omit=dev --audit-level=high

docker: ## Build the image CI builds
	docker build -t $(IMAGE) .

smoke: ## End-to-end smoke test of the built image
	scripts/ci-smoke.sh $(IMAGE)

db-up: ## Throwaway Postgres+pgvector for the DB tests
	@docker rm -f $(TEST_DB_NAME) >/dev/null 2>&1 || true
	@docker run -d --name $(TEST_DB_NAME) -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test \
		-e POSTGRES_DB=skillture_test -p $(TEST_DB_PORT):5432 pgvector/pgvector:pg16 >/dev/null
	@for i in $$(seq 1 40); do docker exec $(TEST_DB_NAME) pg_isready -U test -d skillture_test >/dev/null 2>&1 && break; sleep 1; done
	@sleep 2

db-down: ## Remove the throwaway Postgres
	@docker rm -f $(TEST_DB_NAME) >/dev/null 2>&1 || true
