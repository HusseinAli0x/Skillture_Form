import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Flame, X } from 'lucide-react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import client from '../api/client';
import { playerSocketUrl } from '../api/ws';
import LanguageSwitcher from '../components/LanguageSwitcher';
import AnswerShape from '../components/game/AnswerShape';
import CountUp from '../components/game/CountUp';
import MuteButton from '../components/game/MuteButton';
import PlayerAvatar from '../components/game/PlayerAvatar';
import TimerRing from '../components/game/TimerRing';
import type { PublicQuizQuestion, QuizPlayer } from '../api/types';
import { apiErrorStatus } from '../lib/apiError';
import { answerStyle } from '../lib/game/answers';
import { fireCelebration } from '../lib/game/confetti';
import { playerExtra, recallPlayer } from '../lib/game/playerStrings';
import { buzz, play } from '../lib/game/sound';
import { pick } from '../lib/game/strings';
import { useDeadline } from '../lib/game/useDeadline';
import { useGameLocale } from '../lib/game/useGameLocale';
import { useGameSocket } from '../lib/game/useGameSocket';
import { localized, optionLabel } from '../lib/i18n';

type Phase = 'waiting' | 'getready' | 'question' | 'locked' | 'result' | 'finished';
type ResultKind = 'correct' | 'wrong' | 'timeout' | 'unknown';

interface Option {
  id: string;
  value: string;
}

/** What POST /answer returns. Held back until the room's results arrive. */
interface Reply {
  is_correct: boolean;
  score_awarded: number;
  streak: number;
  streak_bonus: number;
  total_score: number;
  rank: number;
  players: number;
}

interface QuestionResults {
  question_id: string;
  correct_answer?: Record<string, unknown>;
  leaderboard?: QuizPlayer[];
}

interface ResultView {
  kind: ResultKind;
  headline: string;
  reply: Reply | null;
  correctText: string;
  board: QuizPlayer[];
}

const GET_READY_SECONDS = 3;

const parseOptions = (q: PublicQuizQuestion): Option[] =>
  Object.entries(q.options ?? {}).map(([id, opt]) => ({ id, value: optionLabel(opt as never, id) }));

const answerText = (answer?: Record<string, unknown>): string => {
  if (!answer) return '';
  const v = answer.value ?? answer.text;
  return v === undefined || v === null ? '' : String(v);
};

/** The route needs a player; without one there is nothing to show. */
const PlayerLiveBoard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const playerId = searchParams.get('playerId');
  if (!playerId) return <Navigate to="/play" replace />;
  return <Board playerId={playerId} />;
};

