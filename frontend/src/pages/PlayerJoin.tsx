import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import client from '../api/client';
import { apiErrorMessage } from '../lib/apiError';
import { playerSocketUrl } from '../api/ws';
import { AVATARS, AVATAR_UPLOAD_TYPES, MAX_AVATAR_UPLOAD_MB } from '../lib/avatars';
import { Button, Card } from '../components/ui';

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

  // Avatar pick — sent with the join request and stored by the backend
  // (avatar_id/avatar_url on quiz_players), so it also renders in the lobby
  // and on the leaderboard for every other client.
  const [avatarIndex, setAvatarIndex] = useState(4); // Star, matches the design's default
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const pickAvatar = (i: number) => {
    setAvatarIndex(i);
    setCustomAvatar(null);
    setUploadError('');
  };

  const onAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!AVATAR_UPLOAD_TYPES.includes(file.type)) {
      setUploadError('Use a PNG, JPG, WEBP or GIF image.');
      return;
    }
    if (file.size > MAX_AVATAR_UPLOAD_MB * 1024 * 1024) {
      setUploadError(`Image is too large — keep it under ${MAX_AVATAR_UPLOAD_MB} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustomAvatar(reader.result as string);
      setUploadError('');
    };
    reader.readAsDataURL(file);
  };

  const picked = AVATARS[avatarIndex];

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
      const res = await client.post(`/api/v1/sessions/${sessionId}/players`, {
        name: nickname,
        avatar_id: customAvatar ? undefined : avatarIndex,
        avatar_url: customAvatar ?? undefined,
      });
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
        <div className="flex flex-col items-center justify-center space-y-3">
          <img src="/logo-icon.png" alt="" className="w-16 h-16 object-contain" />
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
            <form onSubmit={handleNicknameSubmit} className="space-y-5">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary bg-primary-soft"
                  aria-hidden
                >
                  {customAvatar ? (
                    <img src={customAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span style={{ color: picked.color }} className="text-3xl leading-none">
                      {picked.glyph}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">{customAvatar ? 'Your photo' : picked.label}</p>
              </div>

              <input
                type="text"
                placeholder="Nickname"
                aria-label="Nickname"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="w-full text-center text-2xl font-bold py-4 rounded-xl outline-none transition-colors placeholder:font-normal placeholder:text-xl bg-bg text-text border-2 border-border focus:border-primary"
                autoFocus
              />

              <div>
                <p className="text-left text-xs font-bold text-muted uppercase tracking-wide mb-2">
                  Pick an avatar
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {AVATARS.map((a, i) => (
                    <button
                      key={a.label}
                      type="button"
                      title={a.label}
                      onClick={() => pickAvatar(i)}
                      className="aspect-square min-h-11 rounded-xl flex items-center justify-center text-lg cursor-pointer transition-colors"
                      style={{
                        color: a.color,
                        background: !customAvatar && avatarIndex === i ? 'var(--color-primary-soft)' : 'var(--color-panel-2)',
                        border: `2px solid ${!customAvatar && avatarIndex === i ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      }}
                    >
                      {a.glyph}
                    </button>
                  ))}
                  <button
                    type="button"
                    title="Upload your own photo"
                    onClick={() => fileRef.current?.click()}
                    className="aspect-square min-h-11 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer p-0 bg-panel-2"
                    style={{ border: `2px ${customAvatar ? 'solid' : 'dashed'} ${customAvatar ? 'var(--color-primary)' : 'var(--color-border-strong)'}` }}
                  >
                    {customAvatar ? (
                      <img src={customAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Plus className="w-4 h-4 text-primary" />
                    )}
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept={AVATAR_UPLOAD_TYPES.join(',')}
                  onChange={onAvatarFile}
                  className="hidden"
                />
                <p className={`text-[11px] mt-2 ${uploadError ? 'text-danger' : 'text-muted'}`}>
                  {uploadError || `Or upload your own — PNG, JPG, WEBP, GIF · max ${MAX_AVATAR_UPLOAD_MB} MB`}
                </p>
              </div>

              <Button type="submit" size="lg" block disabled={!nickname} loading={isJoining}>
                {isJoining ? 'Joining…' : 'Join Game'}
              </Button>
            </form>
          )}

          {step === 'waiting' && (
            <div className="text-center space-y-6 py-4">
              <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center overflow-hidden border-2 border-primary bg-primary-soft animate-pulse">
                {customAvatar ? (
                  <img src={customAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span style={{ color: picked.color }} className="text-4xl leading-none">
                    {picked.glyph}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2 text-text">You're in!</h2>
                <p className="text-lg font-medium text-primary">{nickname}</p>
              </div>
              <p className="font-medium animate-pulse text-muted">Waiting for host to start…</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PlayerJoin;
