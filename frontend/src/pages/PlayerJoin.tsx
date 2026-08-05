import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Gamepad2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { apiErrorMessage } from '../lib/apiError';
import { playerSocketUrl } from '../api/ws';
import { Button, Card, Spinner } from '../components/ui';

type Step = 'pin' | 'nickname' | 'waiting';

/** Reconnect delay for the lobby socket. */
const RECONNECT_MS = 3000;

const PlayerJoin: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialPin = searchParams.get('pin') || '';

  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState(initialPin);
  const [nickname, setNickname] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const lookupPin = useCallback(async (candidate: string) => {
    if (!candidate) return;
    setError('');
    setIsJoining(true);
    try {
      const res = await client.get(`/api/v1/sessions/pin/${candidate}`);
      setSessionId(res.data.id);
      setStep('nickname');
    } catch (err) {
      setError(apiErrorMessage(err, 'Invalid Game PIN'));
    } finally {
      setIsJoining(false);
    }
  }, []);

  // A ?pin= in the URL is looked up straight away. The page used to jump to
  // the nickname step before the lookup ran, so an invalid PIN left the player
  // typing a nickname with no session to join it to.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!initialPin || autoJoined.current) return;
    autoJoined.current = true;
    lookupPin(initialPin);
  }, [initialPin, lookupPin]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookupPin(pin);
  };

  const handleNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname) return;
    setError('');
    setIsJoining(true);
    try {
      const res = await client.post(`/api/v1/sessions/${sessionId}/players`, { name: nickname });
      setPlayerId(res.data.id);
      setStep('waiting');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to join. Nickname might be taken.'));
    } finally {
      setIsJoining(false);
    }
  };

  // Wait in the lobby until the host starts, then follow into the game.
  useEffect(() => {
    if (step !== 'waiting' || !sessionId || !playerId) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      ws = new WebSocket(playerSocketUrl(sessionId, playerId));

      ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data);
          const started =
            msg.type === 'game_started' ||
            msg.type === 'question_active' ||
            (msg.type === 'lobby_snapshot' && msg.payload?.status && msg.payload.status !== 'lobby');
          if (started) navigate(`/play/${sessionId}?playerId=${playerId}`);
        } catch (err) {
          console.error('Malformed lobby message', err);
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
  }, [step, sessionId, playerId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center bg-primary-soft border border-primary-border">
            <Gamepad2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text">Skillture Quiz</h1>
        </div>

        <Card className="p-8 rounded-3xl shadow-2xl space-y-6">
          {error && (
            <div
              role="alert"
              className="px-4 py-3 rounded-xl text-sm border font-medium text-center bg-danger-soft border-danger-border text-danger"
            >
              {error}
            </div>
          )}

          {step === 'pin' && (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Game PIN"
                aria-label="Game PIN"
                value={pin}
                onChange={e => setPin(e.target.value.toUpperCase())}
                className="w-full text-center text-3xl font-black tracking-widest py-4 rounded-xl outline-none transition-colors placeholder:font-normal placeholder:text-xl bg-bg text-text border-2 border-border focus:border-primary"
                autoFocus
              />
              <Button type="submit" size="lg" variant="secondary" block disabled={!pin} loading={isJoining}>
                {isJoining ? 'Finding Game…' : 'Enter'}
                {!isJoining && <ArrowRight className="w-5 h-5" />}
              </Button>
            </form>
          )}

          {step === 'nickname' && (
            <form onSubmit={handleNicknameSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Nickname"
                aria-label="Nickname"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="w-full text-center text-2xl font-bold py-4 rounded-xl outline-none transition-colors placeholder:font-normal placeholder:text-xl bg-bg text-text border-2 border-border focus:border-primary"
                autoFocus
              />
              <Button type="submit" size="lg" block disabled={!nickname} loading={isJoining}>
                {isJoining ? 'Joining…' : 'Join Game'}
              </Button>
            </form>
          )}

          {step === 'waiting' && (
            <div className="text-center space-y-6 py-4">
              <Spinner size="w-16 h-16" className="border-4" />
              <div>
                <h2 className="text-xl font-bold mb-2 text-text">You're in!</h2>
                <p className="text-lg font-medium text-primary">{nickname}</p>
              </div>
              <p className="font-medium animate-pulse text-muted">See your nickname on screen</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PlayerJoin;
