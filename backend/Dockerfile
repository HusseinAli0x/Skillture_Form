# --- Stage 1: Build the Application ---
FROM golang:1.25.4-alpine AS builder

WORKDIR /app

# Copy dependency files first
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the application source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api/main.go

# --- Stage 2: Final Runtime Image ---
FROM alpine:latest
WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/main .

# Expose port
EXPOSE 8080

CMD ["./main"]
