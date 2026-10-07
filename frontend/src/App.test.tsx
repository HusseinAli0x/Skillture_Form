import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The app talks to the API on mount; this keeps the smoke test offline.
const get = vi.fn();
vi.mock('./api/client', () => ({ default: { get, post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const { default: App } = await import('./App');

/**
 * Smoke test for the router wiring.
 *
 * The app uses only BrowserRouter, Routes, Route, Navigate, Outlet and the
 * navigation hooks — no data router, no RSC. Nothing else in the suite renders
 * App, so a react-router upgrade could otherwise break every route with a
 * green test run.
 */
describe('App routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    localStorage.clear();
  });

  it('renders the public homepage at /', async () => {
    get.mockResolvedValue({ data: {} });

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /from university to industry/i })
    ).toBeVisible();
  });

  it('lets anyone open My games at /create without signing in', async () => {
    window.history.pushState({}, '', '/create');
    get.mockResolvedValue({ data: [] });

    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: /my games/i })).toBeVisible();
    expect(window.location.pathname).toBe('/create');
  });

  it('renders the login page at /login', async () => {
    window.history.pushState({}, '', '/login');

    render(<App />);

    expect(await screen.findByLabelText(/username/i)).toBeInTheDocument();
  });

  it('sends an anonymous visitor from an admin route to /login', async () => {
    window.history.pushState({}, '', '/admin/dashboard');

    render(<App />);

    // The MainLayout guard redirects; the dashboard must never render for a
    // caller with no token. (The backend enforces this too — see S1.)
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });
});
