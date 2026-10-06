import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Play, Users, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useParams } from 'react-router';
import client from '../api/client';
import { apiErrorMessage } from '../lib/apiError';
import type { GameMessage, Quiz, QuizPlayer, QuizSession, ServerInfo } from '../api/types';
import { hostSocketUrl } from '../api/ws';
import { localized } from '../lib/i18n';
import { Button, ConfirmDialog } from '../components/ui';
import GameShell, { ConnectionChip } from '../components/game/GameShell';
import PlayerCard from '../components/game/PlayerCard';
import { useGameSocket } from '../components/game/useGameSocket';
import { formatPin, joinAddresses, playUrl } from '../components/game/gameLogic';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/** Keys that should not trigger the start shortcut when a control already owns them. */
const INTERACTIVE = new Set(['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A']);

const GameLobby: React.FC = () => {
  useDocumentTitle('Game lobby');
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [pin, setPin] = useState('');
  const [quizTitle, setQuizTitle] = useState('');
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [entering, setEntering] = useState<Set<string>>(new Set());
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [addrIndex, setAddrIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seeded = useRef(false);

  // Seed the roster with everyone already in the lobby; later arrivals animate in.
  const loadPlayers = useCallback(() => {
    client
      .get<QuizPlayer[]>(`/api/v1/sessions/${sessionId}/leaderboard`)
      .then(res => {
        const list = res.data || [];
        setPlayers(prev => {
          if (seeded.current) {
            const have = new Set(prev.map(p => p.id));
            const fresh = list.filter(p => !have.has(p.id));
            if (fresh.length) setEntering(e => new Set([...e, ...fresh.map(p => p.id)]));
          }
          seeded.current = true;
          return list;
        });
      })
      .catch(console.error);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    client
      .get<QuizSession>(`/api/v1/sessions/${sessionId}`)
      .then(res => {
        setPin(res.data.pin);
        if (res.data.status === 'active' || res.data.status === 'finished') {
          navigate(`/host/live/${sessionId}`, { replace: true });
          return;
        }
        client
          .get<Quiz>(`/api/v1/quizzes/${res.data.quiz_id}`)
          .then(q => setQuizTitle(localized(q.data.title)))
          .catch(() => undefined);
      })
      .catch(() => setError("Couldn't load this session. It may have been closed. Go back to Quizzes and start a new one."));

    client
      .get<ServerInfo>('/api/v1/server-info')
      .then(res => setLanIps(res.data.lan_ips ?? []))
      .catch(() => undefined);

    loadPlayers();
  }, [sessionId, navigate, loadPlayers]);

  const onMessage = useCallback((msg: GameMessage) => {
    if (msg.type !== 'player_joined') return;
    const p = msg.payload;
    setPlayers(prev =>
      prev.some(x => x.id === p.player_id)
        ? prev
        : [
            ...prev,
            {
              id: p.player_id,
              session_id: sessionId ?? '',
              name: p.name || 'New player',
              score: 0,
              joined_at: new Date().toISOString(),
              avatar_id: p.avatar_id ?? undefined,
              avatar_url: p.avatar_url ?? undefined,
            },
          ]
    );
    setEntering(e => new Set(e).add(p.player_id));
  }, [sessionId]);

  // After a reconnect, refetch: anyone who joined while the link was down is missing.
  const status = useGameSocket(sessionId ? () => hostSocketUrl(sessionId) : null, onMessage, loadPlayers);

  useEffect(
    () => () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    },
    []
  );

  const addresses = useMemo(() => joinAddresses(lanIps, window.location), [lanIps]);
  const address = addresses[Math.min(addrIndex, addresses.length - 1)];
  const joinUrl = pin ? playUrl(address.origin, pin) : '';
  const localOnly = !address.lan && /^(localhost|127\.|\[?::1)/.test(window.location.hostname);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      copyTimeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked outside a secure context; the link is on screen to read out.
    }
  };

  const handleStart = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setError('');
    try {
      await client.patch(`/api/v1/sessions/${sessionId}/start`);
      navigate(`/host/live/${sessionId}`);
    } catch (err) {
      const message = apiErrorMessage(err, 'Failed to start the game.');
      if (message === 'session has already started') navigate(`/host/live/${sessionId}`);
      else {
        setError(message);
        setStarting(false);
      }
    }
  }, [navigate, sessionId, starting]);

  const handleClose = async () => {
    setClosing(true);
    try {
      await client.patch(`/api/v1/sessions/${sessionId}/finish`);
    } catch {
      // Already finished or gone: either way the lobby is closed.
    }
    navigate('/admin/quizzes');
  };

  // Space / Enter start the game — the host's hands stay on the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      const t = e.target as HTMLElement | null;
      if (t && (INTERACTIVE.has(t.tagName) || t.isContentEditable)) return;
      if (confirmClose || players.length === 0) return;
      e.preventDefault();
      handleStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleStart, players.length, confirmClose]);

  const count = players.length;

  return (
    <GameShell
      pattern="faint"
      title={quizTitle || 'Skillture Quiz'}
      status={status}
      right={
        <div className="flex items-center gap-3">
          <ConnectionChip status={status} />
          <button
            type="button"
            onClick={() => setConfirmClose(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-hover-overlay-strong hover:text-text"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Close lobby
          </button>
        </div>
      }
    >
      {error && (
        <div role="alert" className="relative z-10 mx-6 mb-2 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid flex-1 gap-6 px-4 pb-4 sm:px-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
        {/* Join panel */}
        <section aria-label="How to join" className="flex flex-col rounded-3xl border border-border bg-panel p-6 lg:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Game PIN</p>
          <p
            className="font-display font-extrabold leading-none tracking-[0.06em] text-primary tabular-nums"
            style={{ fontSize: 'clamp(3.5rem, 8vw, 7.5rem)' }}
            aria-label={pin ? `Game PIN ${pin.split('').join(' ')}` : 'Loading PIN'}
          >
            {pin ? formatPin(pin) : '··· ···'}
          </p>

          <div className="mt-6 flex items-center gap-5">
            <div className="rounded-2xl bg-white p-3 shadow-lg">
              {joinUrl ? (
                <QRCodeSVG value={joinUrl} size={176} level="M" aria-label={`QR code to join at ${joinUrl}`} />
              ) : (
                <div className="h-44 w-44" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">Scan, or open</p>
              <p className="break-all font-display text-xl font-bold leading-snug text-text">
                {address.origin.replace(/^https?:\/\//, '')}/play
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-text"
              >
                {copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? 'Link copied' : 'Copy join link'}
              </button>
            </div>
          </div>

          {addresses.length > 1 && (
            <div className="mt-5" role="group" aria-label="Address phones should use">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Address on this network</p>
              <div className="flex flex-wrap gap-2">
                {addresses.map((a, i) => (
                  <button
                    key={a.origin}
                    type="button"
                    aria-pressed={i === addrIndex}
                    onClick={() => setAddrIndex(i)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      i === addrIndex ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted hover:border-border-strong'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {localOnly && (
            <p className="mt-3 text-sm text-warning" role="note">
              {lanIps.length === 0
                ? 'No network address found. "localhost" only works on this computer. Phones need this computer\'s network address.'
                : '"localhost" only works on this computer. Pick a network address so phones can join.'}
            </p>
          )}
          {!localOnly && <p className="mt-3 text-sm text-muted">Phones need to be on the same network as this screen.</p>}
        </section>

        {/* Players */}
        <section aria-label="Players" className="flex min-h-[18rem] flex-col">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h1 className="text-3xl font-extrabold lg:text-4xl">
              {count === 0 ? 'Waiting for players' : `${count} ${count === 1 ? 'player' : 'players'} in`}
            </h1>
            <p className="hidden items-center gap-2 text-sm text-muted sm:flex" aria-live="polite">
              <Users className="h-4 w-4" aria-hidden="true" />
              {count === 0 ? 'Cards appear here as people join' : 'Looking good'}
            </p>
          </div>

          {count === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-3xl border-2 border-dashed border-border-strong p-10 text-center">
              <div>
                <p className="font-display text-2xl font-bold">Show the PIN, or the QR code.</p>
                <p className="mt-1 text-muted">Each player gets a badge here the moment they join.</p>
              </div>
            </div>
          ) : (
            <ul className="grid content-start gap-5 pt-8 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))] lg:max-h-[calc(100dvh-14rem)] lg:overflow-y-auto lg:pe-2">
              {players.map(p => (
                <li key={p.id} className="flex justify-center">
                  <PlayerCard
                    id={p.id}
                    name={p.name}
                    avatarId={p.avatar_id}
                    avatarUrl={p.avatar_url}
                    size="md"
                    entering={entering.has(p.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Start bar */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="hidden text-sm text-muted sm:block">
            {count === 0 ? 'Start unlocks when the first player joins.' : 'Everyone in? Press Space or Enter to begin.'}
          </p>
          <Button
            size="lg"
            onClick={handleStart}
            disabled={count === 0}
            loading={starting}
            className="!h-14 w-full !px-10 !text-xl sm:w-auto"
          >
            {!starting && <Play className="h-6 w-6" fill="currentColor" aria-hidden="true" />}
            {starting ? 'Starting…' : `Start game${count ? ` · ${count}` : ''}`}
          </Button>
        </div>
      </div>

      {confirmClose && (
        <ConfirmDialog
          title="Close this lobby?"
          message="Players who already joined will be dropped, and the PIN stops working."
          confirmLabel="Close lobby"
          destructive
          loading={closing}
          onConfirm={handleClose}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </GameShell>
  );
};

export default GameLobby;
