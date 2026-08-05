import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { playerSocketUrl } from '../api/ws';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const COLORS = ['bg-red-500 hover:bg-red-600', 'bg-blue-500 hover:bg-blue-600', 'bg-yellow-500 hover:bg-yellow-600', 'bg-green-500 hover:bg-green-600'];

export default function PlayerLiveBoard() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const playerId = searchParams.get('playerId');

  const [viewState, setViewState] = useState<'waiting' | 'question' | 'answered' | 'result' | 'leaderboard' | 'finished'>('waiting');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  
  const [question, setQuestion] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [startTime, setStartTime] = useState<number>(0);

  // Result state
  const [isCorrect, setIsCorrect] = useState(false);
  const [scoreAwarded, setScoreAwarded] = useState(0);

  useEffect(() => {
    if (!sessionId || !playerId) return;
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      ws = new WebSocket(playerSocketUrl(sessionId, playerId));

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'question') {
            // New question starts
            setQuestion(msg.payload);
            
            if (msg.payload.options) {
              const opts = Object.keys(msg.payload.options).map(k => ({
                id: k,
                value: msg.payload.options[k].value || msg.payload.options[k].en || ''
              }));
              setOptions(opts);
            } else {
              setOptions([]);
            }

            setStartTime(Date.now());
            setViewState('question');
            
          } else if (msg.type === 'leaderboard' || msg.type === 'answer_result') {
            // End of question or someone answered, wait for next step
            // We ignore this here because we wait for 'show_leaderboard'
          } else if (msg.type === 'show_leaderboard') {
            setLeaderboard(msg.payload);
            setViewState('leaderboard');
          } else if (msg.type === 'game_finished') {
            setViewState('finished');
          } else if (msg.type === 'lobby_snapshot') {
            // If we joined mid-game and there's a question active, it might be in the snapshot
            if (msg.payload.status === 'active' && msg.payload.current_question_id) {
              // Ideally the backend sends the current question. If not, we just wait for the next event.
              setViewState('waiting');
            }
          }
        } catch (e) {
          console.error('WebSocket Error', e);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };
    };

    connectWS();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [sessionId, playerId]);

  const submitAnswer = async (value: string) => {
    if (!question || viewState !== 'question') return;

    setViewState('answered');
    const timeTaken = Date.now() - startTime;

    try {
      // player_id and question_id are `binding:"required"` on the handler —
      // omitting them makes every submission 400.
      const res = await client.post(`/api/v1/sessions/${sessionId}/answer`, {
        player_id: playerId,
        question_id: question.id,
        answer: { value: value },
        time_taken_ms: timeTaken
      });
      
      setIsCorrect(res.data.is_correct);
      setScoreAwarded(res.data.score_awarded);
      setViewState('result');
      
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 409) {
        // Already answered
        setViewState('result'); // we don't have the score from here, but this is a fallback
      } else {
        setViewState('waiting');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      
      {viewState === 'waiting' && (
        <div className="text-center space-y-6 animate-pulse">
          <Loader2 className="w-16 h-16 animate-spin text-[#0ABFBC] mx-auto" />
          <h2 className="text-3xl font-bold">Get Ready!</h2>
          <p className="text-gray-400 text-lg">Waiting for the host to show the next question on screen...</p>
        </div>
      )}

      {viewState === 'question' && question && (
        <div className="w-full max-w-2xl w-full h-full flex flex-col gap-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-3xl p-8 mb-4 text-center">
             <h2 className="text-2xl font-bold">Look at the screen!</h2>
             <p className="text-gray-400 mt-2">Select your answer below.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
            {options.map((opt, idx) => (
              <button
                key={opt.id}
                onClick={() => submitAnswer(opt.value)}
                className={`w-full aspect-video rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg transition-transform transform active:scale-95 ${COLORS[idx % COLORS.length]}`}
              >
                {/* On real Kahoot, they only show shapes, but showing text is more accessible */}
                <span className="px-4 text-center break-words drop-shadow-md">{opt.value}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {viewState === 'answered' && (
        <div className="text-center space-y-6">
          <Loader2 className="w-16 h-16 animate-spin text-gray-400 mx-auto" />
          <h2 className="text-3xl font-bold">Answer Submitted!</h2>
          <p className="text-gray-400">Waiting for other players...</p>
        </div>
      )}

      {viewState === 'result' && (
        <div className={`text-center space-y-6 w-full max-w-md p-12 rounded-3xl shadow-2xl ${isCorrect ? 'bg-green-600' : 'bg-red-600'}`}>
          {isCorrect ? (
            <CheckCircle2 className="w-24 h-24 mx-auto text-white drop-shadow-lg" />
          ) : (
            <XCircle className="w-24 h-24 mx-auto text-white drop-shadow-lg" />
          )}
          <h2 className="text-5xl font-black text-white">{isCorrect ? 'Correct!' : 'Incorrect'}</h2>
          
          {isCorrect && (
            <div className="mt-8 bg-black/20 py-4 rounded-xl">
              <p className="text-white font-bold text-2xl">+{Math.round(scoreAwarded)}</p>
            </div>
          )}
          
          <p className="text-white/80 mt-6 font-medium">Wait for the leaderboard...</p>
        </div>
      )}

      {viewState === 'leaderboard' && (
        <div className="w-full max-w-md space-y-6">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-3xl p-6 shadow-2xl">
            <h2 className="text-3xl font-bold text-center mb-6 text-yellow-400">Top 10 Leaders</h2>
            <div className="space-y-3">
              {leaderboard.slice(0, 10).map((lb: any, idx: number) => {
                const isMe = lb.id === playerId;
                return (
                  <div key={lb.id} className={`flex justify-between items-center p-4 rounded-xl ${isMe ? 'bg-[#0ABFBC]/20 border border-[#0ABFBC]' : 'bg-[#1a1a1a]'}`}>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-gray-500 w-6">{idx + 1}</span>
                      <span className={`font-bold ${isMe ? 'text-[#0ABFBC]' : 'text-white'}`}>{lb.name} {isMe && '(You)'}</span>
                    </div>
                    <span className="font-bold">{lb.score}</span>
                  </div>
                );
              })}
            </div>
            
            {/* Show my rank if I am not in Top 10 */}
            {(() => {
              const myRank = leaderboard.findIndex((lb: any) => lb.id === playerId) + 1;
              if (myRank > 10) {
                return (
                  <div className="mt-6 pt-6 border-t border-[#2a2a2a] text-center">
                    <p className="text-xl text-gray-400">Your Rank: <span className="font-bold text-white">#{myRank}</span></p>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}

      {viewState === 'finished' && (
        <div className="text-center space-y-6">
          <h2 className="text-4xl font-black text-[#0ABFBC]">Game Over!</h2>
          <p className="text-gray-300 text-xl">Check the main screen to see the final podium.</p>
        </div>
      )}

    </div>
  );
}
