import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toastDuration, useToastStore } from './ToastStore';

describe('toast store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => vi.useRealTimers());

  it('keeps errors on screen longer than confirmations', () => {
    expect(toastDuration('error')).toBeGreaterThan(toastDuration('success'));
  });

  it('removes a toast after its duration', () => {
    useToastStore.getState().addToast('success', 'Saved');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(toastDuration('success') + 10);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('caps the stack, dropping the oldest', () => {
    for (let i = 0; i < 6; i++) useToastStore.getState().addToast('info', `m${i}`);
    const messages = useToastStore.getState().toasts.map(t => t.message);
    expect(messages).toEqual(['m2', 'm3', 'm4', 'm5']);
  });
});
