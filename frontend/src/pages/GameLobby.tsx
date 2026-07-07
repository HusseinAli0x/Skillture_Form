import { useEffect, useState } from 'react';
import { Users, Play, Copy, Check } from 'lucide-react';
import { useParams } from 'react-router-dom';
import client from '../api/client';

export default function GameLobby() {
  const { id } = useParams<{ id: string }>();
  
  const [pin, setPin] = useState('');
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 1. Fetch session info to get the PIN
    client.get(`/api/v1/sessions/${id}`)
      .then(res => {
        setPin(res.data.pin);
      })
      .catch(_err => {
        setError('Failed to load session details.');
      });

    // 2. Connect WebSocket as Host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; 
    // Assuming backend is on port 8080 during dev. In production, proxy handles /ws
    const wsUrl = import.meta.env.DEV 
      ? `ws://localhost:8080/ws/sessions/${id}/host`
      : `${protocol}//${host}/ws/sessions/${id}/host`;
      
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'player_joined') {
          // Add player to the list.
          setPlayers(prev => [...prev, { id: msg.payload.player_id, name: msg.payload.name || 'New Player' }]);
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = async () => {
    try {
      await client.patch(`/api/v1/sessions/${id}/start`);
      alert('Game Started! Transitioning to live board (coming soon...)');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start game');
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in duration-500">
      
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm border" style={{ backgroundColor: 'rgba(224,85,85,0.08)', borderColor: 'rgba(224,85,85,0.25)', color: '#e05555' }}>
          {error}
        </div>
      )}

      {/* PIN Display */}
      <div className="text-center space-y-3">
        <p className="text-lg font-medium" style={{ color: '#888' }}>Join at <span className="text-white">skillture.com/join</span> with PIN:</p>
        <div 
          className="relative group flex items-center justify-center cursor-pointer"
          onClick={handleCopy}
        >
          <h1 className="text-7xl md:text-9xl font-black tracking-widest" style={{ color: '#0ABFBC', textShadow: '0 0 40px rgba(10,191,188,0.3)' }}>
            {pin || '------'}
          </h1>
          <div className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-slate-400" />}
          </div>
        </div>
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
