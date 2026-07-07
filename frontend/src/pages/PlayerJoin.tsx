import { useState, useEffect } from 'react';
import { Gamepad2, ArrowRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import client from '../api/client';

export default function PlayerJoin() {
  const [searchParams] = useSearchParams();
  const initialPin = searchParams.get('pin') || '';

  const [step, setStep] = useState<1 | 2 | 3>(initialPin ? 2 : 1);
  const [pin, setPin] = useState(initialPin);
  const [nickname, setNickname] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // If provided via URL
  useEffect(() => {
    if (initialPin && step === 2) {
      handlePinSubmit(new Event('submit') as any, initialPin);
    }
  }, []);

  const handlePinSubmit = async (e: React.FormEvent, submitPin = pin) => {
    e.preventDefault();
    if (!submitPin) return;
    setError('');
    setIsJoining(true);
    try {
      const res = await client.get(`/api/v1/sessions/pin/${submitPin}`);
      setSessionId(res.data.id);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid Game PIN');
    } finally {
      setIsJoining(false);
    }
  };

  const handleNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname) return;
    setError('');
    setIsJoining(true);
    try {
      const res = await client.post(`/api/v1/sessions/${sessionId}/players`, { name: nickname });
      setPlayerId(res.data.id);
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join. Nickname might be taken.');
    } finally {
      setIsJoining(false);
    }
  };

  // Step 3: Waiting in Lobby
  useEffect(() => {
    if (step === 3 && sessionId && playerId) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host; 
      const wsUrl = import.meta.env.DEV 
        ? `ws://localhost:8080/ws/sessions/${sessionId}/join?player_id=${playerId}`
        : `${protocol}//${host}/ws/sessions/${sessionId}/join?player_id=${playerId}`;
        
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'game_started' || msg.type === 'question_active') {
            // navigate(`/play/${sessionId}?playerId=${playerId}`);
            alert('Game started! (Transitioning to live board)');
          }
        } catch (e) {
          console.error(e);
        }
      };

      return () => ws.close();
    }
  }, [step, sessionId, playerId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo/Icon */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ backgroundColor: 'rgba(10,191,188,0.1)', border: '1px solid rgba(10,191,188,0.2)' }}>
            <Gamepad2 className="w-10 h-10" style={{ color: '#0ABFBC' }} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#f0f0f0' }}>Skillture Quiz</h1>
        </div>

        {/* Card */}
        <div className="p-8 rounded-3xl border shadow-2xl space-y-6" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
          
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm border font-medium text-center" style={{ backgroundColor: 'rgba(224,85,85,0.08)', borderColor: 'rgba(224,85,85,0.25)', color: '#e05555' }}>
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <input 
                  type="text"
                  placeholder="Game PIN"
                  value={pin}
                  onChange={e => setPin(e.target.value.toUpperCase())}
                  className="w-full text-center text-3xl font-black tracking-widest py-4 rounded-xl outline-none transition-all placeholder:font-normal placeholder:text-xl"
                  style={{ backgroundColor: '#0a0a0a', border: '2px solid #2a2a2a', color: '#f0f0f0' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                  onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                  autoFocus
                />
              </div>
              <button 
                type="submit"
                disabled={!pin || isJoining}
                className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                onMouseEnter={e => { if (!isJoining && pin) { e.currentTarget.style.backgroundColor = '#0ABFBC'; e.currentTarget.style.color = '#0a0a0a'; e.currentTarget.style.borderColor = '#0ABFBC'; } }}
                onMouseLeave={e => { if (!isJoining || !pin) { e.currentTarget.style.backgroundColor = '#0a0a0a'; e.currentTarget.style.color = '#f0f0f0'; e.currentTarget.style.borderColor = '#2a2a2a'; } }}
              >
                {isJoining ? 'Finding Game...' : 'Enter'} <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleNicknameSubmit} className="space-y-4">
              <div>
                <input 
                  type="text"
                  placeholder="Nickname"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  className="w-full text-center text-2xl font-bold py-4 rounded-xl outline-none transition-all placeholder:font-normal placeholder:text-xl"
                  style={{ backgroundColor: '#0a0a0a', border: '2px solid #2a2a2a', color: '#f0f0f0' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                  onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                  autoFocus
                />
              </div>
              <button 
                type="submit"
                disabled={!nickname || isJoining}
                className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                style={{ backgroundColor: '#0ABFBC', color: '#0a0a0a' }}
                onMouseEnter={e => !isJoining && nickname && (e.currentTarget.style.backgroundColor = '#09a8a5')}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0ABFBC'}
              >
                {isJoining ? 'Joining...' : 'Join Game'}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'rgba(10,191,188,0.2)', borderTopColor: '#0ABFBC' }}></div>
              <div>
                <h2 className="text-xl font-bold mb-2" style={{ color: '#f0f0f0' }}>You're in!</h2>
                <p className="text-lg font-medium" style={{ color: '#0ABFBC' }}>{nickname}</p>
              </div>
              <p className="font-medium animate-pulse" style={{ color: '#888' }}>See your nickname on screen</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
