import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Flag, Play, SkipForward, Trophy, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import client from '../api/client';
import type { QuizPlayer, QuizQuestion, QuizSession } from '../api/types';
import { hostSocketUrl } from '../api/ws';
import { localized } from '../lib/i18n';
import { Button, Card } from '../components/ui';

type ViewState = 'lobby' | 'question' | 'leaderboard' | 'finished';

const HostLiveBoard: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<QuizSession | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<QuizPlayer[]>([]);
  const [viewState, setViewState] = useState<ViewState>('lobby');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Both the timer and the "everyone answered" effect can fire showLeaderboard
  // in the same tick. A ref guard is used rather than reading viewState, which
  // would be a stale value captured when the callback was created.
  const publishingRef = useRef(false);

  const showLeaderboard = useCallback(async () => {
    if (publishingRef.current) return;
    publishingRef.current = true;
    try {
      // Also broadcasts the leaderboard to every player.
      const res = await client.post(`/api/v1/sessions/${sessionId}/show_results`);
      setLeaderboard(res.data.leaderboard || []);
      setViewState('leaderboard');
    } catch (err) {
      console.error(err);
      publishingRef.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    if (viewState === 'question' && players.length > 0 && answeredCount >= players.length) {
      showLeaderboard();
    }
  }, [answeredCount, players.length, viewState, showLeaderboard]);

  useEffect(() => {
    if (viewState !== 'question' || timeLeft === null) return;
    if (timeLeft <= 0) {
      showLeaderboard();
      return;
    }
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, viewState, showLeaderboard]);

  useEffect(() => {
    if (!sessionId) return;

    client
      .get<QuizSession>(`/api/v1/sessions/${sessionId}`)
      .then(async res => {
        setSession(res.data);
        const questionsRes = await client.get<QuizQuestion[]>(
          `/api/v1/quizzes/${res.data.quiz_id}/questions`
        );
        const sorted = (questionsRes.data || []).sort((a, b) => a.position - b.position);
        setQuestions(sorted);

        if (res.data.status === 'finished') {
          setViewState('finished');
        } else if (res.data.status === 'active' && res.data.current_question_id) {
          const idx = sorted.findIndex(q => q.id === res.data.current_question_id);
          if (idx !== -1) {
            setCurrentIndex(idx);
            setViewState('question');
          }
        }
      })
      .catch(console.error);

    // Seed the roster. Players who joined the lobby before this board mounted
    // never send a player_joined event here, so without this the count stays 0
    // and the "everyone answered" auto-advance can never fire.
    client
      .get<QuizPlayer[]>(`/api/v1/sessions/${sessionId}/leaderboard`)
      .then(res => setPlayers(res.data || []))
      .catch(console.error);

    const ws = new WebSocket(hostSocketUrl(sessionId));
    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'player_joined') {
          setPlayers(prev =>
            prev.some(p => p.id === msg.payload.player_id)
              ? prev
              : [...prev, { ...msg.payload, id: msg.payload.player_id, name: msg.payload.name || 'New Player' }]
          );
        } else if (msg.type === 'answer_result') {
          setAnsweredCount(prev => prev + 1);
        } else if (msg.type === 'leaderboard') {
          setLeaderboard(msg.payload);
        }
      } catch (err) {
        console.error(err);
      }
    };

    return () => ws.close();
  }, [sessionId]);

  const handleFinishGame = useCallback(async () => {
    try {
      await client.patch(`/api/v1/sessions/${sessionId}/finish`);
      setViewState('finished');
    } catch (err) {
      console.error(err);
    }
  }, [sessionId]);

  const handleNextQuestion = async () => {
    if (questions.length === 0) return;
    const nextIdx = currentIndex + 1;
    if (nextIdx >= questions.length) {
      handleFinishGame();
      return;
    }

    try {
      await client.patch(`/api/v1/sessions/${sessionId}/advance`, {
        question_id: questions[nextIdx].id,
      });
      setCurrentIndex(nextIdx);
      setAnsweredCount(0);
      publishingRef.current = false; // re-arm the leaderboard trigger
      setTimeLeft(questions[nextIdx].time_limit_sec > 0 ? questions[nextIdx].time_limit_sec : null);
      setViewState('question');
    } catch (err) {
      console.error(err);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-text">Loading…</p>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col p-8">
      <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
        <h1 className="text-3xl font-bold text-primary">Host Live Board</h1>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-panel-2 px-4 py-2 rounded-xl border border-border">
            <Users className="w-5 h-5 text-muted" />
            <span className="font-bold">{players.length} Players</span>
          </div>
          {viewState !== 'finished' && (
            <Button variant="danger" onClick={handleFinishGame}>
              <Flag className="w-5 h-5" /> End Game
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {viewState === 'lobby' && (
          <div className="text-center space-y-6">
            <h2 className="text-4xl font-black mb-4">Ready to start?</h2>
            <p className="text-muted mb-8">Waiting for you to begin the first question.</p>
            <Button onClick={handleNextQuestion} className="!text-2xl !px-12 !py-6 !rounded-2xl mx-auto">
              <Play className="w-8 h-8" fill="currentColor" /> Start Quiz
            </Button>
          </div>
        )}

        {viewState === 'question' && currentQ && (
          <div className="w-full max-w-5xl space-y-12">
            <Card className="rounded-3xl p-12 text-center shadow-2xl relative">
              <div className="absolute top-4 right-4 bg-bg px-4 py-2 rounded-full border border-border text-primary font-bold">
                {currentIndex + 1} / {questions.length}
              </div>
              <h2 className="text-4xl font-bold">{localized(currentQ.question)}</h2>
              {timeLeft !== null && (
                <div
                  className={`mt-6 font-mono text-5xl font-black ${
                    timeLeft <= 5 ? 'text-danger animate-pulse' : 'text-primary'
                  }`}
                >
                  {timeLeft}
                </div>
              )}
            </Card>

            <div className="flex justify-between items-center bg-panel-2 p-6 rounded-2xl border border-border">
              <div className="text-xl font-medium">
                <span className="text-primary font-bold text-3xl">{answeredCount}</span> answers submitted
              </div>

              <div className="flex gap-4">
                <Button variant="secondary" size="lg" onClick={showLeaderboard}>
                  Show Leaderboard
                </Button>
                <Button size="lg" onClick={handleNextQuestion}>
                  Next Question <SkipForward className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {viewState === 'leaderboard' && (
          <div className="w-full max-w-3xl space-y-8">
            <h2 className="text-4xl font-bold text-center flex items-center justify-center gap-4">
              <Trophy className="w-10 h-10 text-warning" /> Leaderboard
            </h2>
            <div className="space-y-4">
              {leaderboard.length === 0 ? (
                <p className="text-center text-muted text-xl">No scores yet!</p>
              ) : (
                leaderboard.map((row, idx) => (
                  <Card key={row.id} className="flex justify-between items-center p-6 rounded-2xl">
                    <div className="flex items-center gap-6">
                      <span className="text-2xl font-black text-muted w-8 text-center">{idx + 1}</span>
                      <span className="text-2xl font-bold">{row.name}</span>
                    </div>
                    <span className="text-2xl font-bold text-primary">{row.score} pts</span>
                  </Card>
                ))
              )}
            </div>
            <div className="flex justify-center mt-8">
              <Button size="lg" onClick={handleNextQuestion} className="!text-xl !px-12 !py-4">
                Continue <SkipForward className="w-6 h-6" />
              </Button>
            </div>
          </div>
        )}

        {viewState === 'finished' && (
          <div className="text-center space-y-8">
            <Trophy className="w-24 h-24 text-warning mx-auto" />
            <h2 className="text-5xl font-black">Game Finished!</h2>
            <Button variant="secondary" size="lg" onClick={() => navigate('/admin/quizzes')}>
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HostLiveBoard;
