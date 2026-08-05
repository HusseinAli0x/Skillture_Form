import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Play, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import type { QuizPlayer } from '../api/types';
import { hostSocketUrl } from '../api/ws';
import { gameJoinUrl } from '../lib/links';
import { Button, Card } from '../components/ui';

const GameLobby: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [pin, setPin] = useState('');
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPlayers = useCallback(() => {
    client
      .get<QuizPlayer[]>(`/api/v1/sessions/${sessionId}/leaderboard`)
      .then(res => setPlayers(res.data || []))
      .catch(console.error);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    client
      .get(`/api/v1/sessions/${sessionId}`)
      .then(res => {
        setPin(res.data.pin);
        if (res.data.status === 'active' || res.data.status === 'finished') {
          navigate(`/host/live/${sessionId}`);
        }
      })
      .catch(() => setError('Failed to load session details.'));

    fetchPlayers();

    const ws = new WebSocket(hostSocketUrl(sessionId));
    ws.onmessage = event => {
      try {
        // player_joined carries the name, but a refetch also picks up anyone
        // who joined between the initial load and this socket opening.
        if (JSON.parse(event.data).type === 'player_joined') fetchPlayers();
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    return () => ws.close();
  }, [sessionId, navigate, fetchPlayers]);

  useEffect(
    () => () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    },
    []
  );

  const joinUrl = gameJoinUrl(pin);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      copyTimeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is denied outside a secure context; the link is on
      // screen so the host can still read it out.
    }
  };

  const handleStartGame = async () => {
    try {
      await client.patch(`/api/v1/sessions/${sessionId}/start`);
      navigate(`/host/live/${sessionId}`);
    } catch (err: any) {
      const message = err.response?.data?.error;
      if (message === 'session has already started') {
        navigate(`/host/live/${sessionId}`);
      } else {
        setError(message || 'Failed to start game');
      }
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 space-y-8">
      {error && (
        <div role="alert" className="px-4 py-3 rounded-lg text-sm border bg-danger-soft border-danger-border text-danger">
          {error}
        </div>
      )}

      <div className="text-center space-y-4">
        <p className="text-xl font-medium text-muted">Share this link with players to join:</p>
        <button
          onClick={handleCopy}
          aria-label="Copy join link"
          className="relative group flex items-center justify-center w-full bg-panel border border-border p-6 rounded-2xl transition-colors hover:bg-panel-2"
        >
          <span className="text-3xl md:text-4xl font-bold text-primary break-all">{joinUrl}</span>
          <span className="absolute -right-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-3 rounded-xl bg-panel-3">
            {copied ? <Check className="w-6 h-6 text-success" /> : <Copy className="w-6 h-6 text-text" />}
          </span>
        </button>
        <p className="text-muted mt-2">Players will only need to enter their name.</p>

        {pin && (
          <div className="flex justify-center mt-8">
            {/* The QR code needs a light background to stay scannable. */}
            <div className="bg-white p-4 rounded-xl shadow-lg inline-block">
              <QRCodeSVG value={joinUrl} size={200} level="Q" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 w-full max-w-md pt-8">
        <Card className="flex-1 flex items-center gap-3 px-4 py-3">
          <Users className="w-5 h-5 text-muted" />
          <span className="font-semibold text-lg text-text">{players.length} Players</span>
        </Card>
        <Button size="lg" onClick={handleStartGame} className="flex-1">
          <Play className="w-5 h-5" fill="currentColor" />
          Start Game
        </Button>
      </div>

      <div className="w-full max-w-4xl pt-8">
        <div className="flex flex-wrap justify-center gap-3">
          {players.map(player => (
            <div
              key={player.id}
              className="px-4 py-2 rounded-lg font-medium border bg-hover-overlay-strong border-border text-text"
            >
              {player.name}
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-center w-full mt-8 animate-pulse text-muted">Waiting for players to join…</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameLobby;
