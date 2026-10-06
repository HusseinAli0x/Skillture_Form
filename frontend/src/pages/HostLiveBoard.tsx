import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Flag, Play, RotateCw, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import client from '../api/client';
import { apiErrorMessage } from '../lib/apiError';
import type { GameMessage, Quiz, QuestionResults, QuizPlayer, QuizQuestion, QuizSession } from '../api/types';
import { hostSocketUrl } from '../api/ws';
import { localized } from '../lib/i18n';
import { Button, ConfirmDialog } from '../components/ui';
import GameShell, { ConnectionChip, LiveBadge } from '../components/game/GameShell';
import AnswerTile, { Shape } from '../components/game/AnswerTile';
import Countdown from '../components/game/Countdown';
import Leaderboard from '../components/game/Leaderboard';
import Podium from '../components/game/Podium';
import Avatar from '../components/game/Avatar';
import { useNow } from '../components/game/hooks';
import { useGameSocket } from '../components/game/useGameSocket';
import { answerStyle, correctAnswerText, parseOptions, resultBars, secondsLeft } from '../components/game/gameLogic';
import { useDocumentTitle } from '../lib/useDocumentTitle';

type View = 'loading' | 'ready' | 'question' | 'results' | 'leaderboard' | 'finished';

const INTERACTIVE = new Set(['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A']);
/** Seconds of "get ready" between pressing Start in the lobby and the first question. */
const READY_SECONDS = 3;
/** Pause after the last answer lands before results are shown by themselves. */
const ALL_IN_DELAY_MS = 900;

