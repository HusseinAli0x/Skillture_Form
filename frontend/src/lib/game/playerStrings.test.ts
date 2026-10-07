import { beforeEach, describe, expect, it } from 'vitest';
import { recallPlayer, rememberPlayer } from './playerStrings';

describe('remembering a player', () => {
  beforeEach(() => sessionStorage.clear());

  it('keeps the secret the server issued, so answers and the socket can prove who they are', () => {
    rememberPlayer('p1', { name: 'Sara', avatarId: 2, secret: 'abc123' });
    expect(recallPlayer('p1')).toEqual({ name: 'Sara', avatarId: 2, secret: 'abc123' });
  });

  it('keeps players apart', () => {
    rememberPlayer('p1', { name: 'Sara', secret: 's1' });
    rememberPlayer('p2', { name: 'Omar', secret: 's2' });
    expect(recallPlayer('p1')?.secret).toBe('s1');
    expect(recallPlayer('p2')?.secret).toBe('s2');
    expect(recallPlayer('p3')).toBeNull();
  });

  it('keeps the secret even when a large photo has to be dropped to fit in storage', () => {
    rememberPlayer('p1', { name: 'Sara', avatarUrl: 'x'.repeat(200_000), secret: 'abc123' });
    const stored = recallPlayer('p1');
    expect(stored?.avatarUrl).toBeUndefined();
    expect(stored?.secret).toBe('abc123');
  });

  it('is only per tab: nothing is written to long-lived storage', () => {
    rememberPlayer('p1', { name: 'Sara', secret: 'abc123' });
    expect(localStorage.getItem('skillture-player-p1')).toBeNull();
  });
});
