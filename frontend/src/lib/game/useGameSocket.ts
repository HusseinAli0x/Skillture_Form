import { useEffect, useRef, useState } from 'react';

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'failed';

interface Options {
  /** Builds the URL on every attempt, so a token refreshed meanwhile is used. */
  url: () => string;
  onMessage: (message: { type: string; payload: unknown }) => void;
  /** Called each time the socket (re)opens. */
  onOpen?: () => void;
  /** Consecutive failed attempts before giving up. */
  maxAttempts?: number;
  /** Set false to hold off connecting (e.g. until a player id exists). */
  enabled?: boolean;
}

/**
 * A game WebSocket that reconnects with backoff and, unlike the loops it
 * replaces, **gives up**. A rejected handshake (wrong session, a player that no
 * longer exists) used to retry every three seconds forever, with the screen
 * stuck on "waiting". After `maxAttempts` failures in a row the status becomes
 * 'failed' so the screen can say so and offer a way out.
 *
 * A successful open resets the failure count, so a brief network blip never
 * counts toward giving up.
 */
export function useGameSocket({ url, onMessage, onOpen, maxAttempts = 6, enabled = true }: Options): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  // Latest callbacks without re-running the effect (and dropping the socket)
  // every render.
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const urlRef = useRef(url);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    urlRef.current = url;
  });

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      ws = new WebSocket(urlRef.current());
      let opened = false;

      ws.onopen = () => {
        opened = true;
        failures = 0;
        setStatus('open');
        onOpenRef.current?.();
      };
      ws.onmessage = event => {
        try {
          onMessageRef.current(JSON.parse(event.data));
        } catch (err) {
          console.error('Malformed game message', err);
        }
      };
      ws.onclose = () => {
        if (disposed) return;
        if (!opened) failures++;
        if (failures >= maxAttempts) {
          setStatus('failed');
          return;
        }
        setStatus('reconnecting');
        timer = setTimeout(connect, Math.min(1000 * 2 ** Math.min(failures, 3), 8000));
      };
    };

    setStatus('connecting');
    connect();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [enabled, maxAttempts]);

  return status;
}
