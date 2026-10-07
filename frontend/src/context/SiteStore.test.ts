import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('../api/client', () => ({ default: { get } }));

// The store keeps an in-flight request at module level, so each test gets a
// fresh copy of it.
async function freshStore() {
  vi.resetModules();
  return (await import('./SiteStore')).useSiteStore;
}

describe('SiteStore', () => {
  beforeEach(() => {
    get.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts loading with the built-in content', async () => {
    const store = await freshStore();
    const s = store.getState();
    expect(s.status).toBe('loading');
    expect(s.images).toEqual({});
    expect(s.settings.contact_email).toBe('skillture.course@gmail.com');
  });

  it('applies what the server sends', async () => {
    get.mockResolvedValue({
      data: {
        text: { en: { 'site.home.ctaPrimary': 'Join' }, ar: {} },
        images: { hand: '/uploads/a.png' },
        settings: { contact_email: 'hi@example.com' },
      },
    });
    const store = await freshStore();
    await store.getState().load();

    const s = store.getState();
    expect(get).toHaveBeenCalledWith('/api/v1/site');
    expect(s.status).toBe('ready');
    expect(s.text.en['site.home.ctaPrimary']).toBe('Join');
    expect(s.images.hand).toBe('/uploads/a.png');
    expect(s.settings.contact_email).toBe('hi@example.com');
  });

  it('shares one request between concurrent callers', async () => {
    get.mockResolvedValue({ data: {} });
    const store = await freshStore();
    await Promise.all([store.getState().load(), store.getState().load(), store.getState().load()]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('falls back to the defaults when the request fails', async () => {
    get.mockRejectedValue(new Error('offline'));
    const store = await freshStore();
    await store.getState().load();
    expect(store.getState().status).toBe('failed');
    expect(store.getState().settings.contact_email).toBe('skillture.course@gmail.com');
  });

  it('keeps good content when a later refresh fails', async () => {
    get.mockResolvedValueOnce({ data: { images: { hand: '/uploads/a.png' } } });
    const store = await freshStore();
    await store.getState().load();

    get.mockRejectedValueOnce(new Error('blip'));
    await store.getState().load();
    expect(store.getState().status).toBe('ready');
    expect(store.getState().images.hand).toBe('/uploads/a.png');
  });

  it('stops making the page wait after a short while, but still applies a late answer', async () => {
    let resolve!: (v: unknown) => void;
    get.mockReturnValue(new Promise(r => (resolve = r)));
    const store = await freshStore();
    const pending = store.getState().load();

    expect(store.getState().status).toBe('loading');
    await vi.advanceTimersByTimeAsync(2600);
    expect(store.getState().status).toBe('failed');

    resolve({ data: { images: { badge: '/uploads/b.png' } } });
    await pending;
    expect(store.getState().status).toBe('ready');
    expect(store.getState().images.badge).toBe('/uploads/b.png');
  });

  it('survives garbage from the server', async () => {
    get.mockResolvedValue({ data: 'not json' });
    const store = await freshStore();
    await store.getState().load();
    expect(store.getState().status).toBe('ready');
    expect(store.getState().text).toEqual({ en: {}, ar: {} });
  });
});
