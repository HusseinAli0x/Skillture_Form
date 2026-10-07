# The live quiz game

A host runs a quiz on a big screen; players join from their phones with a PIN.
This is how it works end to end, and the rules the code (and the CI smoke test)
hold it to.

## Flow

1. **Host** opens *Quiz Game*, presses Host on an active quiz → a lobby with a
   giant PIN, a QR code and the players as they arrive.
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

The host socket needs the admin token (`?token=`); player sockets need a valid
`player_id` for that session. A browser's `Origin` must be listed in
`CORS_ALLOWED_ORIGINS` **or be the same host the page was served from**, so a
LAN address in development and the real domain in production just work.

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
over real WebSockets, including the origin rules). CI runs it against the
production Docker image through Caddy; `make smoke` does the same locally.
