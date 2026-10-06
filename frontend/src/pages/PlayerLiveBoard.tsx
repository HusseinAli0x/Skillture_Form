import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Send, X } from 'lucide-react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import client from '../api/client';
import { apiErrorStatus } from '../lib/apiError';
import type {
  AnswerResult,
  GameMessage,
  PublicQuizQuestion,
  QuestionResults,
  QuizPlayer,
} from '../api/types';
import { playerSocketUrl } from '../api/ws';
import { localized } from '../lib/i18n';
import { Button } from '../components/ui';
import GameShell, { ConnectionChip } from '../components/game/GameShell';
import PlayerCard from '../components/game/PlayerCard';
import AnswerTile from '../components/game/AnswerTile';
import Countdown from '../components/game/Countdown';
import Leaderboard from '../components/game/Leaderboard';
import Podium from '../components/game/Podium';
import { useNow } from '../components/game/hooks';
import { useGameSocket } from '../components/game/useGameSocket';
import { clearRejoin, loadRejoin } from '../components/game/rejoin';
import {
  answerFeedback,
  correctAnswerText,
  ordinal,
  parseOptions,
  sameAnswer,
  secondsLeft,
} from '../components/game/gameLogic';
import { useDocumentTitle } from '../lib/useDocumentTitle';

type Phase = 'lobby' | 'between' | 'question' | 'answered' | 'results' | 'finished';

const PlayerLiveBoard: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const playerId = searchParams.get('playerId');
  if (!sessionId || !playerId) return <Navigate to="/play" replace />;
  return <PlayerGame sessionId={sessionId} playerId={playerId} />;
};

