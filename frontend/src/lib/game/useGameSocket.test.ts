import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameSocket } from './useGameSocket';

// A WebSocket we can drive by hand: open it, send it messages, close it.
class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
  drop() {
    this.onclose?.();
  }
}

const last = () => FakeSocket.instances[FakeSocket.instances.length - 1];

describe('useGameSocket', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports open and delivers parsed messages', () => {
    const onMessage = vi.fn();
    const onOpen = vi.fn();
    const { result } = renderHook(() => useGameSocket({ url: () => 'ws://x/1', onMessage, onOpen }));
    expect(result.current).toBe('connecting');

    act(() => last().open());
    expect(result.current).toBe('open');
    expect(onOpen).toHaveBeenCalledTimes(1);

    act(() => last().message({ type: 'question', payload: { id: 'q1' } }));
    expect(onMessage).toHaveBeenCalledWith({ type: 'question', payload: { id: 'q1' } });
  });

  it('ignores a malformed frame instead of crashing', () => {
    const onMessage = vi.fn();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderHook(() => useGameSocket({ url: () => 'ws://x/1', onMessage }));
    act(() => {
      last().open();
      last().onmessage?.({ data: 'not json' });
    });
    expect(onMessage).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('GIVES UP when the handshake keeps being rejected (it used to retry forever)', () => {
    const { result } = renderHook(() => useGameSocket({ url: () => 'ws://x/1', onMessage: vi.fn(), maxAttempts: 3 }));

    act(() => last().drop()); // failure 1, never opened
    expect(result.current).toBe('reconnecting');
    act(() => vi.advanceTimersByTime(10_000));
    act(() => last().drop()); // failure 2
    act(() => vi.advanceTimersByTime(10_000));
    act(() => last().drop()); // failure 3 -> give up

    expect(result.current).toBe('failed');
    const attempts = FakeSocket.instances.length;
    act(() => vi.advanceTimersByTime(60_000));
    expect(FakeSocket.instances.length).toBe(attempts); // no further attempts
  });

  it('a dropped connection that had been open reconnects, and a blip never counts toward giving up', () => {
    const { result } = renderHook(() => useGameSocket({ url: () => 'ws://x/1', onMessage: vi.fn(), maxAttempts: 2 }));

    for (let i = 0; i < 5; i++) {
      act(() => last().open());
      expect(result.current).toBe('open');
      act(() => last().drop());
      expect(result.current).toBe('reconnecting');
      act(() => vi.advanceTimersByTime(10_000));
    }
    expect(result.current).not.toBe('failed');
  });

  it('does not connect while disabled, and closes without reconnecting on unmount', () => {
    const { rerender, unmount } = renderHook(({ enabled }) => useGameSocket({ url: () => 'ws://x/1', onMessage: vi.fn(), enabled }), {
      initialProps: { enabled: false },
    });
    expect(FakeSocket.instances).toHaveLength(0);

    rerender({ enabled: true });
    expect(FakeSocket.instances).toHaveLength(1);

    const socket = last();
    unmount();
    expect(socket.closed).toBe(true);
    act(() => vi.advanceTimersByTime(30_000));
    expect(FakeSocket.instances).toHaveLength(1); // unmount must not schedule a reconnect
  });

  it('rebuilds the URL on every attempt', () => {
    let token = 'old';
    renderHook(() => useGameSocket({ url: () => `ws://x/?token=${token}`, onMessage: vi.fn() }));
    expect(last().url).toBe('ws://x/?token=old');
    token = 'new';
    act(() => last().drop());
    act(() => vi.advanceTimersByTime(10_000));
    expect(last().url).toBe('ws://x/?token=new');
  });
});
