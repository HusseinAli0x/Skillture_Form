import { useEffect, useState } from 'react';
import { Copy, Check, Users, Play } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { hostSocketUrl } from '../api/ws';

export default function GameLobby() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [pin, setPin] = useState('');
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;

    // 1. Fetch session info to get the PIN
    client.get(`/api/v1/sessions/${sessionId}`)
      .then(res => {
        setPin(res.data.pin);
        if (res.data.status === 'active' || res.data.status === 'finished') {
          navigate(`/host/live/${sessionId}`);
        }
      })
      .catch(_err => {
        setError('Failed to load session details.');
      });

    // 1b. Fetch current players
    const fetchPlayers = () => {
      client.get(`/api/v1/sessions/${sessionId}/leaderboard`)
        .then(res => {
          // The leaderboard returns entities.QuizPlayer: {id, name, score, ...}
          setPlayers((res.data || []).map((p: any) => ({ id: p.id, name: p.name })));
        })
        .catch(console.error);
    };
    fetchPlayers();

    // 2. Connect WebSocket as Host
    const ws = new WebSocket(hostSocketUrl(sessionId));

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'player_joined') {
          // Refetch players to get the actual names
          fetchPlayers();
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);


  const handleStartGame = async () => {
    try {
      await client.patch(`/api/v1/sessions/${sessionId}/start`);
      navigate(`/host/live/${sessionId}`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error;
      if (errorMsg === 'session has already started') {
        navigate(`/host/live/${sessionId}`);
      } else {
        setError(errorMsg || 'Failed to start game');
      }
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in duration-500">
      
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm border" style={{ backgroundColor: 'rgba(224,85,85,0.08)', borderColor: 'rgba(224,85,85,0.25)', color: '#e05555' }}>
          {error}
        </div>
      )}

      {/* Join Link Display */}
      <div className="text-center space-y-4">
        <p className="text-xl font-medium" style={{ color: '#888' }}>Share this link with players to join:</p>
        <div 
          className="relative group flex items-center justify-center cursor-pointer bg-[#141414] border border-[#2a2a2a] p-6 rounded-2xl transition hover:bg-[#1a1a1a]"
          onClick={() => {
            const link = `${window.location.origin}/play?pin=${pin}`;
            navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <h2 className="text-3xl md:text-4xl font-bold" style={{ color: '#0ABFBC' }}>
            {`${window.location.origin}/play?pin=${pin}`}
          </h2>
          <div className="absolute -right-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-3 rounded-xl bg-[#2a2a2a]">
            {copied ? <Check className="w-6 h-6 text-green-500" /> : <Copy className="w-6 h-6 text-slate-300" />}
          </div>
        </div>
        <p className="text-gray-500 mt-2">Players will only need to enter their name.</p>

        {pin && (
          <div className="flex justify-center mt-8">
            <div className="bg-white p-4 rounded-xl shadow-lg inline-block">
              <QRCodeSVG 
                value={`${window.location.origin}/play?pin=${pin}`}
                size={200}
                bgColor="#ffffff"
                fgColor="#000000"
                level="Q"
                includeMargin={false}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-4 w-full max-w-md pt-8">
        <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
          <Users className="w-5 h-5" style={{ color: '#888' }} />
          <span className="font-semibold text-lg" style={{ color: '#f0f0f0' }}>{players.length} Players</span>
        </div>
        <button 
          onClick={handleStartGame}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold transition-all transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: '#0ABFBC', color: '#0a0a0a' }}
        >
          <Play className="w-5 h-5" fill="currentColor" />
          Start Game
        </button>
      </div>

      {/* Players Grid */}
      <div className="w-full max-w-4xl pt-8">
        <div className="flex flex-wrap justify-center gap-3">
          {players.map((p, i) => (
            <div 
              key={i}
              className="px-4 py-2 rounded-lg font-medium animate-in zoom-in duration-300 border"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: '#2a2a2a', color: '#f0f0f0' }}
            >
              {p.name}
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-center w-full mt-8 animate-pulse" style={{ color: '#888' }}>Waiting for players to join...</p>
          )}
        </div>
      </div>
    </div>
  );
}