const PlayerGame: React.FC<{ sessionId: string; playerId: string }> = ({ sessionId, playerId }) => {
  useDocumentTitle('Skillture Quiz');

  const [phase, setPhase] = useState<Phase>('lobby');
  const [roster, setRoster] = useState<QuizPlayer[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [board, setBoard] = useState<QuizPlayer[]>([]);
  const [prevBoard, setPrevBoard] = useState<QuizPlayer[] | undefined>(undefined);
  const [question, setQuestion] = useState<PublicQuizQuestion | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [results, setResults] = useState<QuestionResults | null>(null);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [rankBefore, setRankBefore] = useState<number | null>(null);
  const [sendError, setSendError] = useState('');
  const [shortText, setShortText] = useState('');
  const [final, setFinal] = useState<QuizPlayer[]>([]);

  // Refs the socket handler reads: it must see the current question without being re-created.
  const questionRef = useRef<PublicQuizQuestion | null>(null);
  questionRef.current = question;
  const boardRef = useRef<QuizPlayer[]>([]);
  boardRef.current = board;
  const sending = useRef(false);

  const loadRoster = useCallback(() => {
    client
      .get<QuizPlayer[]>(`/api/v1/sessions/${sessionId}/leaderboard`)
      .then(res => {
        setRoster(res.data || []);
        setBoard(prev => (prev.length ? prev : res.data || []));
        setRosterLoaded(true);
      })
      .catch(() => undefined);
  }, [sessionId]);

  useEffect(loadRoster, [loadRoster]);

  const startQuestion = useCallback((q: PublicQuizQuestion) => {
    setQuestion(q);
    setStartedAt(Date.now());
    setPicked(null);
    setAnswer(null);
    setResults(null);
    setAnsweredIds(new Set());
    setSendError('');
    setShortText('');
    sending.current = false;
    // Only a real ranking (someone has scored) can be moved from.
    const rank = boardRef.current.some(p => p.score > 0) ? boardRef.current.findIndex(p => p.id === playerId) + 1 : 0;
    setRankBefore(rank > 0 ? rank : null);
    setPhase('question');
  }, [playerId]);

  const onMessage = useCallback(
    (msg: GameMessage) => {
      switch (msg.type) {
        case 'lobby_snapshot': {
          const { status, question: live } = msg.payload;
          if (status === 'finished') {
            setPhase('finished');
            loadRoster();
          } else if (status === 'active') {
            // Reconnecting mid-game: land on the live question unless we are already on it.
            if (live && live.id !== questionRef.current?.id) startQuestion(live);
            else if (!live) setPhase(p => (p === 'lobby' ? 'between' : p));
          }
          break;
        }
        case 'player_joined':
          loadRoster();
          break;
        case 'game_started':
          setPhase(p => (p === 'lobby' ? 'between' : p));
          break;
        case 'question':
          startQuestion(msg.payload);
          break;
        case 'answer_result':
          setAnsweredIds(prev => new Set(prev).add(msg.payload.player_id));
          break;
        case 'leaderboard':
          if (msg.payload) setBoard(msg.payload);
          break;
        case 'question_results':
          setPrevBoard(boardRef.current);
          setResults(msg.payload);
          setBoard(msg.payload.leaderboard ?? []);
          setPhase(p => (p === 'question' || p === 'answered' || p === 'between' ? 'results' : p));
          break;
        case 'show_leaderboard':
          // Normally paired with question_results; this covers a results frame that failed to build.
          if (msg.payload) setBoard(msg.payload);
          setPhase(p => (p === 'question' || p === 'answered' ? 'results' : p));
          break;
        case 'game_finished':
          if (msg.payload) setFinal(msg.payload);
          setPhase('finished');
          break;
      }
    },
    [loadRoster, startQuestion]
  );

  const status = useGameSocket(() => playerSocketUrl(sessionId, playerId), onMessage, loadRoster);

  const submit = async (value: string) => {
    if (!question || phase !== 'question' || sending.current || !value.trim()) return;
    sending.current = true;
    setPicked(value);
    setPhase('answered');
    setSendError('');
    try {
      // player_id and question_id are `binding:"required"` on the handler.
      const res = await client.post<AnswerResult>(`/api/v1/sessions/${sessionId}/answer`, {
        player_id: playerId,
        question_id: question.id,
        answer: { value: value.trim() },
        time_taken_ms: Date.now() - startedAt,
      });
      setAnswer(res.data);
    } catch (err) {
      const code = apiErrorStatus(err);
      if (code === 409) {
        // Already counted (a retry after a flaky connection): the score is not returned.
        setAnswer(null);
      } else if (code === 422) {
        sending.current = false;
        setPicked(null);
        setSendError('Too late. That question just closed.');
        setPhase('between');
      } else {
        sending.current = false;
        setPicked(null);
        setSendError("Your answer didn't go through. Tap it again.");
        setPhase('question');
      }
    }
  };

  const me = useMemo(
    () => roster.find(p => p.id === playerId) ?? board.find(p => p.id === playerId) ?? null,
    [roster, board, playerId]
  );
  const saved = loadRejoin();
  const myName = me?.name ?? (saved?.playerId === playerId ? saved.name : '');
  const myRank = board.findIndex(p => p.id === playerId) + 1;
  const myScore = board.find(p => p.id === playerId)?.score ?? me?.score ?? 0;

  const options = useMemo(() => parseOptions(question?.options), [question]);
  const now = useNow(250, phase === 'question');
  const left = question ? secondsLeft(question.time_limit_sec, startedAt, now) : null;
  const timeUp = left === 0;

  const right = <ConnectionChip status={status} />;

  // Seat not found: a stale link, or the session was deleted.
  if (rosterLoaded && !me && phase === 'lobby') {
    return (
      <GameShell title="Skillture Quiz" right={right} status={status}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 text-center">
          <h1 className="text-3xl font-extrabold">We can't find your seat</h1>
          <p className="mt-2 text-muted">This link is for a game that has changed or ended. Join again with the PIN.</p>
          <Link to="/play" onClick={clearRejoin}>
            <Button className="mt-6 !h-12">Enter a PIN</Button>
          </Link>
        </div>
      </GameShell>
    );
  }

  const feedback = answer
    ? answerFeedback({
        correct: answer.is_correct,
        points: answer.score_awarded,
        streak: answer.streak,
        streakBonus: answer.streak_bonus,
      })
    : null;

  const correct = correctAnswerText(results?.correct_answer);
  const iWasRight = answer ? answer.is_correct : picked !== null && sameAnswer(picked, correct);
  const moved = rankBefore && myRank ? rankBefore - myRank : 0;
  const total = results?.players ?? roster.length;

  return (
    <GameShell
      title={myName || 'Skillture Quiz'}
      right={right}
      status={status}
      pattern={phase === 'lobby' || phase === 'finished' ? 'soft' : 'faint'}
    >
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" aria-live="polite">
        {phase === 'lobby' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <PlayerCard id={playerId} name={myName || 'You'} avatarId={me?.avatar_id} avatarUrl={me?.avatar_url} size="lg" strap entering />
            <div>
              <h1 className="text-3xl font-extrabold">You're in</h1>
              <p className="mt-1 text-muted">
                {roster.length > 1 ? `${roster.length} players are here.` : "You're the first one here."} The host starts the game.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
                <span aria-hidden="true" className="game-live h-2 w-2 rounded-full bg-primary" />
                Waiting for the host
              </p>
            </div>
          </div>
        )}

        {phase === 'between' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <span aria-hidden="true" className="game-live h-3 w-3 rounded-full bg-primary" />
            <h1 className="text-3xl font-extrabold">Eyes on the big screen</h1>
            <p className="text-muted">{sendError || 'The next question is on its way.'}</p>
          </div>
        )}

        {phase === 'question' && question && (
          <div className="flex flex-1 flex-col gap-4 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              <span>Question {question.position}</span>
              <span>{question.points} pts</span>
            </div>
            <Countdown left={left} total={question.time_limit_sec} variant="phone" />
            <h1 className="text-2xl font-bold leading-snug">{localized(question.question)}</h1>

            {timeUp && (
              <p role="status" className="text-center text-sm font-medium text-warning">
                Time's up. Waiting for the results.
              </p>
            )}
            {sendError && (
              <p role="alert" className="text-center text-sm font-medium text-danger">
                {sendError}
              </p>
            )}

            {options.length > 0 ? (
              <div className="mt-auto flex flex-col gap-3">
                {options.map((o, i) => (
                  <AnswerTile key={o.id} index={i} label={o.label} disabled={timeUp} onClick={() => submit(o.label)} />
                ))}
              </div>
            ) : (
              <form
                className="mt-auto flex flex-col gap-3"
                onSubmit={e => {
                  e.preventDefault();
                  submit(shortText);
                }}
              >
                <label htmlFor="short-answer" className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Your answer
                </label>
                <input
                  id="short-answer"
                  value={shortText}
                  onChange={e => setShortText(e.target.value)}
                  disabled={timeUp}
                  autoComplete="off"
                  autoCapitalize="none"
                  enterKeyHint="send"
                  placeholder="Type it here"
                  className="h-16 rounded-2xl border-2 border-border bg-bg px-4 font-display text-2xl font-bold text-text outline-none focus:border-primary"
                  autoFocus
                />
                <Button type="submit" size="lg" disabled={timeUp || !shortText.trim()} className="!h-16 !text-lg">
                  <Send className="h-5 w-5" aria-hidden="true" /> Send answer
                </Button>
              </form>
            )}
          </div>
        )}

        {phase === 'answered' && (
          <div className="flex flex-1 flex-col justify-center gap-5">
            {feedback ? (
              <FeedbackPanel tone={feedback.tone} headline={feedback.headline} detail={feedback.detail} points={answer?.score_awarded ?? 0} streak={answer?.streak ?? 0} />
            ) : (
              <div className="game-rise rounded-3xl border border-border bg-panel p-8 text-center">
                <h1 className="text-3xl font-extrabold">Locked in</h1>
                <p className="mt-1 text-muted">{answer === null && picked ? 'Your answer is in.' : 'Sending…'}</p>
              </div>
            )}
            <div className="text-center text-muted">
              <p className="font-medium text-text">
                {answeredIds.size > 0 ? `${answeredIds.size} of ${answer?.players ?? total ?? '?'} answered` : 'Waiting for the others'}
              </p>
              {answer?.rank ? (
                <p className="text-sm">
                  You're {ordinal(answer.rank)} with {answer.total_score ?? myScore} points
                </p>
              ) : null}
            </div>
            {picked && <p className="text-center text-sm text-muted">You chose: {picked}</p>}
          </div>
        )}

        {phase === 'results' && (
          <div className="flex flex-1 flex-col gap-5 pt-2">
            {feedback ? (
              <FeedbackPanel tone={feedback.tone} headline={feedback.headline} detail={feedback.detail} points={answer?.score_awarded ?? 0} streak={answer?.streak ?? 0} />
            ) : (
              <FeedbackPanel
                tone={picked === null ? 'missed' : iWasRight ? 'correct' : 'wrong'}
                headline={picked === null ? "Time's up" : iWasRight ? 'Correct' : 'Not this time'}
                detail={picked === null ? 'You did not answer this one.' : 'Your answer was recorded.'}
                points={0}
                streak={0}
              />
            )}

            {correct && !iWasRight && (
              <div className="game-rise rounded-2xl border border-primary-border bg-primary-soft px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">The answer was</p>
                <p className="font-display text-2xl font-bold text-primary">{correct}</p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-2xl border border-border bg-panel px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">Your place</p>
                <p className="font-display text-3xl font-extrabold">{myRank ? ordinal(myRank) : '–'}</p>
              </div>
              {moved !== 0 && (
                <span className={`inline-flex items-center gap-1 text-sm font-bold ${moved > 0 ? 'text-primary' : 'text-muted'}`}>
                  {moved > 0 ? <ArrowUp className="h-4 w-4" aria-hidden="true" /> : <ArrowDown className="h-4 w-4" aria-hidden="true" />}
                  {moved > 0 ? `Up ${moved}` : `Down ${-moved}`}
                </span>
              )}
              <p className="text-end">
                <span className="block font-display text-3xl font-extrabold tabular-nums">{myScore}</span>
                <span className="text-xs uppercase tracking-widest text-muted">points</span>
              </p>
            </div>

            {board.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Top of the room</p>
                <Leaderboard rows={board} previous={prevBoard} variant="phone" meId={playerId} limit={3} />
              </div>
            )}

            <p className="mt-auto pt-2 text-center text-sm text-muted">Waiting for the host to move on…</p>
          </div>
        )}

        {phase === 'finished' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4 text-center">
            <div>
              <h1 className="text-4xl font-extrabold">Game over</h1>
              {myRank > 0 ? (
                <p className="mt-1 text-lg text-muted">
                  You finished <span className="font-bold text-primary">{ordinal(myRank)}</span> with {myScore} points.
                </p>
              ) : (
                <p className="mt-1 text-muted">Thanks for playing.</p>
              )}
            </div>
            <Podium rows={(final.length ? final : board).slice(0, 3)} meId={playerId} size="phone" />
            <Link to="/play" onClick={clearRejoin} className="w-full">
              <Button size="lg" block className="!h-14">
                Join another game
              </Button>
            </Link>
          </div>
        )}
      </main>
    </GameShell>
  );
};

