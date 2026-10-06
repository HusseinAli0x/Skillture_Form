import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ImagePlus, Shuffle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import client from '../api/client';
import { apiErrorMessage, apiErrorStatus } from '../lib/apiError';
import {
  AVATARS,
  AVATAR_UPLOAD_TYPES,
  MAX_AVATAR_UPLOAD_MB,
  randomNickname,
  resizeAvatarFile,
} from '../lib/avatars';
import type { QuizSession } from '../api/types';
import { brandAssets } from '../components/brand';
import { Button } from '../components/ui';
import GameShell from '../components/game/GameShell';
import PinEntry from '../components/game/PinEntry';
import PlayerCard from '../components/game/PlayerCard';
import { PIN_LENGTH } from '../components/game/gameLogic';
import { loadRejoin, saveRejoin, type Rejoin } from '../components/game/rejoin';
import { useDocumentTitle } from '../lib/useDocumentTitle';

type Step = 'pin' | 'profile';

const NAME_MAX = 24;
const PREVIEW_ID = 'preview';

const PlayerJoin: React.FC = () => {
  useDocumentTitle('Join a game');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialPin = searchParams.get('pin') || '';

  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState(initialPin.replace(/\D/g, '').slice(0, PIN_LENGTH));
  const [pinError, setPinError] = useState('');
  const [shake, setShake] = useState(0);
  const [looking, setLooking] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [sessionPin, setSessionPin] = useState('');

  const [nickname, setNickname] = useState('');
  const [nameError, setNameError] = useState('');
  const [joining, setJoining] = useState(false);
  const [avatarIndex, setAvatarIndex] = useState(4);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // A player who closed the tab mid-game can walk straight back in.
  const [rejoin, setRejoin] = useState<Rejoin | null>(null);
  useEffect(() => {
    const saved = loadRejoin();
    if (!saved) return;
    client
      .get<QuizSession>(`/api/v1/sessions/${saved.sessionId}`)
      .then(res => {
        if (res.data.status !== 'finished') setRejoin(saved);
      })
      .catch(() => undefined);
  }, []);

  const lookupPin = useCallback(async (candidate: string) => {
    if (candidate.length !== PIN_LENGTH) return;
    setPinError('');
    setLooking(true);
    try {
      const res = await client.get<QuizSession>(`/api/v1/sessions/pin/${candidate}`);
      if (res.data.status === 'finished') {
        setPinError('That game has already finished. Ask the host for a new PIN.');
        setShake(n => n + 1);
        return;
      }
      setSessionId(res.data.id);
      setSessionPin(candidate);
      setStep('profile');
    } catch (err) {
      setPinError(
        apiErrorStatus(err) === 404
          ? 'No game with that PIN. Check the number on the big screen.'
          : apiErrorMessage(err, "Couldn't reach the game. Check your connection and try again.")
      );
      setShake(n => n + 1);
    } finally {
      setLooking(false);
    }
  }, []);

  // A ?pin= in the URL (the QR code) is looked up straight away.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (autoJoined.current || initialPin.replace(/\D/g, '').length !== PIN_LENGTH) return;
    autoJoined.current = true;
    lookupPin(initialPin.replace(/\D/g, ''));
  }, [initialPin, lookupPin]);

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!AVATAR_UPLOAD_TYPES.includes(file.type)) {
      setUploadError('Use a PNG, JPG, WEBP or GIF image.');
      return;
    }
    if (file.size > MAX_AVATAR_UPLOAD_MB * 1024 * 1024) {
      setUploadError(`That photo is too big. Keep it under ${MAX_AVATAR_UPLOAD_MB} MB.`);
      return;
    }
    try {
      setCustomAvatar(await resizeAvatarFile(file));
      setUploadError('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not read that image.');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) {
      setNameError('Pick a name so your friends can spot you.');
      return;
    }
    setNameError('');
    setJoining(true);
    try {
      const res = await client.post(`/api/v1/sessions/${sessionId}/players`, {
        name,
        avatar_id: customAvatar ? undefined : avatarIndex,
        avatar_url: customAvatar ?? undefined,
      });
      saveRejoin({ sessionId, playerId: res.data.id, name, pin: sessionPin });
      navigate(`/play/${sessionId}?playerId=${res.data.id}`, { replace: true });
    } catch (err) {
      setNameError(
        apiErrorStatus(err) === 409
          ? 'Someone in this game already has that name. Try another.'
          : apiErrorMessage(err, "Couldn't join. Check your connection and try again.")
      );
      setJoining(false);
    }
  };

  const header = (
    <div className="relative -mx-5 -mt-1 h-44 overflow-hidden sm:mx-0 sm:rounded-3xl">
      <img
        src={brandAssets.hand}
        alt=""
        width={1600}
        height={1066}
        className="h-full w-full object-cover"
        style={{ objectPosition: '12% 88%' }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
    </div>
  );

  return (
    <GameShell pattern="soft" title="Skillture Quiz" className="items-stretch">
      <form
        onSubmit={handleJoin}
        className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {step === 'pin' && (
          <div className="flex flex-1 flex-col">
            {header}
            <div className="relative z-10 -mt-8 text-center">
              <h1 className="text-4xl font-extrabold leading-tight">Join a game</h1>
              <p className="mt-1 text-muted">Type the PIN shown on the big screen.</p>
            </div>

            {rejoin && (
              <button
                type="button"
                onClick={() => navigate(`/play/${rejoin.sessionId}?playerId=${rejoin.playerId}`)}
                className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-primary-border bg-primary-soft px-4 py-3 text-start"
              >
                <span className="min-w-0">
                  <span className="block text-xs uppercase tracking-widest text-muted">Game in progress</span>
                  <span className="block truncate font-display text-lg font-bold text-primary">Rejoin as {rejoin.name}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              </button>
            )}

            <div className="mt-5 flex-1">
              <PinEntry
                value={pin}
                onChange={v => {
                  setPin(v);
                  setPinError('');
                }}
                onComplete={lookupPin}
                shakeKey={shake}
                disabled={looking}
                invalid={!!pinError}
              />
            </div>

            <div className="mt-4 min-h-12 text-center" aria-live="polite">
              {pinError ? (
                <p role="alert" className="text-sm font-medium text-danger">
                  {pinError}
                </p>
              ) : looking ? (
                <p className="text-sm text-muted">Finding your game…</p>
              ) : (
                <p className="text-sm text-muted">The game starts as soon as you enter all six digits.</p>
              )}
            </div>
          </div>
        )}

        {step === 'profile' && (
          <div className="flex flex-1 flex-col gap-5 pt-2">
            <div className="text-center">
              <h1 className="text-3xl font-extrabold">Make your badge</h1>
              <p className="mt-1 text-sm text-muted">Game {sessionPin}. This is how the room will see you.</p>
            </div>

            <div className="flex justify-center">
              <PlayerCard
                id={PREVIEW_ID}
                name={nickname.trim() || 'Your name'}
                avatarId={customAvatar ? undefined : avatarIndex}
                avatarUrl={customAvatar}
                size="md"
              />
            </div>

            <div>
              <label htmlFor="nickname" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                Nickname
              </label>
              <div className="flex gap-2">
                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  maxLength={NAME_MAX}
                  autoComplete="nickname"
                  autoCapitalize="words"
                  enterKeyHint="go"
                  placeholder="e.g. Curious Fox"
                  onChange={e => {
                    setNickname(e.target.value);
                    setNameError('');
                  }}
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? 'nickname-error' : undefined}
                  className={`h-14 min-w-0 flex-1 rounded-xl border-2 bg-bg px-4 text-center font-display text-2xl font-bold text-text outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-muted focus:border-primary ${
                    nameError ? 'border-danger' : 'border-border'
                  }`}
                  autoFocus
                />
                <button
                  type="button"
                  aria-label="Suggest a nickname"
                  title="Surprise me"
                  onClick={() => {
                    setNickname(randomNickname());
                    setNameError('');
                  }}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-panel-2 text-primary transition-colors active:bg-primary active:text-bg"
                >
                  <Shuffle className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              {nameError && (
                <p id="nickname-error" role="alert" className="mt-2 text-sm font-medium text-danger">
                  {nameError}
                </p>
              )}
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Pick a badge icon</legend>
              <div className="grid grid-cols-4 gap-2">
                {AVATARS.map((a, i) => {
                  const on = !customAvatar && avatarIndex === i;
                  return (
                    <button
                      key={a.label}
                      type="button"
                      aria-label={a.label}
                      aria-pressed={on}
                      onClick={() => {
                        setAvatarIndex(i);
                        setCustomAvatar(null);
                        setUploadError('');
                      }}
                      className={`flex aspect-square items-center justify-center rounded-2xl border-2 text-3xl transition-colors ${
                        on ? 'border-primary bg-primary-soft' : 'border-border bg-panel-2'
                      }`}
                      style={{ color: a.color }}
                    >
                      {a.glyph}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-label="Use your own photo"
                  aria-pressed={!!customAvatar}
                  onClick={() => fileRef.current?.click()}
                  className={`flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-2 p-0 ${
                    customAvatar ? 'border-primary' : 'border-dashed border-border-strong bg-panel-2'
                  }`}
                >
                  {customAvatar ? (
                    <img src={customAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-primary" aria-hidden="true" />
                  )}
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={AVATAR_UPLOAD_TYPES.join(',')}
                onChange={onAvatarFile}
                className="hidden"
                tabIndex={-1}
              />
              {uploadError && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {uploadError}
                </p>
              )}
            </fieldset>

            <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-bg via-bg to-transparent pb-1 pt-4">
              <Button type="submit" size="lg" block loading={joining} className="!h-14 !text-lg">
                {joining ? 'Joining…' : 'Join game'}
                {!joining && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep('pin');
                  setPin('');
                  setNameError('');
                }}
                className="mt-2 w-full py-2 text-sm text-muted underline-offset-4 hover:underline"
              >
                Wrong game? Enter a different PIN
              </button>
            </div>
          </div>
        )}
      </form>
    </GameShell>
  );
};

export default PlayerJoin;
