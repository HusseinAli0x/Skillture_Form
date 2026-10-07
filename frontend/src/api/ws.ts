// Single place where WebSocket URLs are built and sockets are kept alive.
//
// This logic used to be copy-pasted into GameLobby, HostLiveBoard, PlayerJoin
// and PlayerLiveBoard, each with its own `ws://localhost:8080` literal and
// its own (or no) reconnect handling.

import client from './client';
import type { GameMessage } from './types';

function baseUrl(): string {
  // In dev, Vite proxies /ws to the backend (see vite.config.ts), so the
  // page origin works in both environments.
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

/** Shape of POST /api/v1/sessions/:id/ws-ticket. */
interface TicketResponse {
  ticket: string;
  expires_in: number;
}

/** The host socket address for an already-issued ticket. */
export function hostSocketUrlForTicket(sessionId: string, ticket: string): string {
  return `${baseUrl()}/ws/sessions/${encodeURIComponent(sessionId)}/host?ticket=${encodeURIComponent(ticket)}`;
}

/**
 * URL for the host socket.
 *
 * The host stream carries the full session state, so only the session's host
 * (an admin, or the visitor whose host key created it) may open it. A browser
 * cannot set headers on a WebSocket handshake, so the request proves who it is
 * by buying a ticket with its normal headers first. A ticket works once and
 * expires after about a minute, which is why every connection attempt, retries
 * included, must call this again.
 */
export async function hostSocketUrl(sessionId: string): Promise<string> {
  const res = await client.post<TicketResponse>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/ws-ticket`);
  const ticket = res.data?.ticket;
  if (!ticket) throw new Error('The server did not issue a socket ticket.');
  return hostSocketUrlForTicket(sessionId, ticket);
}

/**
 * URL for a player socket. Players have no accounts; the secret they were given
 * when they joined proves the socket is theirs (the player id is public).
 */
export function playerSocketUrl(sessionId: string, playerId: string, secret?: string): string {
  const secretParam = secret ? `&secret=${encodeURIComponent(secret)}` : '';
  return `${baseUrl()}/ws/sessions/${sessionId}/join?player_id=${encodeURIComponent(playerId)}${secretParam}`;
}

/** `open` once connected; `reconnecting` while a retry is pending. */
export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Delay before reconnect attempt `n` (0-based): 0.8s, 1.6s, 2.4s … capped at 5s. */
export function reconnectDelay(attempt: number): number {
  return Math.min(5000, 800 * (attempt + 1));
}

export interface SocketHandlers {
  onMessage: (msg: GameMessage) => void;
  onStatus?: (status: SocketStatus) => void;
}

/**
 * A WebSocket that reconnects on its own.
 *
 * `getUrl` is called for every attempt (it may be async, e.g. to fetch a fresh
 * single-use host ticket). Retries stop only on `close()`. A phone coming back
 * online or a tab becoming visible again retries immediately rather than
 * waiting out the backoff.
 */
export function openGameSocket(getUrl: () => string | Promise<string>, handlers: SocketHandlers): { close: () => void } {
  let ws: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let stopped = false;

  const setStatus = (s: SocketStatus) => handlers.onStatus?.(s);

  const scheduleRetry = () => {
    if (stopped || timer) return;
    setStatus('reconnecting');
    timer = setTimeout(connect, reconnectDelay(attempt++));
  };

  function connect() {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = null;
    setStatus(attempt === 0 ? 'connecting' : 'reconnecting');

    const fail = () => scheduleRetry();
    let pending: string | Promise<string>;
    try {
      pending = getUrl();
    } catch {
      fail();
      return;
    }
    if (typeof pending === 'string') attach(pending);
    else
      pending.then(
        url => attach(url),
        () => fail()
      );
  }

  function attach(url: string) {
    // close() may have run while a ticket was being fetched.
    if (stopped) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      scheduleRetry();
      return;
    }
    ws = socket;

    socket.onopen = () => {
      attempt = 0;
      setStatus('open');
    };
    socket.onmessage = event => {
      try {
        handlers.onMessage(JSON.parse(event.data) as GameMessage);
      } catch (err) {
        console.error('Malformed game message', err);
      }
    };
    socket.onclose = () => {
      if (ws === socket) ws = null;
      scheduleRetry();
    };
  }

  const retryNow = () => {
    if (stopped || (ws && ws.readyState <= WebSocket.OPEN)) return;
    attempt = 0;
    connect();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') retryNow();
  };
  window.addEventListener('online', retryNow);
  document.addEventListener('visibilitychange', onVisible);

  connect();

  return {
    close() {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', retryNow);
      document.removeEventListener('visibilitychange', onVisible);
      if (ws) {
        // Clear onclose first, or tearing down schedules another reconnect.
        ws.onclose = null;
        ws.close();
        ws = null;
      }
      setStatus('closed');
    },
  };
}
