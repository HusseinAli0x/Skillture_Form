import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Music, Play, WifiOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useParams } from 'react-router';
import client from '../api/client';
import type { QuizPlayer, QuizQuestion, QuizSession } from '../api/types';
import { hostSocketUrl } from '../api/ws';
import { hostHomePath } from '../lib/links';
import HostTopBar from '../components/game/HostTopBar';
import PlayerBubble from '../components/game/PlayerBubble';
import { apiErrorMessage } from '../lib/apiError';
import { hostStrings } from '../lib/game/hostStrings';
import { pick } from '../lib/game/strings';
import { play, startLobbyMusic } from '../lib/game/sound';
import { useGameLocale } from '../lib/game/useGameLocale';
import { useGameSocket } from '../lib/game/useGameSocket';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];
const ROTATE_MS = 4000;

interface JoinedPayload {
  player_id: string;
  name?: string;
  avatar_id?: number;
  avatar_url?: string;
}

const GameLobby: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { dir, locale, G } = useGameLocale();
  const L = G.lobby;
  const H = hostStrings[locale];

  const [session, setSession] = useState<QuizSession | null>(null);
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [loadError, setLoadError] = useState('');
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [messageIdx, setMessageIdx] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [useLan, setUseLan] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read by the socket handler, which must not fire sounds from inside a state updater.
  const playersRef = useRef<QuizPlayer[]>([]);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const isLocal = LOCAL_HOSTS.includes(window.location.hostname);

  const loadPlayers = useCallback(() => {
    client
      .get<QuizPlayer[]>(`/api/v1/sessions/${sessionId}/leaderboard`)
      .then(res => setPlayers(res.data || []))
      .catch(console.error);
  }, [sessionId]);

  const load = useCallback(() => {
    if (!sessionId) return;
    setLoadError('');
    client
      .get<QuizSession>(`/api/v1/sessions/${sessionId}`)
      .then(res => {
        if (res.data.status === 'active' || res.data.status === 'finished') {
          navigate(`/host/live/${sessionId}`, { replace: true });
          return;
        }
        setSession(res.data);
      })
      .catch(err => setLoadError(apiErrorMessage(err, H.loadError)));
    loadPlayers();
  }, [sessionId, navigate, loadPlayers, H.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  // The network address only matters when the host opened the app on localhost.
  useEffect(() => {
    if (!isLocal) return;
    client
      .get<{ lan_ips?: string[] }>('/api/v1/server-info')
      .then(res => setLanIps(res.data.lan_ips ?? []))
      .catch(() => undefined);
  }, [isLocal]);

  const status = useGameSocket({
    url: () => hostSocketUrl(sessionId ?? ''),
    enabled: Boolean(sessionId),
    // A reconnect may have missed joins, so refetch the roster.
    onOpen: loadPlayers,
    onMessage: msg => {
      if (msg.type !== 'player_joined') return;
      const p = msg.payload as JoinedPayload;
      if (playersRef.current.some(x => x.id === p.player_id)) return;
      play('join');
      setAnnouncement(H.joined(p.name || ''));
      setPlayers(prev =>
        prev.some(x => x.id === p.player_id)
          ? prev
          : [
              ...prev,
              {
                id: p.player_id,
                session_id: sessionId ?? '',
                name: p.name || '…',
                score: 0,
                joined_at: new Date().toISOString(),
                avatar_id: p.avatar_id,
                avatar_url: p.avatar_url,
              },
            ]
      );
    },
  });

  useEffect(() => {
    const t = window.setInterval(() => setMessageIdx(i => i + 1), ROTATE_MS);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!musicOn) return;
    return startLobbyMusic();
  }, [musicOn]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  const pin = session?.pin ?? '';
  const lanIp = lanIps[0];
  const base =
    useLan && lanIp
      ? `${window.location.protocol}//${lanIp}${window.location.port ? `:${window.location.port}` : ''}`
      : window.location.origin;
  const joinUrl = `${base}/play?pin=${pin}`;
  const joinHost = `${base.replace(/^https?:\/\//, '')}/play`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard needs a secure context; the link is on screen to read out.
    }
  };

  const handleStart = async () => {
    if (!session || starting) return;
    setStarting(true);
    setStartError('');
    try {
      try {
        await client.patch(`/api/v1/sessions/${session.id}/start`);
      } catch (err) {
        // A second click, or a refresh after starting, is not a failure.
        if (!/already started/i.test(apiErrorMessage(err, ''))) throw err;
      }
      const qs = await client.get<QuizQuestion[]>(`/api/v1/quizzes/${session.quiz_id}/questions`);
      const sorted = [...(qs.data || [])].sort((a, b) => a.position - b.position);
      if (sorted.length === 0) {
        setStartError(H.noQuestions);
        setStarting(false);
        return;
      }
      await client.patch(`/api/v1/sessions/${session.id}/advance`, { question_id: sorted[0].id });
      play('start');
      navigate(`/host/live/${session.id}`, { replace: true, state: { startedAt: Date.now() } });
    } catch (err) {
      setStartError(apiErrorMessage(err, H.startFailed));
      setStarting(false);
    }
  };

  if (loadError) {
    return (
      <div className="game flex flex-col items-center justify-center gap-5 p-8 text-center" dir={dir}>
        <p role="alert" className="text-2xl font-semibold">
          {loadError}
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={load} className="min-h-12 px-6 rounded-xl bg-primary text-ink font-semibold cursor-pointer">
            {H.retry}
          </button>
          <button
            type="button"
            onClick={() => navigate(hostHomePath())}
            className="min-h-12 px-6 rounded-xl bg-white/10 font-semibold cursor-pointer"
          >
            {H.back}
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="game flex items-center justify-center gap-3 text-xl" dir={dir} role="status">
        <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
        {H.loading}
      </div>
    );
  }

  const hasPlayers = players.length > 0;

  return (
    <div className="game flex flex-col" dir={dir}>
      <HostTopBar playerCount={players.length}>
        <button
          type="button"
          onClick={() => setMusicOn(m => !m)}
          aria-pressed={musicOn}
          className={`inline-flex items-center gap-2 min-h-11 px-4 rounded-full font-semibold cursor-pointer transition-colors ${
            musicOn ? 'bg-primary text-ink' : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          <Music className="w-4 h-4" aria-hidden="true" />
          {musicOn ? L.musicOn : L.musicOff}
        </button>
      </HostTopBar>

      {status !== 'open' && (
        <p
          role="status"
          className="mx-auto mb-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warning/20 text-warning text-sm font-semibold"
        >
          <WifiOff className="w-4 h-4" aria-hidden="true" />
          {status === 'failed' ? H.connectionFailed : H.reconnecting}
        </p>
      )}

      <main className="flex-1 flex flex-col items-center px-5 sm:px-8 pb-10 gap-8">
        <section className="w-full max-w-5xl grid md:grid-cols-[1fr_auto] gap-8 items-center rounded-3xl bg-panel border border-border p-6 sm:p-10">
          <div className="text-center md:text-start">
            <p className="text-xl text-muted">
              {L.joinAt} <span className="font-semibold text-text" dir="ltr">{joinHost}</span>
            </p>
            <h1 className="mt-2 text-lg font-semibold text-muted">{L.pinTitle}</h1>
            <p
              className="mt-2 flex flex-nowrap justify-center md:justify-start gap-2 sm:gap-3 w-full"
              dir="ltr"
              aria-label={`${L.pinTitle} ${pin.split('').join(' ')}`}
            >
              {pin.split('').map((digit, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="game-pop numeral inline-flex items-center justify-center rounded-2xl bg-white text-ink font-semibold"
                  style={{
                    // Share the row evenly so six digits never wrap, up to a cap
                    // that stays readable from the back of a room.
                    flex: '1 1 0',
                    minWidth: 0,
                    maxWidth: '6.5rem',
                    aspectRatio: '3 / 4',
                    fontSize: 'clamp(2rem, 6.5vw, 5rem)',
                    animationDelay: `${i * 0.07}s`,
                  }}
                >
                  {digit}
                </span>
              ))}
            </p>

            <button
              type="button"
              onClick={handleCopy}
              className="mt-5 inline-flex items-center gap-2 min-h-11 px-4 rounded-full bg-white/10 hover:bg-white/20 font-semibold cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-leaf" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              {copied ? L.copied : L.copyLink}
            </button>
          </div>

          <div className="flex flex-col items-center gap-2 mx-auto">
            <div className="bg-white p-4 rounded-2xl">
              <QRCodeSVG value={joinUrl} size={200} level="Q" />
            </div>
            <span className="text-sm text-muted">{L.scanToJoin}</span>
          </div>
        </section>

        {isLocal && (
          <div role="note" className="w-full max-w-5xl rounded-2xl border border-warning/40 bg-warning/10 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-warning font-medium max-w-2xl">{L.localhostWarning}</p>
            {lanIp && (
              <button
                type="button"
                onClick={() => setUseLan(v => !v)}
                aria-pressed={useLan}
                className={`min-h-11 px-4 rounded-xl font-semibold cursor-pointer transition-colors ${
                  useLan ? 'bg-warning text-ink' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {L.useNetworkAddress}
                <span className="ms-2 opacity-80" dir="ltr">{lanIp}</span>
              </button>
            )}
          </div>
        )}

        <section className="w-full max-w-5xl flex flex-col items-center gap-6">
          {hasPlayers ? (
            <ul className="flex flex-wrap justify-center gap-3">
              {players.map((p, i) => (
                <PlayerBubble key={p.id} player={p} index={i} />
              ))}
            </ul>
          ) : (
            <p className="text-2xl text-muted game-pulse text-center" aria-live="polite">
              {pick(L.waitingPool, messageIdx)}
            </p>
          )}
          {hasPlayers && (
            <p className="text-muted text-center" aria-hidden="true">
              {pick(L.waitingPool, messageIdx)}
            </p>
          )}
        </section>

      </main>

        <div className="sticky bottom-0 z-10 w-full flex flex-col items-center gap-2 px-5 py-4 bg-bg border-t border-border">
          {startError && (
            <p role="alert" className="px-4 py-2 rounded-xl bg-coral/20 text-coral font-semibold">
              {startError}
            </p>
          )}
          <button
            type="button"
            onClick={handleStart}
            disabled={!hasPlayers || starting}
            className="inline-flex items-center justify-center gap-3 min-h-16 px-12 rounded-2xl bg-mark text-ink text-2xl font-semibold shadow-lg hover:brightness-105 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {starting ? <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" /> : <Play className="w-7 h-7" fill="currentColor" aria-hidden="true" />}
            {starting ? L.starting : L.start}
          </button>
          {!hasPlayers && <p className="text-muted">{L.needPlayers}</p>}
        </div>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
};

export default GameLobby;