const HostLiveBoard: React.FC = () => {
  useDocumentTitle('Live game');
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [view, setView] = useState<View>('loading');
  const [session, setSession] = useState<QuizSession | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(-1);
  const [roster, setRoster] = useState<QuizPlayer[]>([]);
  const [board, setBoard] = useState<QuizPlayer[]>([]);
  const [prevBoard, setPrevBoard] = useState<QuizPlayer[] | undefined>(undefined);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<QuestionResults | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [readyLeft, setReadyLeft] = useState(READY_SECONDS);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const busyRef = useRef(false);
  const boardRef = useRef<QuizPlayer[]>([]);
  boardRef.current = board;
  const viewRef = useRef<View>('loading');
  viewRef.current = view;
  const indexRef = useRef(-1);
  indexRef.current = index;
  const questionsRef = useRef<QuizQuestion[]>([]);
  questionsRef.current = questions;

  const q = questions[index];
  const last = index >= 0 && index === questions.length - 1;

  /** Runs one host action at a time; a held Space or a double click must not fire twice. */
  const guarded = useCallback(async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(apiErrorMessage(err, 'That did not work. Check the connection and try again.'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const loadRoster = useCallback(() => {
    client
      .get<QuizPlayer[]>(`/api/v1/sessions/${sessionId}/leaderboard`)
      .then(res => {
        const list = res.data || [];
        setRoster(list);
        setBoard(prev => (prev.length ? prev : list));
      })
      .catch(console.error);
  }, [sessionId]);

  // Initial load: session, quiz, questions, roster.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const sRes = await client.get<QuizSession>(`/api/v1/sessions/${sessionId}`);
        if (cancelled) return;
        setSession(sRes.data);
        const [qsRes, quizRes] = await Promise.all([
          client.get<QuizQuestion[]>(`/api/v1/quizzes/${sRes.data.quiz_id}/questions`),
          client.get<Quiz>(`/api/v1/quizzes/${sRes.data.quiz_id}`).catch(() => null),
        ]);
        if (cancelled) return;
        const sorted = (qsRes.data || []).slice().sort((a, b) => a.position - b.position);
        setQuestions(sorted);
        if (quizRes) setQuizTitle(localized(quizRes.data.title));
        loadRoster();

        if (sRes.data.status === 'finished') {
          const lb = await client.get<QuizPlayer[]>(`/api/v1/sessions/${sessionId}/leaderboard`);
          if (!cancelled) {
            setBoard(lb.data || []);
            setView('finished');
          }
        } else if (sRes.data.status === 'lobby') {
          navigate(`/host/lobby/${sessionId}`, { replace: true });
        } else if (sRes.data.current_question_id) {
          // Reloaded mid-question: resume on it. The timer restarts, the votes
          // so far are not recoverable, but nobody is stranded.
          const i = sorted.findIndex(x => x.id === sRes.data.current_question_id);
          setIndex(i);
          setStartedAt(Date.now());
          setView(i >= 0 ? 'question' : 'ready');
        } else {
          setView('ready');
        }
      } catch {
        if (!cancelled) setError("Couldn't load this game. It may have ended.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate, loadRoster]);

  const onMessage = useCallback(
    (msg: GameMessage) => {
      switch (msg.type) {
        case 'player_joined': {
          const p = msg.payload;
          setRoster(prev =>
            prev.some(x => x.id === p.player_id)
              ? prev
              : [
                  ...prev,
                  {
                    id: p.player_id,
                    session_id: sessionId ?? '',
                    name: p.name || 'New player',
                    score: 0,
                    joined_at: new Date().toISOString(),
                    avatar_id: p.avatar_id ?? undefined,
                    avatar_url: p.avatar_url ?? undefined,
                  },
                ]
          );
          break;
        }
        case 'answer_result':
          setAnsweredIds(prev => new Set(prev).add(msg.payload.player_id));
          break;
        case 'leaderboard':
          if (msg.payload) setBoard(msg.payload);
          break;
      }
    },
    [sessionId]
  );
  const status = useGameSocket(sessionId ? () => hostSocketUrl(sessionId) : null, onMessage, loadRoster);

  // --- Host actions -------------------------------------------------------

  const advanceTo = useCallback(
    (i: number) =>
      guarded(async () => {
        const target = questionsRef.current[i];
        if (!target) return;
        await client.patch(`/api/v1/sessions/${sessionId}/advance`, { question_id: target.id });
        setPrevBoard(boardRef.current);
        setIndex(i);
        setAnsweredIds(new Set());
        setResults(null);
        setStartedAt(Date.now());
        setView('question');
      }),
    [guarded, sessionId]
  );

  const showResults = useCallback(
    () =>
      guarded(async () => {
        if (viewRef.current !== 'question') return;
        const res = await client.post<{ leaderboard?: QuizPlayer[]; results?: QuestionResults }>(
          `/api/v1/sessions/${sessionId}/show_results`
        );
        if (res.data.leaderboard) setBoard(res.data.leaderboard);
        setResults(res.data.results ?? null);
        setView('results');
      }),
    [guarded, sessionId]
  );

  const finishGame = useCallback(
    () =>
      guarded(async () => {
        const res = await client.patch<{ leaderboard?: QuizPlayer[] }>(`/api/v1/sessions/${sessionId}/finish`);
        if (res.data.leaderboard) setBoard(res.data.leaderboard);
        setConfirmEnd(false);
        setView('finished');
      }),
    [guarded, sessionId]
  );

  /** The one thing Space / Enter / the big button does, depending on where the game is. */
  const primary = useMemo(() => {
    switch (view) {
      case 'ready':
        return { label: 'Start now', run: () => advanceTo(0) };
      case 'question':
        return { label: 'Show results', run: showResults };
      case 'results':
        return { label: 'Leaderboard', run: () => guarded(async () => setView('leaderboard')) };
      case 'leaderboard':
        return last
          ? { label: 'Finish game', run: finishGame }
          : { label: 'Next question', run: () => advanceTo(index + 1) };
      default:
        return null;
    }
  }, [view, last, index, advanceTo, showResults, finishGame, guarded]);

  const primaryRef = useRef(primary);
  primaryRef.current = primary;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (INTERACTIVE.has(t.tagName) || t.isContentEditable)) return;
      if (confirmEnd || !primaryRef.current) return;
      e.preventDefault();
      primaryRef.current.run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmEnd]);

  // "Get ready" countdown into question 1.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (view !== 'ready') return;
    if (readyLeft <= 0) {
      if (!autoStarted.current) {
        autoStarted.current = true;
        advanceTo(0);
      }
      return;
    }
    const t = setTimeout(() => setReadyLeft(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [view, readyLeft, advanceTo]);

  // Timer: results appear on their own when time runs out or everyone has answered.
  const now = useNow(250, view === 'question');
  const left = q ? secondsLeft(q.time_limit_sec, startedAt, now) : null;
  useEffect(() => {
    if (view === 'question' && left === 0) showResults();
  }, [view, left, showResults]);

  const everyoneIn = view === 'question' && roster.length > 0 && answeredIds.size >= roster.length;
  useEffect(() => {
    if (!everyoneIn) return;
    const t = setTimeout(showResults, ALL_IN_DELAY_MS);
    return () => clearTimeout(t);
  }, [everyoneIn, showResults]);

  const startAnotherGame = () =>
    guarded(async () => {
      if (!session) return;
      const res = await client.post(`/api/v1/quizzes/${session.quiz_id}/sessions`);
      navigate(`/host/lobby/${res.data.id}`);
    });

  // --- Render -------------------------------------------------------------

  const options = useMemo(() => parseOptions(q?.options), [q]);
  const correct = correctAnswerText(results?.correct_answer ?? q?.correct_answer);
  const bars = useMemo(
    () => (q ? resultBars(options, results?.distribution, results?.correct_answer ?? q.correct_answer, results?.answered ?? answeredIds.size) : []),
    [q, options, results, answeredIds.size]
  );
  const answered = results?.answered ?? answeredIds.size;
  const rightCount = bars.filter(b => b.isCorrect).reduce((n, b) => n + b.count, 0);

  if (view === 'loading') {
    return (
      <GameShell pattern="off" title="Skillture Quiz">
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          {error ? (
            <div role="alert">
              <p className="text-xl text-danger">{error}</p>
              <Button className="mt-5" variant="secondary" onClick={() => navigate('/admin/quizzes')}>
                Back to quizzes
              </Button>
            </div>
          ) : (
            <p className="text-muted">Loading the game…</p>
          )}
        </div>
      </GameShell>
    );
  }

  const inGame = view === 'question' || view === 'results' || view === 'leaderboard';

  return (
    <GameShell
      pattern="faint"
      title={quizTitle || 'Skillture Quiz'}
      status={status}
      right={
        <div className="flex items-center gap-3">
          {inGame && <LiveBadge />}
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 text-sm font-medium">
            <Users className="h-4 w-4 text-muted" aria-hidden="true" />
            {roster.length}
          </span>
          <ConnectionChip status={status} />
          {view !== 'finished' && (
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Flag className="h-4 w-4" aria-hidden="true" /> End game
            </button>
          )}
        </div>
      }
    >
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-4 sm:px-6" aria-live="polite">
        {error && (
          <div role="alert" className="mb-3 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {view === 'ready' && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted">First question in</p>
            <p key={readyLeft} className="game-tick font-display text-[min(30vw,14rem)] font-extrabold leading-none text-primary tabular-nums">
              {Math.max(readyLeft, 1)}
            </p>
            <p className="mt-2 text-xl text-muted">{questions.length} questions · {roster.length} players</p>
          </div>
        )}

        {view === 'question' && q && (
          <div className="flex flex-1 flex-col gap-6 pt-2">
            <div className="flex items-center justify-between gap-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted">
                Question {index + 1} of {questions.length} · {q.points} pts
              </p>
              <div className="w-full max-w-md">
                <Countdown left={left} total={q.time_limit_sec} variant="host" />
              </div>
            </div>
            <h1 className="font-display font-extrabold leading-[1.1]" style={{ fontSize: 'clamp(2rem, 4.2vw, 4rem)' }}>
              {localized(q.question)}
            </h1>
            {options.length > 0 ? (
              <div className={`grid gap-4 ${options.length > 1 ? 'md:grid-cols-2' : ''}`}>
                {options.map((o, i) => (
                  <AnswerTile key={o.id} index={i} label={o.label} display />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-border-strong p-8 text-center text-xl text-muted">
                Players type their answer on their phones.
              </div>
            )}
            <div className="mt-auto rounded-2xl border border-border bg-panel p-5">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-lg">
                  <span className="font-display text-4xl font-extrabold text-primary tabular-nums">{answeredIds.size}</span>
                  <span className="text-muted"> of {roster.length} answered</span>
                </p>
                {everyoneIn && <p className="text-sm font-medium text-primary">Everyone is in</p>}
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-panel-3">
                <div
                  className="game-motion h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${roster.length ? (answeredIds.size / roster.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {view === 'results' && q && (
          <div className="flex flex-1 flex-col gap-6 pt-2">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted">
              Question {index + 1} of {questions.length} · results
            </p>
            <h1 className="font-display font-extrabold leading-[1.1]" style={{ fontSize: 'clamp(1.75rem, 3.2vw, 3rem)' }}>
              {localized(q.question)}
            </h1>

            <div className="flex flex-col gap-3" role="list" aria-label="Votes per answer">
              {bars.map((b, i) => {
                const s = answerStyle(i);
                const fromOption = options.some(o => o.id === b.key);
                return (
                  <div
                    key={b.key}
                    role="listitem"
                    className={`rounded-2xl border-2 px-4 py-3 ${b.isCorrect ? 'border-primary bg-primary-soft' : 'border-border bg-panel'} ${
                      !b.isCorrect && correct ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      {fromOption ? (
                        <span style={{ color: s.bg }}>
                          <Shape shape={s.shape} className="h-7 w-7" />
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate font-display text-2xl font-bold">{b.label}</span>
                      {b.isCorrect && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-sm font-bold text-ink">
                          <Check className="h-4 w-4" strokeWidth={3.5} aria-hidden="true" /> Correct
                        </span>
                      )}
                      <span className="w-28 text-end font-display text-2xl font-extrabold tabular-nums">
                        {b.count}
                        <span className="ms-2 text-base font-medium text-muted">{b.percent}%</span>
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-panel-3">
                      <div
                        className="game-bar-grow h-full rounded-full"
                        style={{
                          width: `${b.width}%`,
                          backgroundColor: fromOption ? s.bg : b.isCorrect ? 'var(--color-primary)' : 'var(--color-muted)',
                          animationDelay: `${i * 0.08}s`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-auto text-lg text-muted">
              <span className="font-bold text-text">{rightCount}</span> of {answered} answered correctly
              {roster.length > answered ? ` · ${roster.length - answered} did not answer` : ''}
            </p>
          </div>
        )}

        {view === 'leaderboard' && (
          <div className="flex flex-1 flex-col gap-5 pt-2">
            <div className="flex items-end justify-between">
              <h1 className="text-4xl font-extrabold">Leaderboard</h1>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted">
                After question {index + 1} of {questions.length}
              </p>
            </div>
            {board.length === 0 ? (
              <p className="py-12 text-center text-xl text-muted">No scores yet.</p>
            ) : (
              <Leaderboard rows={board} previous={prevBoard} variant="host" limit={7} />
            )}
          </div>
        )}

        {view === 'finished' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6 text-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted">{quizTitle}</p>
              <h1 className="text-6xl font-extrabold">That's the game</h1>
            </div>
            {board.length > 0 ? (
              <>
                <Podium rows={board} size="host" />
                {board.length > 3 && (
                  <ol className="w-full max-w-xl space-y-2 text-start" start={4}>
                    {board.slice(3, 8).map((p, i) => (
                      <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-panel px-4 py-2">
                        <span className="w-8 font-display text-xl font-bold text-muted">{i + 4}</span>
                        <Avatar id={p.id} avatarId={p.avatar_id} avatarUrl={p.avatar_url} size={32} />
                        <span className="flex-1 truncate font-display text-lg font-bold">{p.name}</span>
                        <span className="font-display text-lg font-bold tabular-nums">{p.score}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <p className="text-xl text-muted">Nobody scored this time.</p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="!h-14 !px-8 !text-lg" onClick={() => navigate('/admin/quizzes')}>
                Back to quizzes
              </Button>
              <Button size="lg" variant="secondary" className="!h-14 !px-8 !text-lg" loading={busy} onClick={startAnotherGame}>
                <RotateCw className="h-5 w-5" aria-hidden="true" /> Play again
              </Button>
            </div>
          </div>
        )}
      </main>

      {primary && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <p className="hidden items-center gap-2 text-sm text-muted sm:flex">
              Press
              <kbd className="rounded border border-border-strong bg-panel-2 px-2 py-0.5 font-sans text-xs text-text">Space</kbd>
              or
              <kbd className="rounded border border-border-strong bg-panel-2 px-2 py-0.5 font-sans text-xs text-text">Enter</kbd>
              to continue
            </p>
            <Button size="lg" onClick={primary.run} loading={busy} className="!h-14 w-full !px-10 !text-xl sm:w-auto">
              {view === 'ready' && !busy && <Play className="h-6 w-6" fill="currentColor" aria-hidden="true" />}
              {primary.label}
              {view !== 'ready' && !busy && <ArrowRight className="h-6 w-6" aria-hidden="true" />}
            </Button>
          </div>
        </div>
      )}

      {confirmEnd && (
        <ConfirmDialog
          title="End the game now?"
          message="Players see their final places and nobody can answer any more. This cannot be undone."
          confirmLabel="End game"
          destructive
          loading={busy}
          onConfirm={finishGame}
          onCancel={() => setConfirmEnd(false)}
        />
      )}
    </GameShell>
  );
};

export default HostLiveBoard;
