import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag, Loader2, Play, SkipForward, Trophy, WifiOff } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router';
import client from '../api/client';
import type { QuizPlayer, QuizQuestion, QuizSession } from '../api/types';
import { hostSocketUrl } from '../api/ws';
import AnswerBars, { type BarOption } from '../components/game/AnswerBars';
import AnswerShape from '../components/game/AnswerShape';
import HostTopBar from '../components/game/HostTopBar';
import Podium from '../components/game/Podium';
import { PlayerAvatar } from '../components/game/PlayerBubble';
import Scoreboard, { type ScoreRow } from '../components/game/Scoreboard';
import TimerRing from '../components/game/TimerRing';
import { apiErrorMessage } from '../lib/apiError';
import { answerStyle } from '../lib/game/answers';
import { fireCelebration } from '../lib/game/confetti';
import { hostStrings } from '../lib/game/hostStrings';
import { play } from '../lib/game/sound';
import { useDeadline } from '../lib/game/useDeadline';
import { useGameLocale } from '../lib/game/useGameLocale';
import { useGameSocket } from '../lib/game/useGameSocket';
import { localized, optionLabel } from '../lib/i18n';

type Phase = 'loading' | 'intro' | 'question' | 'results' | 'scoreboard' | 'finished';

interface QuestionResults {
  question_id: string;
  correct_answer: Record<string, unknown>;
  distribution: Record<string, number>;
  answered: number;
  players: number;
  leaderboard?: QuizPlayer[];
}

interface ChoiceOption {
  id: string;
  label: string;
  index: number;
}

const INTRO_MS = 3200;
const ALL_ANSWERED_DELAY_MS = 1000;
const SCOREBOARD_SIZE = 5;
const FRESH_START_MS = 15000;

/** Whitespace-collapsed, case-insensitive key: "  New  York" and "new york" match. */
const key = (s: string) => s.split(/\s+/).filter(Boolean).join(' ').toLowerCase();

const correctText = (q: QuizQuestion | undefined, results: QuestionResults | null): string => {
  const src = results?.correct_answer ?? q?.correct_answer ?? {};
  const v = src.value ?? src.text ?? '';
  return String(v);
};

const choiceOptions = (q: QuizQuestion | undefined): ChoiceOption[] => {
  if (!q || q.type === 'short') return [];
  const entries = Object.entries(q.options ?? {});
  if (entries.length === 0 && q.type === 'tf') {
    return [
      { id: 'true', label: 'True', index: 0 },
      { id: 'false', label: 'False', index: 1 },
    ];
  }
  return entries.map(([id, opt], index) => ({ id, label: optionLabel(opt as never, id), index }));
};

