# syntax=docker/dockerfile:1
#
# Single image for the whole application: the React SPA, the Go API and Caddy
# in front of both. Everything the image needs is defined in this one file —
# the Caddy config and the entrypoint script are inlined below as heredocs,
# which requires BuildKit (docker buildx; the default in CI and Compose).
#
#   docker build -t skillture .
#
# Inside the container Caddy listens on :8080 (the only exposed port) and
# reverse-proxies to the API on 127.0.0.1:8081, which is not reachable from
# outside. PostgreSQL is not part of this image — see docker-compose.yml.

# --- Stage 1: Build the SPA ---
FROM node:22-alpine AS frontend
WORKDIR /src
COPY frontend/package*.json ./
# npm ci installs exactly what package-lock.json pins, so the image matches CI.
RUN npm ci
COPY frontend/ .
RUN npm run build

# --- Stage 2: Build the API ---
FROM golang:1.25.14-alpine AS backend
WORKDIR /src
# Copy dependency files first so the module download layer is cached.
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
# -trimpath keeps build paths out of the binary; -s -w drops the symbol table
# and DWARF data (~30% smaller image).
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o main ./cmd/api/main.go

# --- Stage 3: Caddy binary ---
# 2.10.x bundles a Go toolchain and libraries with known HIGH/CRITICAL advisories
# (see the Trivy scan in CI); 2.11 is clean.
FROM caddy:2.11-alpine AS caddy

# --- Stage 4: Runtime ---
FROM alpine:3.24

# ca-certificates is required for the outbound TLS call to the Gemini API.
# Without it every request fails with:
#   x509: certificate signed by unknown authority
# `apk upgrade` pulls in security fixes published since the base image was
# built (OpenSSL had a HIGH advisory fixed in a patch after the 3.21 image).
RUN apk upgrade --no-cache && apk add --no-cache ca-certificates tzdata

# Run as an unprivileged user. Caddy therefore listens on 8080, not 80.
RUN adduser -D -H -u 10001 skillture

COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY --from=frontend /src/dist /srv

# ---- Caddy config ----
# Serves the SPA bundle and reverse-proxies the API on one origin.
#
# The site address is a bare port, so Caddy does not attempt automatic HTTPS.
# For a real deployment, replace ":8080" with a domain (e.g.
# "forms.example.com"), publish 80/443, and persist /data so the certificate
# survives restarts.
#
# Only the admin *API* paths go to the backend. /admin/dashboard, /admin/forms
# etc. are client-side routes and must fall through to the SPA.
#
# Caddy sets X-Forwarded-For to the real client IP and discards any
# X-Forwarded-For the client sent, so it cannot be spoofed. The API listens on
# loopback only and trusts 127.0.0.1 as its proxy. WebSocket upgrades on /ws
# are proxied transparently with no idle timeout; the API's 54s ping keeps
# them alive.
#
# Vite emits content-hashed filenames under /assets, so they never change in
# place and are cached for a year. Everything else (index.html, the SPA
# fallback, public/ files) is revalidated so a deploy is picked up.
COPY <<"EOF" /etc/caddy/Caddyfile
{
	admin off
}

:8080 {
	encode zstd gzip

	@backend path /health /api/* /uploads/* /ws /ws/* /admin/login /admin/me /admin/create /admin/list /admin/delete/*

	handle @backend {
		reverse_proxy 127.0.0.1:8081
	}

	handle {
		root * /srv

		@mutable not path /assets/*
		header /assets/* Cache-Control "public, max-age=31536000, immutable"
		header @mutable Cache-Control "no-cache"

		try_files {path} /index.html
		file_server
	}
}
EOF

# ---- Entrypoint ----
# Runs the API and Caddy side by side. If either process exits, the other is
# stopped and the container exits with the first process's status, so
# Docker's restart policy restarts the pair rather than leaving a half-working
# container that still passes as "running". docker stop sends SIGTERM to
# PID 1, which is passed on to both children.
COPY --chmod=755 <<"EOF" /usr/local/bin/entrypoint.sh
#!/bin/sh
set -u

/app/main &
api_pid=$!

caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
caddy_pid=$!

shutdown() {
	kill -TERM "$api_pid" "$caddy_pid" 2>/dev/null
	wait "$api_pid" 2>/dev/null
	wait "$caddy_pid" 2>/dev/null
}

trap 'shutdown; exit 0' TERM INT

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$caddy_pid" 2>/dev/null; do
	sleep 1
done

if kill -0 "$api_pid" 2>/dev/null; then
	wait "$caddy_pid"; status=$?
	echo "entrypoint: caddy exited with status $status, stopping API" >&2
else
	wait "$api_pid"; status=$?
	echo "entrypoint: API exited with status $status, stopping caddy" >&2
fi
shutdown
exit "$status"
EOF

# /app is also where docker-compose mounts the uploads volume — the API
# resolves "./uploads" relative to its working directory, so this WORKDIR and
# that mount must agree.
WORKDIR /app
COPY --from=backend /src/main /app/main
RUN mkdir -p /app/uploads /data /config && chown -R skillture:skillture /app /data /config

# Caddy keeps its state (certificates, autosaved config) under these.
ENV XDG_DATA_HOME=/data \
    XDG_CONFIG_HOME=/config \
    SERVER_HOST=127.0.0.1 \
    SERVER_PORT=8081 \
    TRUSTED_PROXIES=127.0.0.1,::1

USER skillture

EXPOSE 8080

# Exec form: wget exits non-zero on any failure, so no shell wrapper is needed.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/health"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
