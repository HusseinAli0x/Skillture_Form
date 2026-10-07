# The live quiz game

A host runs a quiz on a big screen; players join from their phones with a PIN.
This is how it works end to end, and the rules the code (and the CI smoke test)
hold it to.

## Flow

1. **Host** — anyone, no account — opens *Host a game* (`/create`), builds a
   quiz and presses Host → a lobby with a giant PIN, a QR code and the players
   as they arrive. (Admins can do the same from *Quiz Game* in the dashboard.)
2. **Players** go to `/play` (or scan the QR), type the PIN, pick a name and
   badge (or press the dice for a silly one) and wait.
3. **One click starts it.** *Start game* starts the session and puts question 1
   live; there is no second "start quiz" step.
4. Each question: a 3-second *get ready* countdown on every screen, then
   answers open for the question's time limit. It ends when the timer runs out,
   when everyone has answered, or when the host skips (Space).
5. **Results** (host): the correct answer, how the room voted, a funny line.
   **Scoreboard**: top 5 with rank changes. Then the next question.
6. **Finish**: podium and confetti on the host, "you finished 3rd" and the top
   three on every phone.

Players can join a game already in progress; they wait for the next question.

## Scoring

- Correct answer: `points × (0.5 + 0.5 × speed)`, where speed is how early in
  the time limit the answer arrived. The server clamps the client-reported time.
- **Streak bonus**: each correct answer in a row adds 10% of that answer's
  points, up to +50%. A wrong answer or a skipped question resets it.
- Short answers ignore case and extra spaces and work in Arabic.
- Submitting an answer is **idempotent**: sending it again (a double tap, a lost
  reply) returns the original result and never scores twice.

## Messages (server → client, over WebSocket)

| Type | To | Meaning |
|---|---|---|
| `lobby_snapshot` | a joining player | current status and who is connected |
| `player_joined` | everyone else | someone arrived (name, avatar) |
| `game_started` | everyone | session left the lobby |
| `question` | everyone | a question is live; **never contains the answer** |
| `answer_result` | everyone | someone answered (`player_id`), used to count |
| `leaderboard` | everyone | live scores after each answer |
| `question_results` | everyone | correct answer, vote split and leaderboard; closes the question |
| `game_finished` | everyone | final leaderboard |

The host socket needs a one-time ticket (`?ticket=`, see below). A player socket
needs the player's `player_id` **and the secret** they were given when they
joined (`?secret=`). A browser's `Origin` must be listed in
`CORS_ALLOWED_ORIGINS` **or be the same host the page was served from**, so a
LAN address in development and the real domain in production just work.

## Who can host

Nobody needs an account to create and host a game. Instead, each browser makes a
long random **host key** the first time it is used, keeps it in local storage
(`skillture.hostKey`) and sends it as the `X-Host-Key` header. The server stores
only its SHA-256 hash, on the quizzes that browser creates (`quizzes.owner_key_hash`).

- A visitor sees, edits, hosts and deletes **only the quizzes made with their
  own key**. Anything else — another visitor's quiz, an admin's quiz, a session
  of either — answers `404`, exactly as if it did not exist
  (`handlers.QuizAccess`, covered by `quiz_access_integration_test.go`).
- Admins (bearer token) keep full control of every quiz and session; the admin
  list marks the ones that came from the public site (`by_visitor`).
- Games therefore live in the browser that made them. Clearing site data loses
  access to them. Visitor quizzes that were never hosted again are deleted after
  about six months so public hosting cannot grow the database without bound.
- Limits keep it from being abused as free storage: 30 games per browser,
  100 questions per game, and per-IP rate limits on creating games (20/hour),
  sessions (30/hour) and saving questions (120 per 10 minutes). A classroom
  behind one address is comfortably inside them.

**The host WebSocket** cannot carry an `Authorization` header, and a URL ends up
in logs, so it never carries a long-lived secret. The host first calls
`POST /api/v1/sessions/:id/ws-ticket` (authenticated by header) and connects
with the returned ticket: single-use, valid for 60 seconds, bound to that
session. Reconnects ask for a fresh one.

**PINs** are unique only among games that can still be joined (a partial unique
index, migration `0008`), so finished games do not use up the six-digit space;
a rare collision is retried.

## Players cannot act for each other

A player id is not secret — the public leaderboard lists every player's id. So the
id alone proves nothing. Joining returns a random **secret** once (only its SHA-256
is stored, `quiz_players.secret_hash`); answering (`POST …/answer`) and opening the
player socket both require it, and it never appears in a leaderboard or broadcast.
Without it, a student in the room could answer wrongly on everyone else's behalf.
The browser keeps it in `sessionStorage` for that tab.

What a joining player may send is bounded too, because it is stored and shown on
every screen: a name of at most 24 characters, an avatar that is a small inline
`data:image/(png|jpeg|webp|gif)` (never a remote URL, which every viewer's browser
would fetch), and at most 200 players per game.

## Things that are easy to get wrong

- **A background tab does not run animation frames.** The question timer is
  driven by a real timeout (`lib/game/useDeadline.ts`), not `requestAnimationFrame`,
  so a host who switches windows still ends the question on time.
- **`localhost` links don't work on phones.** The lobby detects this, asks the
  server for the machine's network address (`GET /api/v1/server-info`) and
  offers to switch the link and QR to it.
- **Two dev servers on one port** make requests land on the wrong backend (and
  a 401 from the wrong one logs you out). Check `lsof -iTCP:8090`.
- Answer colours and shapes are fixed constants (`lib/game/answers.ts`): players
  recognise an answer by them on both screens, and shapes carry the meaning for
  colour-blind players.

## Testing

`node scripts/game-smoke.mjs <base-url>` plays a whole game (host + two players
over real WebSockets, including the origin and ticket rules) and checks that a
visitor can host with only a host key while another visitor cannot touch it. CI runs it against the
production Docker image through Caddy; `make smoke` does the same locally.
