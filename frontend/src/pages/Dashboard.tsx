import React, { useEffect, useState } from 'react';
import { Plus, FileText, GamepadIcon, Activity, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { Quiz, Form } from '../api/types';

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number | string; color: string; onClick?: () => void }> = ({ icon, label, value, color, onClick }) => (
  <div
    onClick={onClick}
    className="rounded-xl border p-5 relative overflow-hidden transition-all duration-200 group"
    style={{ backgroundColor: '#141414', borderColor: '#2a2a2a', cursor: onClick ? 'pointer' : 'default' }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = '#3a3a3a'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; }}
  >
    <div className="flex items-center justify-between mb-4">
      <p className="text-sm font-medium" style={{ color: '#888' }}>{label}</p>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
        <span style={{ color }}>{icon}</span>
      </div>
    </div>
    <p className="text-3xl font-bold" style={{ color: '#f0f0f0' }}>{value}</p>
    {onClick && (
      <div className="flex items-center gap-1 mt-3 text-xs font-medium transition-colors" style={{ color: '#888' }}>
        View all <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" style={{ color: '#0ABFBC' }} />
      </div>
    )}
  </div>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get<Quiz[]>('/api/v1/quizzes').catch(() => ({ data: [] })),
      client.get<Form[]>('/api/v1/forms').catch(() => ({ data: [] })),
    ]).then(([qRes, fRes]) => {
      setQuizzes(qRes.data || []);
      setForms(fRes.data || []);
    }).finally(() => setIsLoading(false));
  }, []);

  const activeQuizzes = quizzes.filter(q => q.status === 'active').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f0f0f0' }}>Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: '#888' }}>Overview of your forms and quiz games.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Total Forms"
          value={isLoading ? '...' : forms.length}
          color="#0ABFBC"
          onClick={() => navigate('/forms')}
        />
        <StatCard
          icon={<GamepadIcon className="w-5 h-5" />}
          label="Total Quizzes"
          value={isLoading ? '...' : quizzes.length}
          color="#0ABFBC"
          onClick={() => navigate('/quizzes')}
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Active Quizzes"
          value={isLoading ? '...' : activeQuizzes}
          color="#22c97a"
        />
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Published Forms"
          value={isLoading ? '...' : forms.filter(f => f.status === 'published').length}
          color="#22c97a"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Forms */}
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#2a2a2a' }}>
            <h2 className="font-semibold text-sm" style={{ color: '#f0f0f0' }}>Recent Forms</h2>
            <button
              onClick={() => navigate('/forms')}
              className="text-xs font-medium flex items-center gap-1 transition-colors"
              style={{ color: '#0ABFBC' }}
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: '#2a2a2a' }}>
            {isLoading ? (
              <p className="px-5 py-8 text-center text-sm" style={{ color: '#888' }}>Loading...</p>
            ) : forms.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm mb-3" style={{ color: '#888' }}>No forms yet</p>
                <button
                  onClick={() => navigate('/forms/new')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ backgroundColor: 'rgba(10,191,188,0.1)', color: '#0ABFBC', border: '1px solid rgba(10,191,188,0.2)' }}
                >
                  <Plus className="w-3.5 h-3.5" /> Create First Form
                </button>
              </div>
            ) : (
              forms.slice(0, 4).map(form => (
                <div
                  key={form.id}
                  onClick={() => navigate(`/forms/${form.id}`)}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(10,191,188,0.08)', border: '1px solid rgba(10,191,188,0.15)' }}>
                    <FileText className="w-4 h-4" style={{ color: '#0ABFBC' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#f0f0f0' }}>{form.title || 'Untitled Form'}</p>
                    <p className="text-xs capitalize" style={{ color: '#888' }}>{form.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Quizzes */}
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#2a2a2a' }}>
            <h2 className="font-semibold text-sm" style={{ color: '#f0f0f0' }}>Recent Quizzes</h2>
            <button
              onClick={() => navigate('/quizzes')}
              className="text-xs font-medium flex items-center gap-1 transition-colors"
              style={{ color: '#0ABFBC' }}
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div>
            {isLoading ? (
              <p className="px-5 py-8 text-center text-sm" style={{ color: '#888' }}>Loading...</p>
            ) : quizzes.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm mb-3" style={{ color: '#888' }}>No quizzes yet</p>
                <button
                  onClick={() => navigate('/builder')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ backgroundColor: 'rgba(10,191,188,0.1)', color: '#0ABFBC', border: '1px solid rgba(10,191,188,0.2)' }}
                >
                  <Plus className="w-3.5 h-3.5" /> Create First Quiz
                </button>
              </div>
            ) : (
              quizzes.slice(0, 4).map(quiz => (
                <div
                  key={quiz.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors border-b last:border-b-0"
                  style={{ borderColor: '#2a2a2a' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(10,191,188,0.08)', border: '1px solid rgba(10,191,188,0.15)' }}>
                    <GamepadIcon className="w-4 h-4" style={{ color: '#0ABFBC' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#f0f0f0' }}>{quiz.title?.en || 'Untitled Quiz'}</p>
                    <p className="text-xs capitalize" style={{ color: quiz.status === 'active' ? '#22c97a' : '#888' }}>{quiz.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
