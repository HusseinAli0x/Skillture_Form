import React, { useEffect, useState } from 'react';
import { Plus, FileText, GamepadIcon, Activity, ArrowRight, Share2, Bot, Sparkles, Send, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import client from '../api/client';
import { FormStatus, QuizStatus } from '../api/types';
import type { Quiz, Form } from '../api/types';
import StatusDropdown from '../components/StatusDropdown';

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

const GeminiPanel: React.FC = () => {
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // The backend exposes a single report endpoint that summarises database
  // activity; it takes no prompt. There is no free-form generation route.
  const handleGenerate = async () => {
    setIsLoading(true);
    setResponse('');
    setError('');
    try {
      const res = await client.get('/api/v1/admin/ai-report');
      setResponse(res.data.report || 'No report generated.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate report.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border p-6 relative overflow-hidden" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
      <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-500/20 border border-indigo-500/30">
          <Bot className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            AI Assistant <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-indigo-500/20 text-indigo-300">Beta</span>
          </h2>
          <p className="text-xs text-slate-400">Powered by Google Gemini 2.5 Flash</p>
        </div>
      </div>
      
      <div className="space-y-4 relative z-10">
        <div className="flex items-center gap-4">
          <p className="flex-1 text-sm text-slate-400">
            Generate an activity summary across your forms, responses, quizzes and sessions.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isLoading ? 'Generating…' : 'Generate report'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">
            {error}
          </div>
        )}

        {response && (
          <div className="p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl">
            <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-wrap">
              {response}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    Promise.all([
      client.get<Quiz[]>('/api/v1/quizzes').catch(() => ({ data: [] })),
      client.get<Form[]>('/api/v1/forms').catch(() => ({ data: [] })),
    ]).then(([qRes, fRes]) => {
      setQuizzes(qRes.data || []);
      setForms(fRes.data || []);
    }).finally(() => setIsLoading(false));
  }, []);

  // status is an int16 from the API, not a string. Comparing against 'active'
  // meant this card read 0 no matter how many quizzes were active.
  const activeQuizzes = quizzes.filter(q => q.status === QuizStatus.Active).length;

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
          onClick={() => navigate('/admin/forms')}
        />
        <StatCard
          icon={<GamepadIcon className="w-5 h-5" />}
          label="Total Quizzes"
          value={isLoading ? '...' : quizzes.length}
          color="#0ABFBC"
          onClick={() => navigate('/admin/quizzes')}
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
          value={isLoading ? '...' : forms.filter(f => f.status === FormStatus.Published).length}
          color="#22c97a"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Forms */}
        <div className="rounded-xl border" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#2a2a2a' }}>
            <h2 className="font-semibold text-sm" style={{ color: '#f0f0f0' }}>Recent Forms</h2>
            <button
              onClick={() => navigate('/admin/forms')}
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
                  onClick={() => navigate('/admin/forms/new')}
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
                    <p className="text-sm font-medium truncate" style={{ color: '#f0f0f0' }}>{form.title?.en || 'Untitled Form'}</p>
                    <div className="mt-1">
                      <StatusDropdown 
                        type="form" 
                        id={form.id} 
                        initialStatus={form.status} 
                        fullObject={form} 
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/forms/${form.id}/edit`); }}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                      title="Edit Form"
                    >
                      <Edit2 className="w-4 h-4 text-slate-400 hover:text-[#0ABFBC]" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShareUrl(`${window.location.origin}/preview/form/${form.id}`); }}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                      title="Share Form"
                    >
                      <Share2 className="w-4 h-4 text-cyan-400" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Quizzes */}
        <div className="rounded-xl border" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#2a2a2a' }}>
            <h2 className="font-semibold text-sm" style={{ color: '#f0f0f0' }}>Recent Quizzes</h2>
            <button
              onClick={() => navigate('/admin/quizzes')}
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
                  onClick={() => navigate('/admin/builder')}
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
                    <div className="mt-1">
                      <StatusDropdown 
                        type="quiz" 
                        id={quiz.id} 
                        initialStatus={quiz.status} 
                        fullObject={quiz} 
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/builder/${quiz.id}`); }}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                      title="Edit Quiz"
                    >
                      <Edit2 className="w-4 h-4 text-slate-400 hover:text-[#0ABFBC]" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShareUrl(`${window.location.origin}/quiz/${quiz.id}`); }}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                      title="Share Quiz"
                    >
                      <Share2 className="w-4 h-4 text-cyan-400" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Gemini AI Panel */}
      <GeminiPanel />

      {/* Share Modal */}
      {shareUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShareUrl(null)}>
          <div 
            className="w-full max-w-sm rounded-2xl p-6 border shadow-2xl"
            style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-1" style={{ color: '#f0f0f0' }}>Share Link</h3>
            <p className="text-sm mb-6" style={{ color: '#888' }}>Scan the QR code or copy the link below.</p>
            
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-xl shadow-[0_0_20px_rgba(10,191,188,0.15)] bg-white border border-cyan-500/30">
                <QRCodeSVG value={shareUrl} size={160} />
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <input 
                type="text" 
                readOnly 
                value={shareUrl}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-black border border-[#2a2a2a] text-[#888] outline-none"
              />
              <button 
                onClick={handleCopy}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: copied ? '#22c97a' : 'rgba(10,191,188,0.1)', color: copied ? '#fff' : '#0ABFBC', border: `1px solid ${copied ? '#22c97a' : 'rgba(10,191,188,0.2)'}` }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
