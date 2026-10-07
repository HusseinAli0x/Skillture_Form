import { useEffect, useRef, useState } from 'react';
import { openGameSocket, type SocketStatus } from '../../api/ws';
import type { GameMessage } from '../../api/types';

/**
 * Keeps a game socket open for as long as the component is mounted and
 * reconnects it when it drops. `onMessage` may change on every render; the
 * latest one is always called. `onOpen` fires on the first connect and again
 * after every reconnect — the place to resync anything missed while offline.
 */
export function useGameSocket(
  getUrl: (() => string) | null,
  onMessage: (msg: GameMessage) => void,
  onOpen?: () => void
): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const handler = useRef(onMessage);
  const opened = useRef(onOpen);
  handler.current = onMessage;
  opened.current = onOpen;

  // The URL is a string key so a new closure each render does not reconnect.
  const key = getUrl ? getUrl() : null;

  useEffect(() => {
    if (!key) return;
    const socket = openGameSocket(() => getUrl?.() ?? key, {
      onMessage: msg => handler.current(msg),
      onStatus: s => {
        setStatus(s);
        if (s === 'open') opened.current?.();
      },
    });
    return () => socket.close();
    // getUrl is read through `key`; reconnecting on its identity would drop the socket every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return status;
}
