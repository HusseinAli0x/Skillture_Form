# --- Stage 1: Build the Application ---
FROM golang:1.22-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy dependency files first to leverage Docker layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the application source code
COPY . .

# Build the binary with CGO disabled for a statically linked executable
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api/main.go


# --- Stage 2: Final Runtime Image ---
FROM alpine:latest
WORKDIR /root/

# Copy only the compiled binary from the builder stage to keep the image small
COPY --from=builder /app/main .

# Expose the port the application runs on (make sure it matches your config)
EXPOSE 8080

# Command to execute the application when the container starts
CMD ["./main"]