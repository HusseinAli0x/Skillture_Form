// Plays a complete live game against a running instance — host and two players
// over real WebSockets — and checks the rules that make it a game: the socket
// handshake, joining, starting, scoring, streaks, short answers, results and
// the final leaderboard. Needs Node 22+ (global WebSocket and fetch).
//
//   node scripts/game-smoke.mjs http://127.0.0.1:8080
//
// Exit code 0 when everything passes. Used by scripts/ci-smoke.sh, so the game
// is exercised through the same Caddy proxy production uses.
import http from 'node:http';
import crypto from 'node:crypto';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const WS = BASE.replace(/^http/, 'ws');
const ORIGIN = new URL(BASE).origin;

let failures = 0;
const ok = (cond, message) => {
  if (!cond) failures++;
  console.log(`  ${cond ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${message}`);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Some endpoints (204) have no body.
  }
  return { status: res.status, data };
}

// A raw WebSocket handshake so we can choose the Origin header, which the
// global WebSocket does not let us set. Resolves with the HTTP status the
// server answered with: 101 = upgraded, 403 = rejected.
function handshake(path, origin) {
  return new Promise(resolve => {
    const url = new URL(BASE + path);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        ...(origin ? { Origin: origin } : {}),
      },
    });
    req.on('upgrade', (res, socket) => {
      socket.destroy();
      resolve(res.statusCode);
    });
    req.on('response', res => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(0));
    req.end();
  });
}

function connect(path, bucket) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS + path);
    ws.onmessage = e => bucket.push(JSON.parse(e.data));
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error(`WebSocket failed: ${path}`));
  });
}

const login = await api('POST', '/admin/login', { username: 'admin', password: 'Skillture@2025' });
const token = login.data?.token;
ok(Boolean(token), 'host signs in');
if (!token) process.exit(1);

// ---- build a quiz: choice, true/false, and a short answer -------------------
const quiz = await api('POST', '/api/v1/quizzes', { title: { en: 'Game smoke' }, description: { en: 'tmp' } }, token);
const questions = (
  await api(
    'PUT',
    `/api/v1/quizzes/${quiz.data.id}/questions`,
    {
      questions: [
        { question: { en: '2 + 2?' }, type: 'mcq', time_limit_sec: 10, points: 1000, options: { a: { value: '3' }, b: { value: '4' } }, correct_answer: { value: '4' } },
        { question: { en: 'The sky is green' }, type: 'tf', time_limit_sec: 10, points: 500, options: { t: { value: 'True' }, f: { value: 'False' } }, correct_answer: { value: 'False' } },
        { question: { en: 'Capital of Egypt?' }, type: 'short', time_limit_sec: 10, points: 800, options: {}, correct_answer: { value: 'Cairo' } },
      ],
    },
    token,
  )
).data;
ok((await api('PATCH', `/api/v1/quizzes/${quiz.data.id}/activate`, undefined, token)).status === 200, 'quiz activates');
const session = (await api('POST', `/api/v1/quizzes/${quiz.data.id}/sessions`, undefined, token)).data;
ok(/^\d{6}$/.test(session.pin), `session has a 6-digit PIN (${session.pin})`);
ok((await api('GET', `/api/v1/sessions/pin/${session.pin}`)).data?.id === session.id, 'players can find the game by PIN');

// ---- the WebSocket handshake: the thing that was silently broken ------------
const hostPath = `/ws/sessions/${session.id}/host?token=${token}`;
ok((await handshake(hostPath, ORIGIN)) === 101, 'host socket accepts the page\'s own origin');
ok((await handshake(hostPath, undefined)) === 101, 'host socket accepts a non-browser client');
ok((await handshake(hostPath, 'https://evil.example')) === 403, 'host socket rejects a foreign origin');
ok((await handshake(`/ws/sessions/${session.id}/host?token=nope`, ORIGIN)) === 401, 'host socket needs a valid token');

// ---- lobby ------------------------------------------------------------------
const hostMsgs = [];
const host = await connect(`/ws/sessions/${session.id}/host?token=${token}`, hostMsgs);
const players = {};
for (const name of ['Ann', 'Bob']) {
  const joined = await api('POST', `/api/v1/sessions/${session.id}/players`, { name, avatar_id: 1 });
  ok(joined.status === 201, `${name} joins`);
  const msgs = [];
  const ws = await connect(`/ws/sessions/${session.id}/join?player_id=${joined.data.id}`, msgs);
  players[name] = { id: joined.data.id, msgs, ws };
}
ok((await api('POST', `/api/v1/sessions/${session.id}/players`, { name: 'Ann' })).status === 409, 'duplicate nickname is refused');
await sleep(300);
ok(hostMsgs.filter(m => m.type === 'player_joined').length === 2, 'host sees both players arrive');
ok(players.Ann.msgs.some(m => m.type === 'lobby_snapshot'), 'a joining player gets a lobby snapshot');

