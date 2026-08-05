// Single place where WebSocket URLs are built.
//
// This logic used to be copy-pasted into GameLobby, HostLiveBoard, PlayerJoin
// and PlayerLiveBoard, each with its own `ws://localhost:8080` literal.

function baseUrl(): string {
  // In dev, Vite proxies /ws to the backend (see vite.config.ts), so the
  // page origin works in both environments.
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

/**
 * URL for the host socket.
 *
 * The host stream carries the full session state, so the endpoint requires a
 * valid admin token. A browser cannot set an Authorization header on a
 * WebSocket handshake, so the token travels as a query parameter.
 */
export function hostSocketUrl(sessionId: string): string {
  const token = localStorage.getItem('token') ?? '';
  return `${baseUrl()}/ws/sessions/${sessionId}/host?token=${encodeURIComponent(token)}`;
}

/** URL for a player socket. Players have no accounts, so no token is involved. */
export function playerSocketUrl(sessionId: string, playerId: string): string {
  return `${baseUrl()}/ws/sessions/${sessionId}/join?player_id=${encodeURIComponent(playerId)}`;
}
