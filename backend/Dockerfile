# --- Stage 1: Build the Application ---
FROM golang:1.25.4-alpine AS builder

WORKDIR /app

# Copy dependency files first
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the application source code
COPY . .

# Build the binary. -trimpath keeps build paths out of the binary; -s -w drops
# the symbol table and DWARF data (~30% smaller image).
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o main ./cmd/api/main.go

# --- Stage 2: Final Runtime Image ---
FROM alpine:3.21

# ca-certificates is required for the outbound TLS call to the Gemini API.
# Without it every request fails with:
#   x509: certificate signed by unknown authority
RUN apk add --no-cache ca-certificates tzdata

# Run as an unprivileged user. /app is also where docker-compose bind-mounts
# ./backend/uploads — the app resolves "./uploads" relative to its working
# directory, so this WORKDIR and that mount must agree.
RUN adduser -D -H -u 10001 skillture
WORKDIR /app
RUN mkdir -p /app/uploads && chown -R skillture:skillture /app

COPY --from=builder --chown=skillture:skillture /app/main .

USER skillture

EXPOSE 8080

CMD ["./main"]
