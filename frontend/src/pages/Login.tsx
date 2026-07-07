import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, User } from 'lucide-react';
import { useAuthStore } from '../context/AuthStore';
import client from '../api/client';
import type { AuthResponse } from '../api/types';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await client.post<AuthResponse>('/admin/login', { username, password });
      login(response.data.token, response.data.admin);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(10,191,188,0.06) 0%, transparent 70%)' }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Skillture Logo" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f0f0f0' }}>Skillture Admin</h1>
          <p className="mt-1 text-sm" style={{ color: '#888' }}>Sign in to access your dashboard</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border p-8" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-sm border" style={{ backgroundColor: 'rgba(224,85,85,0.1)', borderColor: 'rgba(224,85,85,0.3)', color: '#e05555' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#f0f0f0' }}>Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#888' }} />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                  onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                  placeholder="admin"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#f0f0f0' }}>Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#888' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                  onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 mt-2 disabled:opacity-50"
              style={{ backgroundColor: '#0ABFBC', color: '#0a0a0a' }}
              onMouseEnter={e => !isLoading && (e.currentTarget.style.backgroundColor = '#09a8a5')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0ABFBC')}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