// ---- play -------------------------------------------------------------------
ok((await api('PATCH', `/api/v1/sessions/${session.id}/start`, undefined, token)).status === 200, 'host starts the game');
await sleep(200);
ok(players.Bob.msgs.some(m => m.type === 'game_started'), 'players are told the game started');

async function round(index, annAnswer, bobAnswer) {
  const q = questions[index];
  const adv = await api('PATCH', `/api/v1/sessions/${session.id}/advance`, { question_id: q.id }, token);
  ok(adv.status === 200, `question ${index + 1} goes live`);
  const a = await api('POST', `/api/v1/sessions/${session.id}/answer`, { player_id: players.Ann.id, question_id: q.id, answer: annAnswer, time_taken_ms: 1000 });
  const b = await api('POST', `/api/v1/sessions/${session.id}/answer`, { player_id: players.Bob.id, question_id: q.id, answer: bobAnswer, time_taken_ms: 4000 });
  const results = await api('POST', `/api/v1/sessions/${session.id}/show_results`, undefined, token);
  return { a: a.data, b: b.data, results: results.data?.results };
}

const q1 = await round(0, { value: '4' }, { value: '3' });
ok(q1.a?.is_correct && q1.a.rank === 1 && q1.a.streak === 1, 'Q1: right answer scores and ranks first');
ok(q1.b?.is_correct === false && q1.b.streak === 0, 'Q1: wrong answer scores nothing');
ok(q1.a.score_awarded > q1.b.score_awarded, 'Q1: points are higher for the right answer');
ok(q1.results?.correct_answer?.value === '4' && q1.results.distribution['4'] === 1 && q1.results.distribution['3'] === 1, 'Q1: results show the right answer and the vote split');

const q2 = await round(1, { value: 'False' }, { value: 'False' });
ok(q2.a?.streak === 2 && q2.a.streak_bonus > 0, 'Q2: a second correct answer in a row earns a streak bonus');
ok(q2.b?.streak === 1 && q2.b.streak_bonus === 0, 'Q2: Bob starts a new streak');

const q3 = await round(2, { text: '  cairo ' }, { text: 'Alexandria' });
ok(q3.a?.is_correct === true, 'Q3: a short answer scores, ignoring case and spaces');
ok(q3.b?.is_correct === false, 'Q3: a wrong short answer does not');
ok(q3.a.streak === 3, 'Q3: Ann is on a 3-answer streak');

// Submitting is idempotent: a retry (lost reply, double tap) returns the
// original result and scores nothing twice.
const before = (await api('GET', `/api/v1/sessions/${session.id}/leaderboard`)).data.find(p => p.name === 'Ann').score;
const dup = await api('POST', `/api/v1/sessions/${session.id}/answer`, { player_id: players.Ann.id, question_id: questions[2].id, answer: { text: 'Cairo' }, time_taken_ms: 1 });
const after = (await api('GET', `/api/v1/sessions/${session.id}/leaderboard`)).data.find(p => p.name === 'Ann').score;
ok(dup.status === 200 && dup.data.already_answered === true, 'answering twice returns the original result instead of an error');
ok(dup.data.is_correct === true && dup.data.score_awarded === q3.a.score_awarded && dup.data.streak === 3, 'the repeat reports the same result and streak');
ok(before === after, 'a repeated answer is never scored twice');
const stale = await api('POST', `/api/v1/sessions/${session.id}/answer`, { player_id: players.Bob.id, question_id: questions[0].id, answer: { value: '4' }, time_taken_ms: 1 });
ok(stale.status === 422, 'answering a question that is no longer live is refused');

await sleep(300);
ok(hostMsgs.some(m => m.type === 'question_results'), 'host receives the results broadcast');
ok(players.Ann.msgs.some(m => m.type === 'question_results'), 'players receive the results broadcast');
ok(players.Ann.msgs.filter(m => m.type === 'question').every(m => m.payload && !('correct_answer' in m.payload)), 'players are never sent the correct answer with a question');

// ---- the end ----------------------------------------------------------------
const fin = await api('PATCH', `/api/v1/sessions/${session.id}/finish`, undefined, token);
ok(fin.status === 200 && fin.data.leaderboard?.[0]?.name === 'Ann', 'game finishes with Ann on top');
await sleep(200);
ok(players.Bob.msgs.some(m => m.type === 'game_finished'), 'players are told the game is over');
ok((await api('POST', `/api/v1/sessions/${session.id}/players`, { name: 'Late' })).status === 422, 'nobody can join a finished game');

host.close();
Object.values(players).forEach(p => p.ws.close());
await api('DELETE', `/api/v1/quizzes/${quiz.data.id}`, undefined, token);

console.log(failures === 0 ? '\ngame smoke: all passed' : `\ngame smoke: ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
