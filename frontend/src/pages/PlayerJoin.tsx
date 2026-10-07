import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Dices, Plus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import client from '../api/client';
import { playerSocketUrl } from '../api/ws';
import LanguageSwitcher from '../components/LanguageSwitcher';
import MuteButton from '../components/game/MuteButton';
import PlayerAvatar from '../components/game/PlayerAvatar';
import { apiErrorStatus } from '../lib/apiError';
import { AVATARS, AVATAR_UPLOAD_TYPES, MAX_AVATAR_UPLOAD_MB } from '../lib/avatars';
import { randomNickname } from '../lib/game/names';
import { playerExtra, rememberPlayer } from '../lib/game/playerStrings';
import { play } from '../lib/game/sound';
import { useGameLocale } from '../lib/game/useGameLocale';
import { useGameSocket } from '../lib/game/useGameSocket';

type Step = 'pin' | 'nickname' | 'waiting';

const MAX_NAME = 20;
const BIG_BUTTON =
  'w-full min-h-14 rounded-2xl bg-mark text-ink text-xl font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 cursor-pointer';

/** Players may type Arabic-Indic digits on an Arabic keyboard; the PIN is Western. */
const toWesternDigits = (s: string) =>
  s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');

const PlayerJoin: React.FC = () => {
  const { locale, dir, G } = useGameLocale();
  const X = playerExtra[locale];
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialPin = toWesternDigits(searchParams.get('pin') || '');

  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState(initialPin);
  const [nickname, setNickname] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [playersHere, setPlayersHere] = useState(1);
  const [started, setStarted] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  const [avatarIndex, setAvatarIndex] = useState(4);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const picked = AVATARS[avatarIndex];

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
      setUploadError(X.badType);
      return;
    }
    if (file.size > MAX_AVATAR_UPLOAD_MB * 1024 * 1024) {
      setUploadError(X.tooLarge(MAX_AVATAR_UPLOAD_MB));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustomAvatar(reader.result as string);
      setUploadError('');
    };
    reader.readAsDataURL(file);
  };

  const lookupPin = useCallback(
    async (candidate: string) => {
      if (!candidate) return;
      setError('');
      setBusy(true);
      try {
        const res = await client.get(`/api/v1/sessions/pin/${candidate}`);
        if (res.data.status === 'finished') {
          setError(X.gameFinished);
          return;
        }
        setSessionId(res.data.id);
        setStep('nickname');
      } catch {
        setError(G.join.invalidPin);
      } finally {
        setBusy(false);
      }
    },
    [G.join.invalidPin, X.gameFinished]
  );

  // A ?pin= in the URL is looked up straight away (the QR code and link carry
  // it), so the player only has to type a nickname.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!initialPin || autoJoined.current) return;
    autoJoined.current = true;
    void lookupPin(initialPin);
  }, [initialPin, lookupPin]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void lookupPin(pin);
  };

  const handleNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return;
    setError('');
    setBusy(true);
    // This tap is the gesture that lets the browser play sound later.
    play('join');
    try {
      const res = await client.post(`/api/v1/sessions/${sessionId}/players`, {
        name,
        avatar_id: customAvatar ? undefined : avatarIndex,
        avatar_url: customAvatar ?? undefined,
      });
      rememberPlayer(res.data.id, { name, avatarId: customAvatar ? undefined : avatarIndex, avatarUrl: customAvatar ?? undefined });
      setPlayerId(res.data.id);
      setStep('waiting');
    } catch (err) {
      const status = apiErrorStatus(err);
      setError(status === 409 ? G.join.nameTaken : status === 422 ? X.gameFinished : X.joinFailed);
    } finally {
      setBusy(false);
    }
  };

  // The live screen opens its own socket, so a question broadcast during the
  // hop would be lost. When one is what triggered the move, hand it over.
  const goToGame = useCallback(
    (question?: unknown) => {
      navigate(`/play/${sessionId}?playerId=${playerId}`, { state: question ? { question } : undefined });
    },
    [navigate, sessionId, playerId]
  );

  const status = useGameSocket({
    enabled: step === 'waiting' && !!sessionId && !!playerId,
    url: () => playerSocketUrl(sessionId, playerId),
    onMessage: msg => {
      const payload = msg.payload as { status?: string; players?: string[] } | undefined;
      if (msg.type === 'lobby_snapshot') {
        if (payload?.status && payload.status !== 'lobby') {
          goToGame();
          return;
        }
        setPlayersHere(Math.max(1, payload?.players?.length ?? 1));
      } else if (msg.type === 'player_joined') {
        setPlayersHere(n => n + 1);
        play('join');
      } else if (msg.type === 'game_started') {
        // Stay put: the first question usually follows within a moment, and
        // moving now could drop it.
        setStarted(true);
        play('start');
      } else if (msg.type === 'question') {
        goToGame(msg.payload);
      }
    },
  });

  // Rotate the waiting-room line so a long wait has some life in it.
  useEffect(() => {
    if (step !== 'waiting') return;
    const id = window.setInterval(() => setMessageIndex(i => i + 1), 4000);
    return () => window.clearInterval(id);
  }, [step]);

  const field =
    'w-full rounded-2xl text-center bg-panel border-2 border-border-strong text-text placeholder:text-muted/70 focus:outline-none focus:border-mark';

  return (
    <div className="game flex flex-col" dir={dir}>
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <img src="/logo-icon.png" alt="" className="w-8 h-8 object-contain" />
          <span className="font-semibold text-lg">Skillture</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <MuteButton />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 pb-8">
        <div className="w-full max-w-md space-y-6">
          {step !== 'waiting' && (
            <h1 className="game-pop text-center text-3xl font-semibold">
              {step === 'pin' ? G.join.title : G.join.nicknameTitle}
            </h1>
          )}

          {error && (
            <div role="alert" className="game-shake rounded-2xl px-4 py-3 text-center font-medium bg-coral text-white">
              {error}
            </div>
          )}

          {step === 'pin' && (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                maxLength={8}
                dir="ltr"
                placeholder={G.join.pinPlaceholder}
                aria-label={G.join.pinLabel}
                value={pin}
                onChange={e => setPin(toWesternDigits(e.target.value))}
                className={`${field} numeral text-4xl font-semibold tracking-[0.25em] py-5 placeholder:text-xl placeholder:font-normal placeholder:tracking-normal`}
              />
              <button type="submit" disabled={!pin || busy} className={BIG_BUTTON}>
                {busy ? X.findingGame : G.join.enter}
                {!busy && <ArrowRight className="w-6 h-6 rtl:rotate-180" />}
              </button>
            </form>
          )}

          {step === 'nickname' && (
            <form onSubmit={handleNicknameSubmit} className="space-y-5">
              <div className="flex flex-col items-center gap-2">
                <PlayerAvatar id={nickname || 'x'} avatarId={customAvatar ? null : avatarIndex} avatarUrl={customAvatar} size={84} className="game-pop" />
                <p className="text-sm text-muted">{customAvatar ? X.yourPhoto : picked.label}</p>
              </div>

              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  autoFocus
                  autoComplete="nickname"
                  maxLength={MAX_NAME}
                  placeholder={G.join.nicknamePlaceholder}
                  aria-label={G.join.nicknamePlaceholder}
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  className={`${field} flex-1 min-w-0 text-2xl font-semibold py-4 placeholder:text-lg placeholder:font-normal`}
                />
                <button
                  type="button"
                  onClick={() => {
                    play('tick');
                    setNickname(randomNickname(locale));
                  }}
                  aria-label={G.join.rollName}
                  title={G.join.rollName}
                  className="min-w-14 rounded-2xl bg-azure text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                >
                  <Dices className="w-7 h-7" />
                </button>
              </div>

              <div>
                <p className="text-sm font-semibold text-muted mb-2">{G.join.pickAvatar}</p>
                <div className="grid grid-cols-4 gap-2">
                  {AVATARS.map((a, i) => {
                    const on = !customAvatar && avatarIndex === i;
                    return (
                      <button
                        key={a.label}
                        type="button"
                        aria-label={a.label}
                        aria-pressed={on}
                        onClick={() => pickAvatar(i)}
                        className={`aspect-square min-h-12 rounded-2xl flex items-center justify-center text-2xl cursor-pointer transition-transform active:scale-95 border-2 ${
                          on ? 'bg-panel-3 border-mark' : 'bg-panel border-border'
                        }`}
                        style={{ color: a.color }}
                      >
                        {a.glyph}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-label={X.uploadOwn}
                    onClick={() => fileRef.current?.click()}
                    className={`aspect-square min-h-12 rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer bg-panel border-2 ${
                      customAvatar ? 'border-mark border-solid' : 'border-border-strong border-dashed'
                    }`}
                  >
                    {customAvatar ? <img src={customAvatar} alt="" className="w-full h-full object-cover" /> : <Plus className="w-6 h-6 text-mark" />}
                  </button>
                </div>
                <input ref={fileRef} type="file" accept={AVATAR_UPLOAD_TYPES.join(',')} onChange={onAvatarFile} className="hidden" />
                <p className={`text-xs mt-2 ${uploadError ? 'text-coral font-medium' : 'text-muted'}`}>
                  {uploadError || X.uploadFormats(MAX_AVATAR_UPLOAD_MB)}
                </p>
              </div>

              <button type="submit" disabled={!nickname.trim() || busy} className={BIG_BUTTON}>
                {busy ? X.joining : G.join.letsGo}
              </button>
            </form>
          )}

          {step === 'waiting' && (
            <div className="text-center space-y-7 py-6">
              <PlayerAvatar
                id={playerId}
                avatarId={customAvatar ? null : avatarIndex}
                avatarUrl={customAvatar}
                size={120}
                className="game-float mx-auto border-mark"
              />
              <div>
                <h1 className="game-pop text-4xl font-semibold">{G.join.youAreIn}</h1>
                <p className="mt-2 text-2xl font-semibold text-mark break-words">{nickname}</p>
              </div>

              <p key={messageIndex} className="game-rise text-lg text-muted min-h-14 px-2 text-pretty" aria-live="polite">
                {started ? G.lobby.starting : G.join.waitingPool[messageIndex % G.join.waitingPool.length]}
              </p>
              <p className="text-base font-medium">{G.join.othersHere(playersHere)}</p>

              {status === 'reconnecting' && <p className="text-sm text-mark">{G.player.reconnecting}</p>}
              {status === 'failed' && (
                <div role="alert" className="rounded-2xl p-4 bg-coral text-white space-y-3">
                  <p className="font-medium">{G.player.connectionLost}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/play')}
                    className="min-h-12 px-6 rounded-xl bg-white text-ink font-semibold cursor-pointer"
                  >
                    {G.player.rejoin}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PlayerJoin;
