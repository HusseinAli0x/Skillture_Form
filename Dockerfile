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
FROM alpine:3.21

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
# The site address comes from SITE_ADDRESS and defaults to a bare port, so
# Caddy does not attempt automatic HTTPS (local dev, CI, the smoke test). For a
# real deployment set SITE_ADDRESS to the public hostname(s), e.g.
# "skilltrue.club, www.skilltrue.club": Caddy then obtains and renews a Let's
# Encrypt certificate itself, listens on 80/443, and redirects www.* to the
# bare domain. Publish 80, 443 and 443/udp and persist /data so the certificate
# survives restarts — docker-compose.prod.yml does all of this.
#
# Only the admin *API* paths go to the backend. /admin/dashboard, /admin/forms
# etc. are client-side routes and must fall through to the SPA.
#
# Client IP. Behind Cloudflare's proxy every request arrives from a Cloudflare
# edge address, which would make the API's rate limiting and login lockout treat
# all visitors as one client. Caddy therefore trusts CF-Connecting-IP, but only
# when the TCP peer is inside Cloudflare's published ranges (the
# trusted_proxies list below, from https://www.cloudflare.com/ips/ — refresh it
# if Cloudflare adds ranges). A direct connection cannot spoof the header. The
# resolved address is passed to the API as X-Forwarded-For, and the API trusts
# only loopback (this Caddy) as its proxy, so it cannot be spoofed either.
# WebSocket upgrades on /ws are proxied transparently with no idle timeout; the
# API's 54s ping keeps them alive.
#
# The loopback-only site at the bottom serves the same app over plain HTTP so
# the container HEALTHCHECK works whatever SITE_ADDRESS is. Port 8080 is not
# published in production.
#
# Vite emits content-hashed filenames under /assets, so they never change in
# place and are cached for a year. Everything else (index.html, the SPA
# fallback, public/ files) is revalidated so a deploy is picked up.
COPY <<"EOF" /etc/caddy/Caddyfile
{
	admin off

	servers {
		trusted_proxies static 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22 2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32
		client_ip_headers CF-Connecting-IP X-Forwarded-For
	}
}

(app) {
	encode zstd gzip

	header {
		# Browsers ignore HSTS over plain HTTP, so this only takes effect once
		# the site is served over HTTPS. No includeSubDomains / preload: those
		# are hard to undo.
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		# The site is never meant to be framed, and a game link must not leak
		# its path to other sites.
		X-Frame-Options DENY
		Referrer-Policy strict-origin-when-cross-origin
	}

	@backend path /health /api/* /uploads/* /ws /ws/* /admin/login /admin/me /admin/create /admin/list /admin/delete/*

	handle @backend {
		reverse_proxy 127.0.0.1:8081 {
			header_up X-Forwarded-For {client_ip}
		}
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

{$SITE_ADDRESS::8080} {
	# www.example.com -> example.com (keeps path and query).
	@www expression {http.request.host}.startsWith('www.')
	redir @www {scheme}://{labels.1}.{labels.0}{uri} permanent

	import app
}

http://127.0.0.1:8080 {
	import app
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
