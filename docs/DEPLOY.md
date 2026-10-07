# Deploying to skilltrue.club

The app ships as one Docker image (SPA + API + Caddy) plus Postgres. On a server with a public IP,
Caddy inside the image obtains and renews the Let's Encrypt certificate for the domain by itself —
there is no separate reverse proxy or certbot to run. Cloudflare provides DNS (and, optionally, its
proxy/CDN in front).

```
Browser ──HTTPS──▶ [Cloudflare, optional] ──HTTPS──▶ VPS :443 ──▶ Caddy ──▶ SPA files
                                                                      └──▶ Go API :8081 (loopback) ──▶ Postgres
```

## 1. Server

Any Linux VPS with a public IPv4 address, Docker, and Docker Compose **2.24 or newer**
(`docker compose version`; the production overlay uses `!override`).

Open these ports in the server's firewall / cloud security group:

| Port | Why |
|---|---|
| 80/tcp | Let's Encrypt HTTP challenge and the HTTP→HTTPS redirect |
| 443/tcp | HTTPS and the game WebSocket |
| 443/udp | HTTP/3 (optional but free) |

Do **not** open 5433 (Postgres). Compose binds it to `127.0.0.1` only.

## 2. DNS (Cloudflare dashboard → skilltrue.club → DNS → Records)

| Type | Name | Content | Proxy status |
|---|---|---|---|
| A | `@` | the server's IPv4 | see below |
| AAAA | `@` | the server's IPv6 — only if the server really answers on it | see below |
| CNAME | `www` | `skilltrue.club` | same as the row above |

`www.skilltrue.club` is redirected permanently to `skilltrue.club`; it needs a DNS record so that
the redirect can happen.

**Proxy status.** Both work:

- **DNS only (grey cloud)** — simplest, and the right choice for the very first start so you can
  see Caddy issue the certificate. Visitors connect straight to your server.
- **Proxied (orange cloud)** — adds Cloudflare's CDN and DDoS protection. Then go to
  **SSL/TLS → Overview** and set the encryption mode to **Full (strict)**. Never **Flexible**: it
  makes Cloudflare talk plain HTTP to Caddy, which redirects to HTTPS, and the browser ends in
  `ERR_TOO_MANY_REDIRECTS`.

WebSockets (the live quiz) work through Cloudflare with no extra setting.

Visitor IPs are handled either way. Caddy trusts `CF-Connecting-IP` only for connections that come
from Cloudflare's published address ranges, so the API's rate limiting and login lockout see the
real visitor rather than one Cloudflare edge address, and a client cannot forge the header by
connecting directly. The range list lives in the `Dockerfile` (`trusted_proxies`); Cloudflare
rarely changes it, but compare against <https://www.cloudflare.com/ips/> now and then.

## 3. Configure

```sh
git clone <this repo> && cd Skillture_Form
cp backend/.env.example backend/.env
```

Edit `backend/.env`. Compared with the example, a production server needs at least:

```sh
ENV=production
APP_SECRET_KEY=<openssl rand -base64 48>
JWT_SECRET=<openssl rand -base64 48>          # 32+ characters or the API refuses to start
POSTGRES_PASSWORD=<strong password>
DB_PASSWORD=<the same password>               # POSTGRES_* and DB_* describe one database
CORS_ALLOWED_ORIGINS=https://skilltrue.club
LOG_FORMAT=json
# GEMINI_API_KEY=...                          # optional, enables the AI report
```

`DB_HOST` / `DB_PORT` / `SERVER_*` / `TRUSTED_PROXIES` in that file are overridden by
`docker-compose.yml`; leave them alone.

## 4. Start

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose logs -f app
```

On the first start, wait for a line like `certificate obtained successfully` for
`skilltrue.club`. Then:

```sh
curl -I https://skilltrue.club/health        # HTTP/2 200
curl -I https://www.skilltrue.club/          # 301 → https://skilltrue.club/
curl -I http://skilltrue.club/               # 308 → https://skilltrue.club/
```

To serve a different domain, set it for the command:
`SITE_ADDRESS="example.com, www.example.com" docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.

## 5. Replace the default admin — before anything else

A fresh database is seeded with `admin` / `Skillture@2025`. That password is in the repository, so
treat it as public. Do this immediately after the first start, before announcing the URL:

```sh
BASE=https://skilltrue.club

# 1. sign in with the default account
TOKEN=$(curl -s -X POST $BASE/admin/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Skillture@2025"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

# 2. create your own admin (use a long random password)
curl -s -X POST $BASE/admin/create -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"username":"YOUR_NAME","password":"A_LONG_RANDOM_PASSWORD"}'

# 3. sign in as yourself, find the default account's id, delete it
TOKEN=$(curl -s -X POST $BASE/admin/login -H 'Content-Type: application/json' \
  -d '{"username":"YOUR_NAME","password":"A_LONG_RANDOM_PASSWORD"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
curl -s $BASE/admin/list -H "Authorization: Bearer $TOKEN"          # note the id of "admin"
curl -s -X DELETE $BASE/admin/delete/<id-of-admin> -H "Authorization: Bearer $TOKEN"
```

Then confirm the old login now fails with 401.

## 6. What the public can do

The site is built so visitors can act without accounts, so these endpoints are open and protected by
rate limits and validation instead of logins:

| Visitors can | Limit (per IP) |
|---|---|
| create and host quiz games | 20 new games/hour, 30 sessions/hour, 30 games stored per browser |
| register for a workshop | 60 per 10 minutes |
| send a contact message | 5 per 10 minutes |
| look up a game PIN | 120 per minute |

Behind Cloudflare these limits see the real visitor address (§2). They are held in memory, so a
restart of the container resets them — acceptable for one container, and the reason a second API
replica would need a shared store first. Visitor-created games that nobody hosted for about six
months are deleted automatically.

## 7. Day-to-day

**Update**

```sh
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Migrations are embedded in the binary and run on boot.

**Back up** — three things hold state:

| What | Where |
|---|---|
| Database | `docker compose exec postgres_db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql` |
| Uploaded images | `backend/uploads/` |
| TLS certificates | the `caddy_data` volume (re-issuable, but keep it across restarts to stay clear of Let's Encrypt rate limits) |

**Renewal** is automatic. Caddy renews about 30 days before expiry as long as ports 80/443 stay
reachable and the container keeps running.

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| No certificate, logs show ACME errors | DNS does not point at this server yet, or port 80/443 is blocked. Check `dig +short skilltrue.club` and the firewall. A stale **AAAA** record that the server does not answer on is a common cause — delete it. |
| `ERR_TOO_MANY_REDIRECTS` | Cloudflare SSL/TLS mode is **Flexible**. Set it to **Full (strict)**. |
| Cloudflare error 521/522 | Cloudflare cannot reach the server on 443: container down, firewall, or the origin has no certificate yet (see first row). |
| Live game: players stuck on "reconnecting" | Something between the browser and Caddy is dropping WebSockets. With Cloudflare proxy: check **Network → WebSockets** is on (default). |
| One IP is rate-limited for everyone | The real client IP is not reaching the API. Check the request came via Cloudflare's ranges (see §2) and that `TRUSTED_PROXIES=127.0.0.1,::1` was not changed. |
| API refuses to start in production | `APP_SECRET_KEY` empty, or `JWT_SECRET` under 32 characters. `docker compose logs app` names the field. |
| Join link / QR shows `localhost` | The host opened the app via `localhost`. Open it as `https://skilltrue.club` and the link and QR use that address. |
