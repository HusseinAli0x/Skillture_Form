import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeadline } from './useDeadline';

describe('useDeadline', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'] });
  });
  afterEach(() => vi.useRealTimers());

  it('counts down from the full duration using the clock', () => {
    const { result } = renderHook(() => useDeadline(10, true));
    expect(result.current.remainingSec).toBe(10);

    act(() => vi.advanceTimersByTime(4_000));
    expect(result.current.remainingSec).toBe(6);
    expect(result.current.remainingMs).toBeLessThanOrEqual(6_100);
    expect(result.current.remainingMs).toBeGreaterThan(5_800);
  });

  it('tracks the clock over a long stretch without drifting', () => {
    const { result } = renderHook(() => useDeadline(30, true));
    act(() => vi.advanceTimersByTime(25_000));
    // Remaining time is deadline - now, so it stays within one frame of exact.
    expect(result.current.remainingMs).toBeGreaterThan(4_900);
    expect(result.current.remainingMs).toBeLessThanOrEqual(5_100);
  });

  it('fires onExpire exactly once and stops at zero', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useDeadline(3, true, onExpire));
    act(() => vi.advanceTimersByTime(2_000));
    expect(onExpire).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(3_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(result.current.remainingMs).toBe(0);

    act(() => vi.advanceTimersByTime(5_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('reports elapsed time since it started, for scoring speed', () => {
    const { result } = renderHook(() => useDeadline(20, true));
    act(() => vi.advanceTimersByTime(7_000));
    expect(result.current.elapsedMs()).toBeGreaterThanOrEqual(6_900);
    expect(result.current.elapsedMs()).toBeLessThanOrEqual(7_200);
  });

  it('does nothing while not running or with no duration', () => {
    const onExpire = vi.fn();
    const paused = renderHook(() => useDeadline(5, false, onExpire));
    const unlimited = renderHook(() => useDeadline(null, true, onExpire));
    act(() => vi.advanceTimersByTime(20_000));
    expect(onExpire).not.toHaveBeenCalled();
    expect(paused.result.current.remainingSec).toBe(5);
    expect(unlimited.result.current.remainingMs).toBe(0);
  });

  it('STILL expires when animation frames stop (a hidden tab), because expiry is timer-driven', () => {
    // Browsers do not fire requestAnimationFrame in a background tab. Simulate
    // that by making frames never run; only timeouts remain.
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const onExpire = vi.fn();
    renderHook(() => useDeadline(15, true, onExpire));

    act(() => vi.advanceTimersByTime(14_000));
    expect(onExpire).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1_500));
    expect(onExpire).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('re-reads the clock when the tab becomes visible again', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const { result } = renderHook(() => useDeadline(30, true));

    act(() => {
      vi.advanceTimersByTime(12_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.remainingMs).toBeGreaterThan(17_500);
    expect(result.current.remainingMs).toBeLessThanOrEqual(18_100);
    vi.unstubAllGlobals();
  });
});