const Board: React.FC<{ playerId: string }> = ({ playerId }) => {
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, dir, G } = useGameLocale();
  const E = playerExtra[locale];
  const me = useMemo(() => recallPlayer(playerId), [playerId]);

  const [phase, setPhase] = useState<Phase>('waiting');
  const [question, setQuestion] = useState<PublicQuizQuestion | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [countdown, setCountdown] = useState(GET_READY_SECONDS);
  const [chosen, setChosen] = useState<{ index: number; text: string } | null>(null);
  const [shortText, setShortText] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState<ResultView | null>(null);
  const [finalBoard, setFinalBoard] = useState<QuizPlayer[]>([]);
  const [waitingIndex, setWaitingIndex] = useState(0);
  const [announce, setAnnounce] = useState('');

  // Refs hold what message handlers need to read *now*; state would be stale
  // inside a socket callback created on an earlier render.
  const phaseRef = useRef<Phase>('waiting');
  const questionRef = useRef<PublicQuizQuestion | null>(null);
  const answeredRef = useRef(false);
  const inFlightRef = useRef(false);
  const replyRef = useRef<Reply | null>(null);
  const stashedResultsRef = useRef<QuestionResults | null>(null);
  const lastBoardRef = useRef<QuizPlayer[]>([]);
  const answerStartRef = useRef(0);
  const chosenRef = useRef<{ index: number; text: string } | null>(null);
  const seenQuestionIds = useRef(new Set<string>());

  const goTo = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  // --- results -------------------------------------------------------------
  const showResult = useCallback(
    (results: QuestionResults | null, forced?: ResultKind) => {
      const reply = replyRef.current;
      const board = results?.leaderboard ?? lastBoardRef.current;
      let kind: ResultKind;
      if (forced) kind = forced;
      else if (reply) kind = reply.is_correct ? 'correct' : 'wrong';
      else kind = answeredRef.current ? 'unknown' : 'timeout';

      const pool = kind === 'correct' ? G.player.correctPool : kind === 'wrong' ? G.player.wrongPool : G.player.timeoutPool;
      const headline = kind === 'unknown' ? G.player.lockedIn : pick(pool);

      setResult({ kind, headline, reply, correctText: answerText(results?.correct_answer), board });
      setStreak(kind === 'correct' && reply ? reply.streak : 0);
      goTo('result');

      if (kind === 'correct') {
        play('correct');
        buzz([30, 40, 30]);
        if (reply && reply.streak >= 3) window.setTimeout(() => play('streak'), 450);
        setAnnounce(E.answerAnnounce.correct(reply?.score_awarded ?? 0));
      } else if (kind === 'wrong') {
        play('wrong');
        buzz(120);
        setAnnounce(E.answerAnnounce.wrong);
      } else if (kind === 'timeout') {
        play('wrong');
        buzz(80);
        setAnnounce(E.answerAnnounce.timeout);
      } else {
        play('reveal');
      }
    },
    [G.player, E.answerAnnounce, goTo]
  );

  // --- answering -----------------------------------------------------------
  const submit = useCallback(
    async (answer: Record<string, string>, index: number, text: string) => {
      const q = questionRef.current;
      if (!q || phaseRef.current !== 'question' || inFlightRef.current) return;

      inFlightRef.current = true;
      answeredRef.current = true;
      chosenRef.current = { index, text };
      setChosen({ index, text });
      setSubmitError('');
      goTo('locked');
      play('lock');
      setAnnounce(G.player.lockedIn);

      try {
        const res = await client.post<Reply>(`/api/v1/sessions/${sessionId}/answer`, {
          player_id: playerId,
          question_id: q.id,
          answer,
          time_taken_ms: Math.round(performance.now() - answerStartRef.current),
        });
        replyRef.current = res.data;
      } catch (err) {
        const status = apiErrorStatus(err);
        if (status === 409) {
          // Already answered (another tab or a double tap): stay locked in.
        } else if (status === 422) {
          // Too late: the question is closed. The room's results are coming.
          answeredRef.current = false;
          chosenRef.current = null;
          setChosen(null);
        } else {
          // Never stranded: let them try again while the question is open.
          answeredRef.current = false;
          chosenRef.current = null;
          setChosen(null);
          setSubmitError(E.sendFailed);
          inFlightRef.current = false;
          if ((phaseRef.current as Phase) === 'locked') goTo('question');
          return;
        }
      }
      inFlightRef.current = false;

      // The room's results may have landed while the request was in flight.
      if (stashedResultsRef.current) {
        const results = stashedResultsRef.current;
        stashedResultsRef.current = null;
        showResult(results);
      }
    },
    [G.player.lockedIn, E.sendFailed, goTo, playerId, sessionId, showResult]
  );

  const timeLimit = question && question.time_limit_sec > 0 ? question.time_limit_sec : null;
  const { remainingMs } = useDeadline(timeLimit, phase === 'question', () => {
    // Time ran out with no answer sent: show it locally; the room's results
    // fill in the rest when they arrive.
    if (phaseRef.current === 'question' && !answeredRef.current) showResult(null, 'timeout');
  });

  // --- incoming question ---------------------------------------------------
  const beginQuestion = useCallback(
    (q: PublicQuizQuestion) => {
      // The same question can arrive twice (a hand-over from the join screen,
      // then again after a reconnect). It must not undo a locked-in answer.
      if (seenQuestionIds.current.has(q.id)) return;
      seenQuestionIds.current.add(q.id);

      questionRef.current = q;
      answeredRef.current = false;
      inFlightRef.current = false;
      replyRef.current = null;
      stashedResultsRef.current = null;
      chosenRef.current = null;
      setQuestion(q);
      setOptions(parseOptions(q));
      setQuestionNumber(n => (typeof q.position === 'number' && q.position > 0 ? q.position : n + 1));
      setChosen(null);
      setShortText('');
      setSubmitError('');
      setResult(null);
      setCountdown(GET_READY_SECONDS);
      goTo('getready');
      play('whoosh');
      setAnnounce(E.newQuestion);
    },
    [E.newQuestion, goTo]
  );

  // Get-ready countdown: 3, 2, 1, then answers open.
  useEffect(() => {
    if (phase !== 'getready') return;
    let n = GET_READY_SECONDS;
    play('tick');
    const id = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(id);
        play('go');
        buzz(25);
        answerStartRef.current = performance.now();
        goTo('question');
      } else {
        setCountdown(n);
        play('tick');
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, question?.id, goTo]);

  // A question handed over from the join screen while navigating here.
  const handedOver = useRef(false);
  useEffect(() => {
    if (handedOver.current) return;
    handedOver.current = true;
    const state = location.state as { question?: PublicQuizQuestion } | null;
    if (state?.question?.id) beginQuestion(state.question);
  }, [location.state, beginQuestion]);

  // --- socket --------------------------------------------------------------
  const status = useGameSocket({
    enabled: !!sessionId,
    url: () => playerSocketUrl(sessionId, playerId),
    onMessage: msg => {
      switch (msg.type) {
        case 'question':
          beginQuestion(msg.payload as PublicQuizQuestion);
          break;
        case 'show_leaderboard':
          lastBoardRef.current = (msg.payload as QuizPlayer[]) ?? [];
          break;
        case 'question_results': {
          const results = msg.payload as QuestionResults;
          if (results.leaderboard) lastBoardRef.current = results.leaderboard;
          if (!questionRef.current || results.question_id !== questionRef.current.id) break; // a question we never saw
          if (phaseRef.current === 'result' || phaseRef.current === 'finished') {
            // Already showing a local timeout: fill in the answer and standings.
            setResult(prev =>
              prev ? { ...prev, correctText: answerText(results.correct_answer), board: results.leaderboard ?? prev.board } : prev
            );
            break;
          }
          if (inFlightRef.current) {
            stashedResultsRef.current = results; // apply once the reply is in
            break;
          }
          showResult(results);
          break;
        }
        case 'game_finished': {
          const board = (msg.payload as QuizPlayer[]) ?? lastBoardRef.current;
          setFinalBoard(board);
          goTo('finished');
          break;
        }
        // 'game_started', 'player_joined', 'answer_result' and 'leaderboard'
        // are lobby or host events; nothing to do here.
      }
    },
  });

  // Rotate the waiting line.
  useEffect(() => {
    if (phase !== 'waiting') return;
    const id = window.setInterval(() => setWaitingIndex(i => i + 1), 4000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Finish line: a podium finish earns a celebration.
  const myFinalIndex = finalBoard.findIndex(p => p.id === playerId);
  useEffect(() => {
    if (phase !== 'finished') return;
    if (myFinalIndex >= 0 && myFinalIndex < 3) {
      fireCelebration();
      play('win');
    } else {
      play('reveal');
    }
  }, [phase, myFinalIndex]);

  // --- derived -------------------------------------------------------------
  const myName = me?.name ?? '';
  const standings = useMemo(() => {
    const board = result?.board ?? [];
    const idx = board.findIndex(p => p.id === playerId);
    if (idx < 0) {
      const r = result?.reply;
      return r ? { rank: r.rank, total: r.players, score: r.total_score, line: '' } : null;
    }
    const mine = board[idx];
    let line = '';
    if (idx === 0) {
      line = board[1] ? G.player.ahead(mine.score - board[1].score, board[1].name) : G.player.youAreFirst;
      if (board[1] && mine.score - board[1].score === 0) line = G.player.youAreFirst;
    } else {
      line = G.player.behind(board[idx - 1].score - mine.score, board[idx - 1].name);
    }
    return { rank: idx + 1, total: board.length, score: mine.score, line };
  }, [result, playerId, G.player]);

  const backToJoin = () => navigate('/play');
  const lost = status === 'failed';

  // ------------------------------------------------------------------------
  const topBar = (
    <header className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <PlayerAvatar id={playerId} avatarId={me?.avatarId} avatarUrl={me?.avatarUrl} size={36} />
        <span className="font-semibold truncate max-w-[9rem]">{myName}</span>
      </div>
      <div className="flex items-center gap-2">
        {streak >= 2 && (
          <span className="game-pop inline-flex items-center gap-1 rounded-full bg-mark text-ink px-3 py-1 text-sm font-semibold" aria-label={G.player.streak(streak)}>
            <Flame className="w-4 h-4" />
            <span className="numeral">{streak}</span>
          </span>
        )}
        <LanguageSwitcher />
        <MuteButton />
      </div>
    </header>
  );

  const shell = (children: React.ReactNode, tone = '') => (
    <div className={`game flex flex-col ${tone}`} dir={dir}>
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
      {topBar}
      {status === 'reconnecting' && !lost && (
        <p className="text-center text-sm font-medium bg-mark text-ink py-1.5">{G.player.reconnecting}</p>
      )}
      {lost ? (
        <main className="flex-1 flex items-center justify-center p-6">
          <div role="alert" className="max-w-sm w-full text-center rounded-3xl bg-coral text-white p-6 space-y-4">
            <p className="text-lg font-semibold">{G.player.connectionLost}</p>
            <button type="button" onClick={backToJoin} className="min-h-12 px-6 rounded-xl bg-white text-ink font-semibold cursor-pointer">
              {G.player.rejoin}
            </button>
          </div>
        </main>
      ) : (
        children
      )}
    </div>
  );

  // --- waiting -------------------------------------------------------------
  if (phase === 'waiting') {
    return shell(
      <main className="flex-1 flex flex-col items-center justify-center text-center gap-6 px-6 pb-10">
        <PlayerAvatar id={playerId} avatarId={me?.avatarId} avatarUrl={me?.avatarUrl} size={120} className="game-float border-mark" />
        <h1 className="game-pop text-4xl font-semibold">{G.player.getReady}</h1>
        <p key={waitingIndex} className="game-rise text-lg text-muted max-w-xs text-pretty">
          {G.player.waitingPool[waitingIndex % G.player.waitingPool.length]}
        </p>
      </main>
    );
  }

  // --- get ready -----------------------------------------------------------
  if (phase === 'getready') {
    return shell(
      <main className="flex-1 flex flex-col items-center justify-center text-center gap-5 px-6 pb-10">
        <p className="text-xl font-semibold text-muted">{E.question(questionNumber)}</p>
        <div key={countdown} className="game-pop numeral text-[9rem] font-semibold text-mark leading-none" aria-hidden="true">
          {countdown}
        </div>
        <p className="text-2xl font-semibold">{G.player.getReady}</p>
      </main>
    );
  }

  // --- question / locked ---------------------------------------------------
  if ((phase === 'question' || phase === 'locked') && question) {
    const isShort = question.type === 'short';
    const open = phase === 'question';
    const text = localized(question.question, '', locale);
    const lockedStyle = chosen && !isShort ? answerStyle(chosen.index) : null;

    return shell(
      <main className="flex-1 flex flex-col gap-3 px-3 pb-3 min-h-0">
        <div className="flex items-center gap-3 rounded-2xl bg-panel px-3 py-2">
          {timeLimit !== null && open && <TimerRing remainingMs={remainingMs} totalMs={timeLimit * 1000} size={64} />}
          <p className="flex-1 text-lg short:text-base font-semibold leading-snug text-pretty">{text}</p>
        </div>

        {submitError && (
          <p role="alert" className="game-shake text-center rounded-xl bg-coral text-white px-3 py-2 font-medium">
            {submitError}
          </p>
        )}

        {phase === 'locked' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            {lockedStyle && (
              <div className={`game-pop w-40 h-40 rounded-3xl flex items-center justify-center ${lockedStyle.bg.split(' ')[0]} ${lockedStyle.text}`}>
                <AnswerShape shape={lockedStyle.shape} className="w-20 h-20" />
              </div>
            )}
            {chosen && (
              <p className="text-2xl font-semibold break-words max-w-xs">
                <span className="sr-only">{E.yourAnswer}: </span>
                {chosen.text}
              </p>
            )}
            <h2 className="game-pop text-3xl font-semibold text-mark">{G.player.lockedIn}</h2>
            <p className="text-muted text-lg">{G.player.lockedInPool[(questionNumber + (chosen?.index ?? 0)) % G.player.lockedInPool.length]}</p>
          </div>
        ) : isShort ? (
          <form
            className="flex-1 flex flex-col justify-center gap-4"
            onSubmit={e => {
              e.preventDefault();
              const t = shortText.trim();
              if (t) void submit({ text: t }, 0, t);
            }}
          >
            <label htmlFor="short-answer" className="text-lg font-semibold text-muted text-center">
              {G.player.typeAnswer}
            </label>
            <input
              id="short-answer"
              type="text"
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              value={shortText}
              onChange={e => setShortText(e.target.value)}
              className="w-full rounded-2xl bg-panel border-2 border-border-strong px-4 py-5 text-center text-2xl font-semibold focus:outline-none focus:border-mark"
            />
            <button
              type="submit"
              disabled={!shortText.trim()}
              className="min-h-16 rounded-2xl bg-mark text-ink text-2xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform cursor-pointer"
            >
              {G.player.send}
            </button>
          </form>
        ) : (
          <div
            className={`flex-1 grid gap-3 auto-rows-fr min-h-0 ${
              options.length > 2 ? 'grid-cols-2' : 'grid-cols-1 short:grid-cols-2'
            }`}
          >
            {options.map((opt, i) => {
              const st = answerStyle(i);
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!open}
                  aria-label={`${st.label}: ${opt.value}`}
                  onClick={() => {
                    buzz(20);
                    void submit({ value: opt.value }, i, opt.value);
                  }}
                  className={`min-h-[4.5rem] rounded-3xl px-3 py-3 flex flex-col items-center justify-center gap-2 text-center shadow-lg transition-transform active:scale-95 cursor-pointer ${st.bg} ${st.text}`}
                >
                  <AnswerShape shape={st.shape} className="w-[clamp(2rem,6.5vw,4.5rem)] h-[clamp(2rem,6.5vw,4.5rem)] short:w-7 short:h-7 opacity-90" />
                  <span className="text-[clamp(1.25rem,4.6vw,3rem)] short:text-lg font-semibold leading-tight break-words max-w-full">{opt.value}</span>
                </button>
              );
            })}
          </div>
        )}
      </main>
    );
  }

  // --- result --------------------------------------------------------------
  if (phase === 'result' && result) {
    const tone =
      result.kind === 'correct' ? 'bg-leaf text-ink' : result.kind === 'wrong' ? 'bg-coral text-white' : 'bg-panel-3 text-white';
    const Icon = result.kind === 'correct' ? Check : result.kind === 'timeout' ? Clock : X;
    return shell(
      <main className={`flex-1 flex flex-col items-center justify-between gap-4 px-5 pb-6 pt-2 text-center ${tone}`}>
        <div className={`flex-1 flex flex-col items-center justify-center gap-3 ${result.kind === 'wrong' ? 'game-shake' : 'game-pop'}`}>
          {result.kind !== 'unknown' && <Icon className="w-24 h-24 short:w-14 short:h-14" strokeWidth={3} aria-hidden="true" />}
          <h1 className="text-4xl short:text-3xl font-semibold text-balance">{result.headline}</h1>

          {result.kind === 'correct' && result.reply && (
            <div className="space-y-2">
              <p className="text-5xl font-semibold">
                +<CountUp to={result.reply.score_awarded} />
              </p>
              {result.reply.streak >= 2 && (
                <p className="inline-flex items-center gap-2 rounded-full bg-black/20 px-4 py-1.5 font-semibold">
                  <Flame className="w-5 h-5" aria-hidden="true" />
                  {G.player.streak(result.reply.streak)}
                  {result.reply.streak_bonus > 0 && <span className="opacity-90">· {G.player.streakBonus(result.reply.streak_bonus)}</span>}
                </p>
              )}
            </div>
          )}

          {result.kind !== 'correct' && result.correctText && (
            <p className="rounded-2xl bg-black/20 px-4 py-2 text-lg max-w-xs break-words">
              {E.theAnswerWas}: <strong>{result.correctText}</strong>
            </p>
          )}
        </div>

        {standings && (
          <div className="w-full max-w-sm rounded-3xl bg-black/25 px-4 py-3 space-y-1">
            <p className="text-xl font-semibold">{G.player.yourPlace(standings.rank, standings.total)}</p>
            {standings.line && <p className="text-base opacity-90">{standings.line}</p>}
            <p className="text-sm opacity-80">
              {E.totalScore}: <span className="numeral font-semibold">{standings.score.toLocaleString('en-US')}</span>
            </p>
          </div>
        )}
      </main>
    );
  }

  // --- finished ------------------------------------------------------------
  if (phase === 'finished') {
    const place = myFinalIndex + 1;
    const top = finalBoard.slice(0, 3);
    return shell(
      <main className="flex-1 flex flex-col items-center justify-center gap-5 px-5 pb-10 text-center">
        <h1 className="game-pop text-4xl font-semibold">{G.player.gameOver}</h1>
        {place > 0 && <p className="game-pop text-2xl font-semibold text-mark">{G.player.finalPlace(place)}</p>}
        {place > 0 && place <= 3 && <p className="text-lg text-muted">{pick(G.player.podiumLine)}</p>}

        <ol className="w-full max-w-sm space-y-2">
          {top.map((p, i) => (
            <li
              key={p.id}
              className={`game-rise flex items-center gap-3 rounded-2xl px-3 py-2 ${p.id === playerId ? 'bg-mark text-ink' : 'bg-panel'}`}
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <span className="numeral w-6 text-xl font-semibold">{i + 1}</span>
              <PlayerAvatar id={p.id} avatarId={p.avatar_id} avatarUrl={p.avatar_url} size={36} />
              <span className="flex-1 text-start font-semibold truncate">{p.name}</span>
              <span className="numeral font-semibold">{p.score.toLocaleString('en-US')}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={backToJoin}
          className="w-full max-w-sm min-h-14 rounded-2xl bg-mark text-ink text-xl font-semibold active:scale-[0.98] transition-transform cursor-pointer"
        >
          {G.player.playAgain}
        </button>
      </main>
    );
  }

  // A state we should not be in (e.g. result with no data): never leave a blank screen.
  return shell(
    <main className="flex-1 flex items-center justify-center px-6">
      <p className="text-lg text-muted">{G.player.getReady}</p>
    </main>
  );
};

export default PlayerLiveBoard;
