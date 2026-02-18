# How to Use Skillture Form Service

This guide explains how to configure, run, and test the Skillture Form Service.

## Prerequisites

- **Go**: Version 1.25.4 or higher
- **PostgreSQL**: A running instance of PostgreSQL (v14+)
- **Postman**: (Optional) For API testing

## 1. Configuration (.env)

The application requires environment variables to be set. These are loaded from a `.env` file located in the **project root folder** (where `go.mod` is).

**Do not** delete or move the `.env` file. It should look like this:

```env
SERVER_PORT=8080
DATABASE_URL=postgres://user:password@localhost:5432/dbname?sslmode=disable
```

## 2. Running the Application

**IMPORTANT**: You must run the application from the **project root** directory, not from inside `cmd/api`, so that it can find the `.env` file.

### Correct Way

```bash
# Navigate to the project root
cd /home/cpper/Projects/Skillture/Skillture_Form

# Run the application
go run cmd/api/main.go
```

### Incorrect Way (What you likely did)

```bash
cd cmd/api
go run main.go # Error: No .env file found
```

## 3. Running Tests

To run all tests (unit and integration), execute the following command from the **project root**:

```bash
# Run all tests recursively
go test ./...

# Run tests with verbose output
go test -v ./...
```

**Note**: Integration tests require a running database accessible via the credentials in your `.env` file.

## 4. API Testing

### Using Postman
A Postman collection file named `TestEndpoints.json` is located in the project root.
1. Open Postman.
2. Click **Import**.
3. Select `TestEndpoints.json`.
4. The collection "Skillture Form API" will appear.
5. You can now run requests against your local server (default `http://localhost:8080`).

## 5. Directory Structure
- **cmd/api**: Entry point (`main.go`).
- **internal**: Application source code (Domain, Usecase, Repository, Server).
- **docs**: Documentation files.
