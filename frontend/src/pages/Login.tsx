import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, User } from 'lucide-react';
import { useAuthStore } from '../context/AuthStore';
import client from '../api/client';
import type { AuthResponse } from '../api/types';
import { Button, Input } from '../components/ui';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore(state => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await client.post<AuthResponse>('/admin/login', { username, password });
      login(response.data.token, response.data.admin);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-bg">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none bg-[radial-gradient(circle,var(--color-primary)_0%,transparent_70%)] opacity-[0.06]" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-text">Skillture Admin</h1>
          <p className="mt-1 text-sm text-muted">Sign in to access your dashboard</p>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-8">
          {error && (
            <div
              role="alert"
              className="mb-5 px-4 py-3 rounded-lg text-sm border bg-danger-soft border-danger-border text-danger"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5 text-text">
                Username
              </label>
              <Input
                id="username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                icon={<User className="w-4 h-4" />}
                placeholder="admin"
                className="!py-2.5 !rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-text">
                Password
              </label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                icon={<KeyRound className="w-4 h-4" />}
                placeholder="••••••••"
                className="!py-2.5 !rounded-xl"
              />
            </div>

            <Button type="submit" block loading={isLoading} className="!rounded-xl mt-2">
              {isLoading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
