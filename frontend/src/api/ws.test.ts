import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('./client', () => ({ default: { post } }));

const { hostSocketUrl, hostSocketUrlForTicket, openGameSocket, playerSocketUrl } = await import('./ws');

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  url: string;
  readyState = 0;
  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }
  close() {
    this.readyState = 3;
  }
}
const sockets = () => FakeSocket.instances;

describe('socket URLs', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('builds the host URL from a ticket, never a token', () => {
    const url = hostSocketUrlForTicket('s1', 'tick et');
    expect(url).toBe(`ws://${window.location.host}/ws/sessions/s1/host?ticket=tick%20et`);
    expect(url).not.toContain('token');
  });

  it('buys a ticket for the session and puts it in the URL', async () => {
    post.mockResolvedValue({ data: { ticket: 'abc123', expires_in: 60 } });
    const url = await hostSocketUrl('sess-9');
    expect(post).toHaveBeenCalledWith('/api/v1/sessions/sess-9/ws-ticket');
    expect(url).toMatch(/\/ws\/sessions\/sess-9\/host\?ticket=abc123$/);
  });

  it('fetches a NEW ticket on every call', async () => {
    post.mockResolvedValueOnce({ data: { ticket: 't1', expires_in: 60 } }).mockResolvedValueOnce({ data: { ticket: 't2', expires_in: 60 } });
    expect(await hostSocketUrl('s')).toContain('ticket=t1');
    expect(await hostSocketUrl('s')).toContain('ticket=t2');
  });

  it('rejects when the server refuses the ticket', async () => {
    post.mockRejectedValue(new Error('404'));
    await expect(hostSocketUrl('s')).rejects.toThrow();
  });

  it('rejects an answer without a ticket', async () => {
    post.mockResolvedValue({ data: {} });
    await expect(hostSocketUrl('s')).rejects.toThrow(/ticket/i);
  });

  it('builds the player socket without a secret for a player who has none', () => {
    expect(playerSocketUrl('s1', 'p 1')).toBe(`ws://${window.location.host}/ws/sessions/s1/join?player_id=p%201`);
  });

  it('adds the player secret, escaped, so the socket proves whose it is', () => {
    expect(playerSocketUrl('s1', 'p1', 'se&cret/+')).toBe(
      `ws://${window.location.host}/ws/sessions/s1/join?player_id=p1&secret=se%26cret%2F%2B`,
    );
  });
});

describe('openGameSocket with an async URL', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('connects once the URL resolves', async () => {
    const getUrl = vi.fn().mockResolvedValue('ws://x/a');
    const onStatus = vi.fn();
    const handle = openGameSocket(getUrl, { onMessage: vi.fn(), onStatus });
    expect(sockets()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(sockets()).toHaveLength(1);
    expect(sockets()[0].url).toBe('ws://x/a');
    sockets()[0].onopen?.();
    expect(onStatus).toHaveBeenLastCalledWith('open');
    handle.close();
  });

  it('asks for a fresh URL on every reconnect', async () => {
    let n = 0;
    const getUrl = vi.fn(async () => `ws://x/${++n}`);
    const handle = openGameSocket(getUrl, { onMessage: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    sockets()[0].onclose?.();
    await vi.advanceTimersByTimeAsync(1000);
    expect(getUrl).toHaveBeenCalledTimes(2);
    expect(sockets().map(s => s.url)).toEqual(['ws://x/1', 'ws://x/2']);
    handle.close();
  });

  it('retries when fetching the URL fails', async () => {
    const getUrl = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('ws://x/ok');
    const onStatus = vi.fn();
    const handle = openGameSocket(getUrl, { onMessage: vi.fn(), onStatus });
    await vi.advanceTimersByTimeAsync(0);
    expect(sockets()).toHaveLength(0);
    expect(onStatus).toHaveBeenLastCalledWith('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets()).toHaveLength(1);
    handle.close();
  });

  it('does not open a socket if closed while the URL was loading', async () => {
    let resolve!: (u: string) => void;
    const getUrl = vi.fn(() => new Promise<string>(r => (resolve = r)));
    const handle = openGameSocket(getUrl, { onMessage: vi.fn() });
    handle.close();
    resolve('ws://x/late');
    await vi.advanceTimersByTimeAsync(0);
    expect(sockets()).toHaveLength(0);
  });
});
