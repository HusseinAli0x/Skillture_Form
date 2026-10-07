import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('../api/client', () => ({ default: { get } }));

const { countUnread, newestStamp, readSeen, useMessagesStore } = await import('./MessagesStore');

const msg = (iso: string) => ({ created_at: iso });

describe('countUnread', () => {
  it('counts only messages strictly newer than the marker', () => {
    const list = [msg('2026-01-01T10:00:00Z'), msg('2026-01-02T10:00:00Z'), msg('2026-01-03T10:00:00Z')];
    expect(countUnread(list, '2026-01-01T10:00:00Z')).toBe(2);
    expect(countUnread(list, '2026-01-03T10:00:00Z')).toBe(0);
  });

  it('is zero with no marker or a bad one', () => {
    expect(countUnread([msg('2026-01-01T10:00:00Z')], null)).toBe(0);
    expect(countUnread([msg('2026-01-01T10:00:00Z')], 'garbage')).toBe(0);
  });
});

describe('newestStamp', () => {
  it('finds the newest or null', () => {
    expect(newestStamp([])).toBeNull();
    expect(newestStamp([msg('2026-01-01T10:00:00Z'), msg('2026-02-01T10:00:00Z')])).toBe('2026-02-01T10:00:00Z');
  });
});

describe('useMessagesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    get.mockReset();
    useMessagesStore.setState({ total: null, unread: 0 });
  });

  it('starts a first-time visitor at zero unread instead of the whole backlog', async () => {
    get.mockResolvedValue({ data: [msg('2026-01-01T10:00:00Z'), msg('2026-01-02T10:00:00Z')] });
    await useMessagesStore.getState().refresh();
    expect(useMessagesStore.getState()).toMatchObject({ total: 2, unread: 0 });
    expect(readSeen()).toBe('2026-01-02T10:00:00Z');
  });

  it('reports messages that arrive after the marker, and markSeen clears them', async () => {
    localStorage.setItem('skillture.messages.seenAt', '2026-01-02T10:00:00Z');
    const list = [msg('2026-01-02T10:00:00Z'), msg('2026-01-05T10:00:00Z')];
    get.mockResolvedValue({ data: list });
    await useMessagesStore.getState().refresh();
    expect(useMessagesStore.getState().unread).toBe(1);

    useMessagesStore.getState().markSeen(list);
    expect(useMessagesStore.getState().unread).toBe(0);
    expect(readSeen()).toBe('2026-01-05T10:00:00Z');
  });

  it('keeps the previous state when the request fails', async () => {
    useMessagesStore.setState({ total: 5, unread: 2 });
    get.mockRejectedValue(new Error('offline'));
    await useMessagesStore.getState().refresh();
    expect(useMessagesStore.getState()).toMatchObject({ total: 5, unread: 2 });
  });
});
