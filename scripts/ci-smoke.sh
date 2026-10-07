#!/usr/bin/env bash
#
# End-to-end smoke test of the *shipped* Docker image against a real Postgres.
#
# Unit tests prove the pieces; this proves they are wired together the way
# production runs them: Caddy in front, the SPA bundle, the Go API, migrations
# applied on boot, uploads, and auth. It catches the failures unit tests can't
# — a Caddy route that swallows an SPA path, a migration that works on a
# scratch DB but not on boot, a file permission that breaks uploads.
#
#   scripts/ci-smoke.sh [image]      (default image: skillture:ci)
#
# Needs: docker, curl, python3, and Node 22+ for the live-game check (skipped
# locally if absent; set REQUIRE_GAME_SMOKE=1 to make that a failure, as CI does).
# Everything it creates is removed on exit.
set -euo pipefail

IMAGE="${1:-skillture:ci}"
RUN="skillture-smoke-$$"
NET="${RUN}-net"
PG="${RUN}-pg"
APP="${RUN}-app"
PASS=0
FAIL=0

cleanup() {
  local status=$?
  if [ "$status" -ne 0 ] && docker inspect "$APP" >/dev/null 2>&1; then
    echo "::group::app container logs"
    docker logs "$APP" 2>&1 | tail -80 || true
    echo "::endgroup::"
  fi
  docker rm -f "$APP" "$PG" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

ok()   { PASS=$((PASS + 1)); printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad()  { FAIL=$((FAIL + 1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
check() { # check <description> <command...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$desc"; else bad "$desc"; fi
}

# --- infrastructure ---------------------------------------------------------
echo "== starting postgres + app ($IMAGE)"
docker network create "$NET" >/dev/null
docker run -d --name "$PG" --network "$NET" \
  -e POSTGRES_USER=skillture -e POSTGRES_PASSWORD=smoketest -e POSTGRES_DB=skillturedb \
  pgvector/pgvector:pg16 >/dev/null

for _ in $(seq 1 60); do
  docker exec "$PG" pg_isready -U skillture -d skillturedb >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$PG" pg_isready -U skillture -d skillturedb >/dev/null

JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
docker run -d --name "$APP" --network "$NET" -p 127.0.0.1::8080 \
  -e DB_HOST="$PG" -e DB_PORT=5432 -e DB_USER=skillture -e DB_PASSWORD=smoketest \
  -e DB_NAME=skillturedb -e DB_SSL_MODE=disable \
  -e JWT_SECRET="$JWT_SECRET" -e ENV=development \
  "$IMAGE" >/dev/null

PORT="$(docker port "$APP" 8080/tcp | head -1 | sed 's/.*://')"
BASE="http://127.0.0.1:${PORT}"

echo "== waiting for $BASE/health"
healthy=0
for _ in $(seq 1 60); do
  if curl -fsS "$BASE/health" >/dev/null 2>&1; then healthy=1; break; fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$APP")" != "true" ]; then break; fi
  sleep 1
done
[ "$healthy" = 1 ] || { echo "app never became healthy"; exit 1; }

# --- helpers ----------------------------------------------------------------
code()  { curl -s -o /dev/null -w '%{http_code}' "$@"; }
body()  { curl -s "$@"; }
jget()  { python3 -c 'import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1], {"d": d}))' "$1"; }
json_post() { # json_post <path> <token> <json>
  curl -s -X POST "$BASE$1" -H "Authorization: Bearer $2" -H 'Content-Type: application/json' -d "$3"
}
status_post() { # status_post <path> <token> <json>
  curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE$1" -H "Authorization: Bearer $2" -H 'Content-Type: application/json' -d "$3"
}

# --- 1. the SPA is served, including client-side routes ---------------------
echo "== SPA and routing (Caddy)"
for path in / /our-work /team /play /login /admin/dashboard /workshops/00000000-0000-0000-0000-000000000000; do
  check "GET $path serves the SPA shell" bash -c "[ \"\$(curl -s -o /tmp/smoke.html -w '%{http_code}' '$BASE$path')\" = 200 ] && grep -q 'id=\"root\"' /tmp/smoke.html"
done

asset="$(body "$BASE/" | grep -o '/assets/[^"]*\.js' | head -1 || true)"
check "hashed JS asset is served" bash -c "[ -n '$asset' ] && [ \"\$(curl -s -o /dev/null -w '%{http_code}' '$BASE$asset')\" = 200 ]"
check "hashed assets are cached as immutable" bash -c "curl -sI '$BASE$asset' | tr -d '\r' | grep -iq 'cache-control:.*immutable'"
check "index.html is never cached" bash -c "curl -sI '$BASE/' | tr -d '\r' | grep -iq 'cache-control:.*no-cache'"

# --- 2. migrations ran and the public API answers ---------------------------
echo "== public API"
check "GET /health" test "$(code "$BASE/health")" = 200
check "impact endpoint has the migrated schema" bash -c "curl -s '$BASE/api/v1/impact' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert \"workshops_held\" in d and \"tracks\" in d'"
check "GET /api/v1/team is a JSON array" bash -c "curl -s '$BASE/api/v1/team' | python3 -c 'import json,sys; assert isinstance(json.load(sys.stdin), list)'"
check "GET /api/v1/workshops is a JSON array" bash -c "curl -s '$BASE/api/v1/workshops' | python3 -c 'import json,sys; assert isinstance(json.load(sys.stdin), list)'"
check "unknown workshop id -> 404" test "$(code "$BASE/api/v1/workshops/11111111-1111-1111-1111-111111111111")" = 404
check "malformed workshop id -> 400" test "$(code "$BASE/api/v1/workshops/not-a-uuid")" = 400
check "unknown track filter -> 400" test "$(code "$BASE/api/v1/workshops/past?track=bogus")" = 400

# --- 3. authentication ------------------------------------------------------
echo "== auth"
check "wrong password is rejected" test "$(status_post /admin/login '' '{"username":"admin","password":"definitely-wrong"}')" = 401
check "admin routes need a token" test "$(status_post /api/v1/admin/team '' '{}')" = 401
TOKEN="$(json_post /admin/login '' '{"username":"admin","password":"Skillture@2025"}' | jget 'd["token"]' 2>/dev/null || true)"
check "seeded admin can sign in" test -n "$TOKEN"
[ -n "$TOKEN" ] || { echo "cannot continue without a token"; exit 1; }

# --- 4. content workflow: create -> public read -> validate -> delete -------
echo "== workshops and team (write path + validation)"
WS="$(json_post /api/v1/admin/workshops "$TOKEN" '{"title":{"en":"Smoke workshop","ar":"ورشة اختبار"},"description":{"en":"d","ar":"و"},"event_date":"2020-01-15","track":"technical","attendees":42,"outcome":{"en":"+30%","ar":"+٣٠٪"},"gallery":[]}' | jget 'd["id"]' 2>/dev/null || true)"
check "create a past workshop" test -n "$WS"
check "past workshop is listed publicly" bash -c "curl -s '$BASE/api/v1/workshops/past?track=technical' | grep -q '$WS'"
check "workshop detail has the outcome" bash -c "curl -s '$BASE/api/v1/workshops/$WS' | grep -q '+30%'"
check "impact counts the workshop and its attendees" bash -c "curl -s '$BASE/api/v1/impact' | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d[\"workshops_held\"]>=1 and d[\"attendees_total\"]>=42 and d[\"tracks\"][\"technical\"]>=1'"
check "rejects an unknown track" test "$(status_post /api/v1/admin/workshops "$TOKEN" '{"title":{"en":"t","ar":"ت"},"description":{"en":"d","ar":"و"},"event_date":"2020-01-15","track":"magic"}')" = 400
check "rejects a javascript: registration link" test "$(status_post /api/v1/admin/workshops "$TOKEN" '{"title":{"en":"t","ar":"ت"},"description":{"en":"d","ar":"و"},"event_date":"2030-01-15","registration_url":"javascript:alert(1)"}')" = 400
check "rejects a gallery path outside /uploads" test "$(status_post /api/v1/admin/workshops "$TOKEN" '{"title":{"en":"t","ar":"ت"},"description":{"en":"d","ar":"و"},"event_date":"2020-01-15","gallery":["../etc/passwd"]}')" = 400

MEMBER="$(json_post /api/v1/admin/team "$TOKEN" '{"name":{"en":"Smoke Person","ar":"شخص اختبار"},"role":{"en":"Tester","ar":"مختبر"},"group":"core"}' | jget 'd["id"]' 2>/dev/null || true)"
check "create a team member" test -n "$MEMBER"
check "team member is listed publicly" bash -c "curl -s '$BASE/api/v1/team' | grep -q '$MEMBER'"
check "rejects an unknown team group" test "$(status_post /api/v1/admin/team "$TOKEN" '{"name":{"en":"A","ar":"أ"},"role":{"en":"r","ar":"د"},"group":"boss"}')" = 400

# --- 5. uploads through the real proxy --------------------------------------
echo "== uploads"
python3 - <<'PY'
import base64
open('/tmp/smoke.png', 'wb').write(base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='))
PY
UP="$(curl -s -X POST "$BASE/api/v1/admin/team/image" -H "Authorization: Bearer $TOKEN" -F 'image=@/tmp/smoke.png;type=image/png' | jget 'd["file_path"]' 2>/dev/null || true)"
check "image upload is accepted" test -n "$UP"
check "uploaded image is served back with an image type" bash -c "curl -sI '$BASE$UP' | tr -d '\r' | grep -iq 'content-type: image/'"
check "a non-image upload is refused" test "$(printf 'not an image' > /tmp/smoke.txt; curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/admin/team/image" -H "Authorization: Bearer $TOKEN" -F 'image=@/tmp/smoke.txt;filename=x.png;type=image/png')" = 400

# --- 6. the live game, through the same proxy players use -------------------
# Plays a whole game (host + two players over WebSockets). This is where a
# WebSocket the proxy or the origin check refuses would show up: everything
# else can be green while no game can actually start.
echo "== live game (WebSocket)"
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$node_major" -ge 22 ]; then
  if node "$(dirname "$0")/game-smoke.mjs" "$BASE" > /tmp/game-smoke.out 2>&1; then
    ok "a full game plays end to end ($(grep -c 'ok' /tmp/game-smoke.out) checks)"
  else
    bad "a full game plays end to end"
    cat /tmp/game-smoke.out
  fi
elif [ -n "${REQUIRE_GAME_SMOKE:-}" ]; then
  bad "game smoke needs Node 22+ (found: $node_major)"
else
  echo "  skipped: needs Node 22+ (found: $node_major)"
fi

# --- 7. cleanup of what we created, and delete semantics --------------------
echo "== delete"
check "delete the workshop" test "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/v1/admin/workshops/$WS" -H "Authorization: Bearer $TOKEN")" = 200
check "deleted workshop is gone" test "$(code "$BASE/api/v1/workshops/$WS")" = 404
check "delete the team member" test "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/v1/admin/team/$MEMBER" -H "Authorization: Bearer $TOKEN")" = 200

# --- 8. production edge behaviour -------------------------------------------
# The smoke container runs with the default SITE_ADDRESS (plain :8080), so the
# domain/HTTPS path is never exercised live. These checks cover what can be
# checked without a public hostname.
echo "== edge (production Caddy config)"
check "Caddyfile is valid with a public SITE_ADDRESS" \
  docker run --rm -e SITE_ADDRESS="example.com, www.example.com" --entrypoint caddy "$IMAGE" \
    validate --config /etc/caddy/Caddyfile --adapter caddyfile
check "responses carry HSTS" bash -c "curl -sI '$BASE/' | tr -d '\r' | grep -iq '^strict-transport-security:'"
check "responses carry X-Content-Type-Options" bash -c "curl -sI '$BASE/' | tr -d '\r' | grep -iq '^x-content-type-options: nosniff'"
check "www.* redirects permanently to the bare domain, keeping path and query" \
  bash -c "curl -s -o /dev/null -D - -H 'Host: www.example.com' '$BASE/team?x=1' | tr -d '\r' | grep -iq '^location: http://example.com/team?x=1'"
check "bare domain is not redirected" test "$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: example.com' "$BASE/")" = 200

# --- 9. container hygiene ---------------------------------------------------
echo "== container"
check "runs as an unprivileged user" test "$(docker exec "$APP" id -u)" != 0
check "container is healthy per its own HEALTHCHECK" bash -c "for _ in \$(seq 1 30); do [ \"\$(docker inspect -f '{{.State.Health.Status}}' '$APP')\" = healthy ] && exit 0; sleep 2; done; exit 1"

echo
echo "smoke test: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
