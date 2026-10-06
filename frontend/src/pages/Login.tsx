import React, { useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { ArrowLeft, Eye, EyeOff, KeyRound, TriangleAlert, User } from 'lucide-react';
import { useAuthStore } from '../context/AuthStore';
import client from '../api/client';
import { loginErrorMessage, safeReturnPath } from '../lib/loginError';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import type { AuthResponse } from '../api/types';
import { Button, Input, Label } from '../components/ui';
import { Logo, Pattern, brandAssets } from '../components/brand';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const login = useAuthStore(state => state.login);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  useDocumentTitle('Sign in · Skillture Admin');

  // Signed in (here or in another tab): go back to the page that sent us, or
  // the dashboard. Doing this here rather than in the route table is what lets
  // a fresh sign-in return to where the admin was.
  if (isAuthenticated) {
    return <Navigate to={safeReturnPath((location.state as { from?: string } | null)?.from)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      const response = await client.post<AuthResponse>('/admin/login', { username: username.trim(), password });
      // The redirect above takes over once the store flips.
      login(response.data.token, response.data.admin);
    } catch (err) {
      setError(loginErrorMessage(err));
      setIsLoading(false);
      // Put the cursor where the fix happens, with the old attempt selected.
      requestAnimationFrame(() => {
        passwordRef.current?.focus();
        passwordRef.current?.select();
      });
    }
  };

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-2">
      {/* Brand side. Desktop: the poster fills the half. Mobile: a short header. */}
      <div className="relative overflow-hidden lg:hidden bg-[linear-gradient(135deg,#01a3a3,#006b6b)] h-28 flex items-center px-6">
        <Pattern className="text-white opacity-[0.08]" />
        <Logo variant="full" className="relative h-8 !text-white" />
      </div>
      <div className="relative hidden lg:block bg-teal">
        <img
          src={brandAssets.poster}
          alt="Skillture: workshops that improve you."
          width={1125}
          height={1500}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </div>

      {/* Form side */}
      <main className="relative flex items-center justify-center px-6 py-10 sm:px-10 min-h-[calc(100dvh-7rem)] lg:min-h-dvh overflow-hidden">
        <Pattern className="text-primary opacity-[0.03]" />
        <div className="relative w-full max-w-sm">
          <Logo variant="icon" className="h-10 mb-8 hidden lg:inline-block" />
          <h1 className="text-4xl font-bold tracking-tight text-text">Sign in</h1>
          <p className="mt-2 text-sm text-muted">Admin access for the Skillture team.</p>

          {error && (
            <div
              role="alert"
              id="login-error"
              className="mt-6 flex items-start gap-3 px-4 py-3 rounded-lg text-sm border bg-danger-soft border-danger-border text-text"
            >
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-danger" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <Label htmlFor="username" className="!text-sm !text-text">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={isLoading}
                invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
                icon={<User className="w-4 h-4" />}
                className="!py-3"
              />
            </div>

            <div>
              <Label htmlFor="password" className="!text-sm !text-text">
                Password
              </Label>
              <Input
                ref={passwordRef}
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))}
                onBlur={() => setCapsLock(false)}
                disabled={isLoading}
                invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
                icon={<KeyRound className="w-4 h-4" />}
                className="!py-3"
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-md text-muted hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              {capsLock && <p className="mt-1.5 text-xs text-warning">Caps Lock is on.</p>}
            </div>

            <Button type="submit" size="lg" block loading={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 min-h-11 text-sm text-muted hover:text-text rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" /> Back to the site
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Login;
