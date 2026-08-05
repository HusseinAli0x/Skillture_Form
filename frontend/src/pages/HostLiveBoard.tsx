import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { hostSocketUrl } from '../api/ws';
import { Users, Play, SkipForward, Flag, Trophy } from 'lucide-react';

// Field names must match entities.QuizQuestion — the backend sends
// `question` and `position`, not `title`/`order_index`.
interface Question {
  id: string;
  question: Record<string, string>;
  type: number;
  options: any;
  time_limit_sec: number;
  position: number;
}

export default function HostLiveBoard() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [viewState, setViewState] = useState<'lobby' | 'question' | 'leaderboard' | 'finished'>('lobby');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Both the timer and the "everyone answered" effect can fire showLeaderboard
  // in the same tick. A ref guard is used rather than reading viewState, which
  // would be a stale value captured when the callback was created.
  const publishingRef = useRef(false);

  const showLeaderboard = useCallback(async () => {
    if (publishingRef.current) return;
    publishingRef.current = true;
    try {
      // Fetch and trigger broadcast to all players
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

    // Fetch session and then questions
    client.get(`/api/v1/sessions/${sessionId}`).then(res => {
      setSession(res.data);
      return Promise.all([res.data, client.get(`/api/v1/quizzes/${res.data.quiz_id}/questions`)]);
    }).then(([sessionData, questionsRes]) => {
      const questionsData = questionsRes.data || [];
      const sorted = questionsData.sort((a: Question, b: Question) => a.position - b.position);
      setQuestions(sorted);

      if (sessionData.status === 'finished') {
        setViewState('finished');
      } else if (sessionData.status === 'active') {
        if (sessionData.current_question_id) {
          const idx = sorted.findIndex((q: Question) => q.id === sessionData.current_question_id);
          if (idx !== -1) {
            setCurrentIndex(idx);
            setViewState('question');
          } else {
            setViewState('lobby');
          }
        } else {
          setViewState('lobby');
        }
      }
    }).catch(err => console.error(err));

    // Seed the roster. Players who joined the lobby before this board mounted
    // never send a player_joined event here, so without this the count stays 0
    // and the "everyone answered" auto-advance can never fire.
    client.get(`/api/v1/sessions/${sessionId}/leaderboard`)
      .then(res => setPlayers((res.data || []).map((p: any) => ({ id: p.id, name: p.name }))))
      .catch(err => console.error(err));

    // Connect WebSocket
    const ws = new WebSocket(hostSocketUrl(sessionId));

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'player_joined') {
          setPlayers(prev => {
            if (prev.find(p => p.id === msg.payload.player_id)) return prev;
            return [...prev, { id: msg.payload.player_id, name: msg.payload.name || 'New Player' }];
          });
        } else if (msg.type === 'answer_result') {
          // Increment answered count when a player submits
          setAnsweredCount(prev => prev + 1);
        } else if (msg.type === 'leaderboard') {
          setLeaderboard(msg.payload);
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => ws.close();
  }, [sessionId]);

  const handleNextQuestion = async () => {
    if (questions.length === 0) return;
    const nextIdx = currentIndex + 1;
    if (nextIdx >= questions.length) {
      // Game over
      handleFinishGame();
      return;
    }

    try {
      await client.patch(`/api/v1/sessions/${sessionId}/advance`, {
        question_id: questions[nextIdx].id
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

  const handleFinishGame = async () => {
    try {
      await client.patch(`/api/v1/sessions/${sessionId}/finish`);
      setViewState('finished');
    } catch (err) {
      console.error(err);
    }
  };

  if (!session) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><p className="text-white">Loading...</p></div>;

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-[#2a2a2a] pb-4">
        <h1 className="text-3xl font-bold text-[#0ABFBC]">Host Live Board</h1>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-[#1a1a1a] px-4 py-2 rounded-xl border border-[#2a2a2a]">
            <Users className="w-5 h-5 text-gray-400" />
            <span className="font-bold">{players.length} Players</span>
          </div>
          {viewState !== 'finished' && (
            <button onClick={handleFinishGame} className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800 text-red-200 px-4 py-2 rounded-xl transition">
              <Flag className="w-5 h-5" /> End Game
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        
        {viewState === 'lobby' && (
          <div className="text-center space-y-6">
            <h2 className="text-4xl font-black mb-4">Ready to start?</h2>
            <p className="text-gray-400 mb-8">Waiting for you to begin the first question.</p>
            <button 
              onClick={handleNextQuestion}
              className="bg-[#0ABFBC] text-black font-bold text-2xl px-12 py-6 rounded-2xl hover:bg-[#09a8a5] transition flex items-center gap-3 mx-auto"
            >
              <Play className="w-8 h-8 fill-black" /> Start Quiz
            </button>
          </div>
        )}

        {viewState === 'question' && currentQ && (
          <div className="w-full max-w-5xl space-y-12">
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-3xl p-12 text-center shadow-2xl relative">
              <div className="absolute top-4 right-4 bg-[#0a0a0a] px-4 py-2 rounded-full border border-[#2a2a2a] text-[#0ABFBC] font-bold">
                {currentIndex + 1} / {questions.length}
              </div>
              <h2 className="text-4xl font-bold">{currentQ.question?.en || currentQ.question?.ar}</h2>
              {timeLeft !== null && (
                <div className={`mt-6 font-mono text-5xl font-black ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-[#0ABFBC]'}`}>
                  {timeLeft}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center bg-[#1a1a1a] p-6 rounded-2xl border border-[#2a2a2a]">
              <div className="text-xl font-medium">
                <span className="text-[#0ABFBC] font-bold text-3xl">{answeredCount}</span> answers submitted
              </div>
              
              <div className="flex gap-4">
                <button onClick={showLeaderboard} className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-xl font-bold transition">
                  Show Leaderboard
                </button>
                <button onClick={handleNextQuestion} className="bg-[#0ABFBC] text-black px-8 py-3 rounded-xl font-bold transition flex items-center gap-2">
                  Next Question <SkipForward className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {viewState === 'leaderboard' && (
          <div className="w-full max-w-3xl space-y-8">
            <h2 className="text-4xl font-bold text-center flex items-center justify-center gap-4">
              <Trophy className="w-10 h-10 text-yellow-400" /> Leaderboard
            </h2>
            <div className="space-y-4">
              {leaderboard.length === 0 ? (
                <p className="text-center text-gray-400 text-xl">No scores yet!</p>
              ) : (
                leaderboard.map((lb: any, idx: number) => (
                  <div key={lb.id} className="flex justify-between items-center bg-[#141414] border border-[#2a2a2a] p-6 rounded-2xl">
                    <div className="flex items-center gap-6">
                      <span className="text-2xl font-black text-gray-500 w-8 text-center">{idx + 1}</span>
                      <span className="text-2xl font-bold">{lb.name}</span>
                    </div>
                    <span className="text-2xl font-bold text-[#0ABFBC]">{lb.score} pts</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-center mt-8">
              <button onClick={handleNextQuestion} className="bg-[#0ABFBC] text-black px-12 py-4 rounded-xl font-bold text-xl transition flex items-center gap-2">
                Continue <SkipForward className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {viewState === 'finished' && (
          <div className="text-center space-y-8">
            <Trophy className="w-24 h-24 text-yellow-400 mx-auto" />
            <h2 className="text-5xl font-black">Game Finished!</h2>
            <button onClick={() => navigate('/admin/quizzes')} className="bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#3a3a3a] px-8 py-4 rounded-xl font-bold transition">
              Back to Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
