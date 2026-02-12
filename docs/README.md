# Skillture Form

A Clean Architecture Go application for managing dynamic forms, collecting responses, and supporting semantic search via vector embeddings.

## Documentation
-   [API Reference](API.md)
-   [Database Schema](DATABASE.md)
-   [Architecture Overview](ARCHITECTURE.md)

## Prerequisites
-   Go 1.21+
-   PostgreSQL 15+
-   `pgvector` extension for PostgreSQL

## Setup

1.  **Clone the repository**
2.  **Install Dependencies**
    ```bash
    go mod download
    ```
3.  **Environment Setup**
    Copy `.env.example` (if exists) or create `.env`:
    ```env
    SERVER_PORT=8080
    DATABASE_URL=postgres://cpper:0770@localhost:5432/skillture_form?sslmode=disable
    ```
4.  **Database Migration**
    Apply the schema:
    ```bash
    psql -U cpper -d skillture_form -f internal/database/database.sql
    ```

## Running the Application
```bash
go run cmd/api/main.go
```
The server will start at `http://localhost:8080`.

## Testing
Run unit and integration tests:
```bash
go test ./...
```
