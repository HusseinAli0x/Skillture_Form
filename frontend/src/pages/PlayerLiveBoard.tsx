import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import type { PublicQuizQuestion, QuizPlayer } from '../api/types';
import { playerSocketUrl } from '../api/ws';
import { optionLabel } from '../lib/i18n';
import { Card } from '../components/ui';

type ViewState = 'waiting' | 'question' | 'answered' | 'result' | 'leaderboard' | 'finished';

/**
 * Answer-tile colours. Deliberately the fixed game palette rather than theme
 * tokens — players identify an answer by its colour on both the host screen
 * and their own device, so these must not move with the brand.
 */
const ANSWER_COLORS = [
  'bg-red-500 hover:bg-red-600',
  'bg-blue-500 hover:bg-blue-600',
  'bg-yellow-500 hover:bg-yellow-600',
  'bg-green-500 hover:bg-green-600',
];

const RECONNECT_MS = 3000;
const LEADERBOARD_SIZE = 10;

interface Option {
  id: string;
  value: string;
}

const PlayerLiveBoard: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const playerId = searchParams.get('playerId');

  const [viewState, setViewState] = useState<ViewState>('waiting');
  const [leaderboard, setLeaderboard] = useState<QuizPlayer[]>([]);
  const [question, setQuestion] = useState<PublicQuizQuestion | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);
  const [scoreAwarded, setScoreAwarded] = useState(0);

  useEffect(() => {
    if (!sessionId || !playerId) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      ws = new WebSocket(playerSocketUrl(sessionId, playerId));

      ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'question':
              setQuestion(msg.payload);
              setOptions(
                Object.entries(msg.payload.options ?? {}).map(([id, opt]) => ({
                  id,
                  value: optionLabel(opt as never, id),
                }))
              );
              setStartTime(Date.now());
              setViewState('question');
              break;
            case 'show_leaderboard':
              setLeaderboard(msg.payload);
              setViewState('leaderboard');
              break;
            case 'game_finished':
              setViewState('finished');
              break;
            // 'leaderboard' and 'answer_result' are host-facing; this screen
            // waits for the explicit 'show_leaderboard' instead.
          }
        } catch (err) {
          console.error('Malformed game message', err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, RECONNECT_MS);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        // Clear onclose first, or tearing down schedules another reconnect.
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
        answer: { value },
        time_taken_ms: timeTaken,
      });

      setIsCorrect(res.data.is_correct);
      setScoreAwarded(res.data.score_awarded);
      setViewState('result');
    } catch (err: any) {
      console.error(err);
      // 409 is the already-answered guard; the score is not returned, so this
      // falls back to the result screen without one.
      setViewState(err.response?.status === 409 ? 'result' : 'waiting');
    }
  };

  const myRank = leaderboard.findIndex(row => row.id === playerId) + 1;

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col items-center justify-center p-6">
      {viewState === 'waiting' && (
        <div className="text-center space-y-6 animate-pulse">
          <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
          <h2 className="text-3xl font-bold">Get Ready!</h2>
          <p className="text-muted text-lg">Waiting for the host to show the next question on screen…</p>
        </div>
      )}

      {viewState === 'question' && question && (
        <div className="w-full max-w-2xl h-full flex flex-col gap-4">
          <Card className="rounded-3xl p-8 mb-4 text-center">
            <h2 className="text-2xl font-bold">Look at the screen!</h2>
            <p className="text-muted mt-2">Select your answer below.</p>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
            {options.map((opt, idx) => (
              <button
                key={opt.id}
                onClick={() => submitAnswer(opt.value)}
                className={`w-full aspect-video rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg transition-transform active:scale-95 ${
                  ANSWER_COLORS[idx % ANSWER_COLORS.length]
                }`}
              >
                <span className="px-4 text-center break-words drop-shadow-md">{opt.value}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {viewState === 'answered' && (
        <div className="text-center space-y-6">
          <Loader2 className="w-16 h-16 animate-spin text-muted mx-auto" />
          <h2 className="text-3xl font-bold">Answer Submitted!</h2>
          <p className="text-muted">Waiting for other players…</p>
        </div>
      )}

      {viewState === 'result' && (
        <div
          className={`text-center space-y-6 w-full max-w-md p-12 rounded-3xl shadow-2xl ${
            isCorrect ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
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

          <p className="text-white/80 mt-6 font-medium">Wait for the leaderboard…</p>
        </div>
      )}

      {viewState === 'leaderboard' && (
        <div className="w-full max-w-md space-y-6">
          <Card className="rounded-3xl p-6 shadow-2xl">
            <h2 className="text-3xl font-bold text-center mb-6 text-warning">
              Top {LEADERBOARD_SIZE} Leaders
            </h2>
            <div className="space-y-3">
              {leaderboard.slice(0, LEADERBOARD_SIZE).map((row, idx) => {
                const isMe = row.id === playerId;
                return (
                  <div
                    key={row.id}
                    className={`flex justify-between items-center p-4 rounded-xl ${
                      isMe ? 'bg-primary-border border border-primary' : 'bg-panel-2'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-muted w-6">{idx + 1}</span>
                      <span className={`font-bold ${isMe ? 'text-primary' : 'text-text'}`}>
                        {row.name} {isMe && '(You)'}
                      </span>
                    </div>
                    <span className="font-bold">{row.score}</span>
                  </div>
                );
              })}
            </div>

            {myRank > LEADERBOARD_SIZE && (
              <div className="mt-6 pt-6 border-t border-border text-center">
                <p className="text-xl text-muted">
                  Your Rank: <span className="font-bold text-text">#{myRank}</span>
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {viewState === 'finished' && (
        <div className="text-center space-y-6">
          <h2 className="text-4xl font-black text-primary">Game Over!</h2>
          <p className="text-text text-xl">Check the main screen to see the final podium.</p>
        </div>
      )}
    </div>
  );
};

export default PlayerLiveBoard;