const FeedbackPanel: React.FC<{
  tone: 'correct' | 'wrong' | 'missed';
  headline: string;
  detail: string;
  points: number;
  streak: number;
}> = ({ tone, headline, detail, points, streak }) => {
  const good = tone === 'correct';
  return (
    <div
      className={`${tone === 'wrong' ? 'game-shake' : 'game-pop'} rounded-3xl border-2 p-7 text-center ${
        good
          ? 'border-primary bg-primary text-ink'
          : tone === 'wrong'
            ? 'border-danger-border bg-danger-soft text-text'
            : 'border-border bg-panel text-text'
      }`}
    >
      <span
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
          good ? 'bg-ink text-primary' : tone === 'wrong' ? 'bg-danger text-ink' : 'bg-panel-3 text-muted'
        }`}
      >
        {good ? <Check className="h-9 w-9" strokeWidth={3.5} aria-hidden="true" /> : <X className="h-9 w-9" strokeWidth={3.5} aria-hidden="true" />}
      </span>
      <h1 className="mt-3 text-4xl font-extrabold">{headline}</h1>
      {good && points > 0 && <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">+{points}</p>}
      <p className={`mt-1 text-sm ${good ? 'text-ink/80' : 'text-muted'}`}>{detail}</p>
      {good && streak >= 2 && (
        <p className="mt-3 inline-block rounded-full bg-ink px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
          Streak x{streak}
        </p>
      )}
    </div>
  );
};

export default PlayerLiveBoard;