const HostLiveBoard: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Captured once: the lobby passes it so a fresh start gets the 3-2-1, and a later
  // re-render or navigation must not restart the screen.
  const startedAtRef = useRef((location.state as { startedAt?: number } | null)?.startedAt);
  const { dir, locale, G } = useGameLocale();
  const H = hostStrings[locale];

  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState('');
  const [quizId, setQuizId] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [results, setResults] = useState<QuestionResults | null>(null);
  const [resultsError, setResultsError] = useState('');
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>([]);
  const [introCount, setIntroCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);

  // Refs let socket and timer callbacks see current values without being re-created.
  const answeredIds = useRef(new Set<string>());
  const phaseRef = useRef<Phase>('loading');
  const resultsStarted = useRef(false);
  const finishedRef = useRef(false);
  const previousRanks = useRef(new Map<string, { rank: number; score: number }>());
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const question: QuizQuestion | undefined = questions[idx];
  const isLast = idx >= questions.length - 1;
  const limit = question && question.time_limit_sec > 0 ? question.time_limit_sec : null;

  // ---- transitions ---------------------------------------------------------

  const resetQuestion = useCallback(() => {
    answeredIds.current = new Set();
    setAnsweredCount(0);
    setResults(null);
    setResultsError('');
    resultsStarted.current = false;
  }, []);

  const enterFinished = useCallback((leaderboard?: QuizPlayer[]) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (leaderboard) setPlayers(leaderboard);
    setPhase('finished');
    setConfirmEnd(false);
    play('win');
    fireCelebration();
  }, []);

  const goResults = useCallback(async () => {
    if (resultsStarted.current || phaseRef.current !== 'question') return;
    resultsStarted.current = true;
    setPhase('results');
    play('reveal');
    try {
      const res = await client.post<{ leaderboard?: QuizPlayer[]; results?: QuestionResults }>(
        `/api/v1/sessions/${sessionId}/show_results`
      );
      setResults(res.data.results ?? null);
      const lb = res.data.results?.leaderboard ?? res.data.leaderboard;
      if (lb) setPlayers(lb);
    } catch (err) {
      // Players still got the leaderboard if the broadcast landed; the host
      // sees the answer without the chart rather than a dead screen.
      setResultsError(apiErrorMessage(err, H.loadError));
    }
  }, [sessionId, H.loadError]);

  const showScoreboard = useCallback(() => {
    const sorted = [...(results?.leaderboard ?? players)].sort((a, b) => b.score - a.score);
    const rows: ScoreRow[] = sorted.slice(0, SCOREBOARD_SIZE).map((player, i) => {
      const prev = previousRanks.current.get(player.id);
      return { player, rank: i + 1, previousRank: prev?.rank, previousScore: prev?.score ?? 0 };
    });
    previousRanks.current = new Map(sorted.map((p, i) => [p.id, { rank: i + 1, score: p.score }]));
    setScoreRows(rows);
    setPhase('scoreboard');
    play('whoosh');
  }, [results, players]);

  const nextQuestion = useCallback(async () => {
    const next = questions[idx + 1];
    if (!next || busy) return;
    setBusy(true);
    setActionError('');
    try {
      await client.patch(`/api/v1/sessions/${sessionId}/advance`, { question_id: next.id });
      setIdx(idx + 1);
      resetQuestion();
      setPhase('intro');
      play('whoosh');
    } catch (err) {
      setActionError(apiErrorMessage(err, H.startFailed));
    } finally {
      setBusy(false);
    }
  }, [questions, idx, busy, sessionId, resetQuestion, H.startFailed]);

  const finishGame = useCallback(async () => {
    if (busy || finishedRef.current) return;
    setBusy(true);
    setActionError('');
    try {
      const res = await client.patch<{ leaderboard?: QuizPlayer[] }>(`/api/v1/sessions/${sessionId}/finish`);
      enterFinished(res.data.leaderboard ?? undefined);
    } catch (err) {
      if (/finished/i.test(apiErrorMessage(err, ''))) {
        // Already over (ended elsewhere): show the final standings.
        try {
          const lb = await client.get<QuizPlayer[]>(`/api/v1/sessions/${sessionId}/leaderboard`);
          enterFinished(lb.data || []);
        } catch {
          enterFinished();
        }
      } else {
        setActionError(apiErrorMessage(err, H.startFailed));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, sessionId, enterFinished, H.startFailed]);

  const hostAgain = async () => {
    if (!quizId || busy) return;
    setBusy(true);
    try {
      const res = await client.post<{ id: string }>(`/api/v1/quizzes/${quizId}/sessions`);
      navigate(`/host/lobby/${res.data.id}`);
    } catch (err) {
      setActionError(apiErrorMessage(err, H.startFailed));
      setBusy(false);
    }
  };

  // ---- loading and restoring -----------------------------------------------

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoadError('');
    try {
      const [sessionRes, lbRes] = await Promise.all([
        client.get<QuizSession>(`/api/v1/sessions/${sessionId}`),
        client.get<QuizPlayer[]>(`/api/v1/sessions/${sessionId}/leaderboard`),
      ]);
      const session = sessionRes.data;
      if (session.status === 'lobby') {
        navigate(`/host/lobby/${sessionId}`, { replace: true });
        return;
      }
      const qs = await client.get<QuizQuestion[]>(`/api/v1/quizzes/${session.quiz_id}/questions`);
      const sorted = [...(qs.data || [])].sort((a, b) => a.position - b.position);
      if (sorted.length === 0) throw new Error(H.noQuestions);

      setQuizId(session.quiz_id);
      setQuestions(sorted);
      setPlayers(lbRes.data || []);

      if (session.status === 'finished') {
        enterFinished(lbRes.data || []);
        return;
      }

      let current = sorted.findIndex(q => q.id === session.current_question_id);
      if (current === -1) {
        // Started but nothing live (the lobby's advance did not land): go to the first question.
        await client.patch(`/api/v1/sessions/${sessionId}/advance`, { question_id: sorted[0].id });
        current = 0;
      }
      setIdx(current);
      const startedAt = startedAtRef.current;
      const fresh = typeof startedAt === 'number' && Date.now() - startedAt < FRESH_START_MS;
      // A fresh start gets the 3-2-1; a reload mid-game resumes the question with a full timer.
      setPhase(fresh ? 'intro' : 'question');
    } catch (err) {
      setLoadError(err instanceof Error && !('response' in err) ? err.message : apiErrorMessage(err, H.loadError));
    }
  }, [sessionId, navigate, enterFinished, H.loadError, H.noQuestions]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- live updates --------------------------------------------------------

  const status = useGameSocket({
    url: () => hostSocketUrl(sessionId ?? ''),
    enabled: Boolean(sessionId),
    onMessage: msg => {
      switch (msg.type) {
        case 'player_joined': {
          const p = msg.payload as { player_id: string; name?: string; avatar_id?: number; avatar_url?: string };
          setPlayers(prev =>
            prev.some(x => x.id === p.player_id)
              ? prev
              : [
                  ...prev,
                  {
                    id: p.player_id,
                    session_id: sessionId ?? '',
                    name: p.name || '…',
                    score: 0,
                    joined_at: new Date().toISOString(),
                    avatar_id: p.avatar_id,
                    avatar_url: p.avatar_url,
                  },
                ]
          );
          break;
        }
        case 'answer_result': {
          const id = (msg.payload as { player_id?: string }).player_id;
          // One event per answer, but dedupe anyway: a reconnect can replay.
          if (id && phaseRef.current === 'question' && !answeredIds.current.has(id)) {
            answeredIds.current.add(id);
            setAnsweredCount(answeredIds.current.size);
          }
          break;
        }
        case 'leaderboard':
          if (Array.isArray(msg.payload)) setPlayers(msg.payload as QuizPlayer[]);
          break;
        case 'game_finished':
          enterFinished(Array.isArray(msg.payload) ? (msg.payload as QuizPlayer[]) : undefined);
          break;
      }
    },
  });

  // ---- timing --------------------------------------------------------------

  useEffect(() => {
    if (phase !== 'intro') return;
    setIntroCount(3);
    play('tick');
    const timers = [
      setTimeout(() => {
        setIntroCount(2);
        play('tick');
      }, 1000),
      setTimeout(() => {
        setIntroCount(1);
        play('tick');
      }, 2000),
      setTimeout(() => {
        play('go');
        setPhase('question');
      }, INTRO_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase, idx]);

  const { remainingMs, remainingSec } = useDeadline(limit, phase === 'question', () => void goResults());

  useEffect(() => {
    if (phase === 'question' && limit !== null && remainingSec <= 5 && remainingSec > 0) play('tick');
  }, [phase, limit, remainingSec]);

  // Everyone has answered: don't make the room wait out the clock.
  useEffect(() => {
    if (phase !== 'question' || players.length === 0 || answeredCount < players.length) return;
    const t = setTimeout(() => void goResults(), ALL_ANSWERED_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase, players.length, answeredCount, goResults]);

  // ---- primary action + keyboard ---------------------------------------------

  const primary = useMemo<{ label: string; run: () => void } | null>(() => {
    if (phase === 'results') return { label: G.host.showScoreboard, run: showScoreboard };
    if (phase === 'scoreboard') {
      return isLast
        ? { label: G.host.finish, run: () => void finishGame() }
        : { label: G.host.nextQuestion, run: () => void nextQuestion() };
    }
    return null;
  }, [phase, isLast, G.host, showScoreboard, finishGame, nextQuestion]);

  useEffect(() => {
    if (!primary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      // A focused button handles its own Enter/Space; don't fire twice.
      if ((e.target as HTMLElement | null)?.closest('button, a, input, textarea')) return;
      e.preventDefault();
      primary.run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [primary]);

  // ---- derived view data -----------------------------------------------------

  const title = localized(question?.question, '', locale);
  const options = useMemo(() => choiceOptions(question), [question]);
  const correct = correctText(question, results);

  const distribution = useMemo(() => {
    const merged = new Map<string, { label: string; count: number }>();
    for (const [label, count] of Object.entries(results?.distribution ?? {})) {
      const k = key(label);
      const prev = merged.get(k);
      merged.set(k, { label: prev?.label ?? label, count: (prev?.count ?? 0) + count });
    }
    return merged;
  }, [results]);

  const bars: BarOption[] = options.map(o => ({
    key: o.id,
    label: o.label,
    index: o.index,
    count: distribution.get(key(o.label))?.count ?? 0,
    correct: key(o.label) === key(correct),
  }));

  const topShort = useMemo(
    () =>
      question?.type === 'short'
        ? [...distribution.values()].sort((a, b) => b.count - a.count).slice(0, 5)
        : [],
    [question, distribution]
  );

  const answered = results?.answered ?? answeredCount;
  const rightCount =
    question?.type === 'short'
      ? [...distribution.entries()].filter(([k]) => k === key(correct)).reduce((n, [, v]) => n + v.count, 0)
      : (bars.find(b => b.correct)?.count ?? 0);
  const funnyLine =
    answered === 0
      ? H.noAnswers
      : rightCount === 0
        ? G.host.nobodyGotIt
        : rightCount === answered && answered >= (results?.players ?? answered)
          ? G.host.everybodyGotIt
          : G.host.gotItRight(Math.round((rightCount / answered) * 100));

  const announcement =
    phase === 'intro' || phase === 'question'
      ? H.announce.question(idx + 1, questions.length)
      : phase === 'results'
        ? H.announce.results
        : phase === 'scoreboard'
          ? H.announce.scoreboard
          : phase === 'finished'
            ? H.announce.finished
            : '';

  // ---- render ----------------------------------------------------------------

  if (loadError) {
    return (
      <div className="game flex flex-col items-center justify-center gap-5 p-8 text-center" dir={dir}>
        <p role="alert" className="text-2xl font-semibold">
          {loadError}
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => void load()} className="min-h-12 px-6 rounded-xl bg-primary text-ink font-semibold cursor-pointer">
            {H.retry}
          </button>
          <button type="button" onClick={() => navigate('/admin/quizzes')} className="min-h-12 px-6 rounded-xl bg-white/10 font-semibold cursor-pointer">
            {H.back}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="game flex items-center justify-center gap-3 text-xl" dir={dir} role="status">
        <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
        {H.loading}
      </div>
    );
  }

  const bigButton =
    'inline-flex items-center justify-center gap-3 min-h-14 px-10 rounded-2xl bg-mark text-ink text-xl font-semibold shadow-lg hover:brightness-105 transition disabled:opacity-60 cursor-pointer';

  return (
    <div className="game flex flex-col" dir={dir}>
      <HostTopBar playerCount={players.length}>
        {phase !== 'finished' &&
          (confirmEnd ? (
            <span className="inline-flex items-center gap-2 flex-wrap" role="group" aria-label={G.host.confirmEnd}>
              <span className="font-semibold">{G.host.confirmEnd}</span>
              <button type="button" onClick={() => void finishGame()} disabled={busy} className="min-h-11 px-4 rounded-full bg-coral text-white font-semibold cursor-pointer">
                {H.endYes}
              </button>
              <button type="button" onClick={() => setConfirmEnd(false)} className="min-h-11 px-4 rounded-full bg-white/10 hover:bg-white/20 font-semibold cursor-pointer">
                {H.endNo}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full bg-coral/20 text-coral hover:bg-coral/30 font-semibold cursor-pointer transition-colors"
            >
              <Flag className="w-4 h-4" aria-hidden="true" />
              {G.host.endGame}
            </button>
          ))}
      </HostTopBar>

      {status !== 'open' && (
        <p role="status" className="mx-auto mb-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warning/20 text-warning text-sm font-semibold">
          <WifiOff className="w-4 h-4" aria-hidden="true" />
          {status === 'failed' ? H.connectionFailed : H.reconnecting}
        </p>
      )}

      <main className="flex-1 flex flex-col items-center justify-center px-5 sm:px-10 pb-10 gap-8 w-full">
        {phase === 'intro' && (
          <div className="text-center space-y-6" aria-live="polite">
            <p className="text-xl text-muted">{G.host.questionOf(idx + 1, questions.length)}</p>
            <h1 className="text-4xl sm:text-5xl font-semibold">{G.host.getReady}</h1>
            <div key={introCount} className="game-pop numeral font-semibold" style={{ fontSize: 'clamp(7rem, 22vw, 14rem)' }}>
              {introCount}
            </div>
          </div>
        )}

        {phase === 'question' && question && (
          <div className="w-full max-w-6xl flex flex-col gap-8">
            <div className="flex items-center justify-between gap-4">
              <span className="px-4 py-2 rounded-full bg-white/10 font-semibold">{G.host.questionOf(idx + 1, questions.length)}</span>
              {limit !== null && <TimerRing remainingMs={remainingMs} totalMs={limit * 1000} size={110} />}
            </div>

            <h1 className="game-rise text-center font-semibold text-balance" style={{ fontSize: 'clamp(2rem, 5.2vw, 4.5rem)' }}>
              {title}
            </h1>

            {question.type === 'short' ? (
              <div className="game-pulse mx-auto rounded-3xl bg-panel-2 border border-border-strong px-10 py-8 text-2xl sm:text-3xl font-semibold text-center">
                {H.typeOnPhone}
              </div>
            ) : (
              <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                {options.map(o => {
                  const style = answerStyle(o.index);
                  return (
                    <li
                      key={o.id}
                      className={`game-pop flex items-center gap-4 rounded-2xl px-6 py-6 sm:py-8 ${style.bg.split(' ')[0]} ${style.text}`}
                      style={{ animationDelay: `${o.index * 0.08}s` }}
                    >
                      <AnswerShape shape={style.shape} className="w-9 h-9 flex-shrink-0" />
                      <span className="text-2xl sm:text-3xl font-semibold break-words min-w-0">{o.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-center gap-5 flex-wrap rounded-2xl bg-panel-2 border border-border px-5 py-4">
              <span className="font-semibold text-lg" aria-live="polite">
                {G.host.answered(answeredCount, players.length)}
              </span>
              <div className="flex-1 min-w-32 h-3 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${players.length ? Math.min(100, (answeredCount / players.length) * 100) : 0}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => void goResults()}
                className="inline-flex items-center gap-2 min-h-11 px-5 rounded-xl bg-white/10 hover:bg-white/20 font-semibold cursor-pointer transition-colors"
              >
                <SkipForward className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                {H.skip}
              </button>
            </div>
          </div>
        )}

        {phase === 'results' && question && (
          <div className="w-full max-w-5xl flex flex-col items-center gap-8">
            <p className="text-lg text-muted font-semibold">{G.host.timeUp}</p>
            <h1 className="text-center font-semibold text-balance" style={{ fontSize: 'clamp(1.6rem, 3.6vw, 3rem)' }}>
              <span className="text-muted text-lg block mb-2">{G.host.correct}</span>
              <span className="mark">{correct}</span>
            </h1>

            {resultsError && (
              <p role="alert" className="px-4 py-2 rounded-xl bg-coral/20 text-coral font-semibold">
                {resultsError}
              </p>
            )}

            {question.type === 'short' ? (
              topShort.length > 0 ? (
                <div className="w-full max-w-2xl space-y-3">
                  <h2 className="text-muted font-semibold">{H.topAnswers}</h2>
                  {topShort.map((a, i) => {
                    const isRight = key(a.label) === key(correct);
                    const max = Math.max(1, topShort[0].count);
                    return (
                      <div key={a.label} className={`rounded-xl bg-panel-2 px-4 py-3 ${isRight ? 'ring-2 ring-leaf' : 'opacity-70'}`}>
                        <div className="flex justify-between gap-3 font-semibold">
                          <span className="truncate">{a.label}</span>
                          <span className="numeral">{a.count}</span>
                        </div>
                        <div className="mt-2 h-2.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`game-wipe h-full rounded-full ${isRight ? 'bg-leaf' : 'bg-white/40'}`}
                            style={{ width: `${(a.count / max) * 100}%`, animationDelay: `${i * 0.1}s` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null
            ) : (
              <AnswerBars options={bars} totalAnswered={answered} />
            )}

            <p className="text-2xl font-semibold text-center" aria-live="polite">
              {funnyLine}
            </p>
          </div>
        )}

        {phase === 'scoreboard' && (
          <div className="w-full flex flex-col items-center gap-8">
            <h1 className="text-4xl sm:text-5xl font-semibold flex items-center gap-3">
              <Trophy className="w-10 h-10 text-mark" aria-hidden="true" />
              {G.host.scoreboard}
            </h1>
            {scoreRows.length === 0 ? <p className="text-xl text-muted">{H.nobodyHere}</p> : <Scoreboard rows={scoreRows} />}
          </div>
        )}

        {phase === 'finished' && (
          <div className="w-full flex flex-col items-center gap-8">
            <h1 className="text-4xl sm:text-6xl font-semibold text-center">{G.host.finalResults}</h1>
            {players.length === 0 ? <p className="text-xl text-muted">{H.nobodyHere}</p> : <Podium players={[...players].sort((a, b) => b.score - a.score)} />}
            {players.length > 3 && (
              <section className="w-full max-w-2xl" aria-label={H.everyoneElse}>
                <h2 className="text-muted font-semibold mb-3">{H.everyoneElse}</h2>
                <ol className="space-y-2">
                  {[...players]
                    .sort((a, b) => b.score - a.score)
                    .slice(3)
                    .map((p, i) => (
                      <li key={p.id} className="flex items-center gap-4 rounded-xl bg-panel-2 px-4 py-3">
                        <span className="numeral w-8 text-center text-muted font-semibold">{i + 4}</span>
                        <PlayerAvatar player={p} size={36} />
                        <span className="flex-1 truncate font-semibold">{p.name}</span>
                        <span className="numeral font-semibold">{G.common.points(p.score)}</span>
                      </li>
                    ))}
                </ol>
              </section>
            )}
            <div className="flex gap-3 flex-wrap justify-center">
              <button type="button" onClick={() => navigate('/admin/quizzes')} className="min-h-14 px-8 rounded-2xl bg-white/10 hover:bg-white/20 text-lg font-semibold cursor-pointer transition-colors">
                {G.host.backToQuizzes}
              </button>
              <button type="button" onClick={() => void hostAgain()} disabled={busy} className={bigButton}>
                <Play className="w-6 h-6" fill="currentColor" aria-hidden="true" />
                {G.host.playAgain}
              </button>
            </div>
          </div>
        )}

        {primary && (
          <div className="flex flex-col items-center gap-3">
            {actionError && (
              <p role="alert" className="px-4 py-2 rounded-xl bg-coral/20 text-coral font-semibold">
                {actionError}
              </p>
            )}
            <button type="button" onClick={primary.run} disabled={busy} className={bigButton}>
              {busy ? <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" /> : <SkipForward className="w-6 h-6 rtl:rotate-180" aria-hidden="true" />}
              {primary.label}
            </button>
            <p className="text-sm text-muted">{G.host.skipHint}</p>
          </div>
        )}
        {phase === 'finished' && actionError && (
          <p role="alert" className="px-4 py-2 rounded-xl bg-coral/20 text-coral font-semibold">
            {actionError}
          </p>
        )}
      </main>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
};

export default HostLiveBoard;
