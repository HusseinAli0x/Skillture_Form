# Architecture Overview

The project follows **Clean Architecture** principles to separate concerns and ensure maintainability.

## Layers

1.  **Domain (`internal/domain`)**
    -   Contains core business entities (`entities/`, `enums/`).
    -   Pure Go structs, no external dependencies (like DB or HTTP).

2.  **Repository (`internal/repository`)**
    -   Handles data persistence.
    -   **Interfaces (`interfaces/`)**: Defines the contract for data access.
    -   **Implementation (`postgres/`)**: Concrete implementation using `pgx` driver.
    -   **PGVector**: Special handling for vector operations.

3.  **UseCase (`internal/usecase`)**
    -   Contains business logic / application rules.
    -   Orchestrates data flow between Repositories and Domain entities.
    -   Implements `interfaces/` defined in the usecase layer.
    -   Business validation occurs here (e.g., checking if form is open before submission).

4.  **Delivery / Interface (`internal/server`)**
    -   **Handlers (`server/handlers`)**: HTTP handlers (Controllers) using Gin framework.
    -   Parses JSON requests, calls UseCases, and formats JSON responses.
    -   **Router (`server/server.go`)**: Setup of routes and middleware.

## Tech Stack
-   **Language**: Go (Golang)
-   **Web Framework**: Gin Gonic
-   **Database**: PostgreSQL
-   **Driver**: `pgx/v5`
-   **Vector Search**: `pgvector` extension
-   **Configuration**: `kelseyhightower/envconfig` pattern / `godotenv`

## Directory Structure
```
cmd/
  api/          # Entry point (main.go)
internal/
  config/       # Configuration loading
  database/     # SQL schemas and migration scripts
  domain/       # Entities
  repository/   # Database access
  server/       # HTTP handlers & router
  usecase/      # Business logic
docs/           # Project documentation
```
