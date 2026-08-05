import React, { useEffect, useState } from 'react';
import { Plus, Search, GamepadIcon, Trash2, Play, Archive, Zap, Edit2, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { Quiz } from '../api/types';
import StatusDropdown from '../components/StatusDropdown';
import { useToastStore } from '../context/ToastStore';
import { useAuthStore } from '../context/AuthStore';

const QuizzesPage: React.FC = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const { addToast } = useToastStore();
  const admin = useAuthStore((state) => state.admin);

  useEffect(() => { fetchQuizzes(); }, []);

  const fetchQuizzes = async () => {
    try {
      const res = await client.get<Quiz[]>('/api/v1/quizzes');
      setQuizzes(res.data || []);
    } catch { setQuizzes([]); }
    finally { setIsLoading(false); }
  };

  const handleActivate = async (id: string) => {
    setActionId(id);
    try {
      await client.patch(`/api/v1/quizzes/${id}/activate`);
      await fetchQuizzes();
      addToast('success', 'Quiz activated successfully');
    } catch (err: any) { addToast('error', err.response?.data?.error || 'Failed to activate'); }
    finally { setActionId(null); }
  };

  const handleArchive = async (id: string) => {
    setActionId(id);
    try {
      await client.patch(`/api/v1/quizzes/${id}/archive`);
      await fetchQuizzes();
      addToast('success', 'Quiz archived successfully');
    } catch (err: any) { addToast('error', err.response?.data?.error || 'Failed to archive'); }
    finally { setActionId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this quiz?')) return;
    setActionId(id);
    try {
      await client.delete(`/api/v1/quizzes/${id}`);
      setQuizzes(prev => prev.filter(q => q.id !== id));
      addToast('success', 'Quiz deleted successfully');
    } catch (err: any) { addToast('error', err.response?.data?.error || 'Failed to delete'); }
    finally { setActionId(null); }
  };

  const filtered = quizzes.filter(q =>
    (q.title?.en || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f0f0f0' }}>Quiz Games</h1>
          <p className="mt-1 text-sm" style={{ color: '#888' }}>Manage and host your real-time quiz games.</p>
        </div>
        <button
          onClick={() => navigate('/admin/builder')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{ backgroundColor: '#0ABFBC', color: '#0a0a0a' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#09a8a5'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0ABFBC'}
        >
          <Plus className="w-4 h-4" /> New Quiz
        </button>
      </div>

      <div className="rounded-xl border" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
        {/* Toolbar */}
        <div className="flex items-center gap-4 px-5 py-4 border-b" style={{ borderColor: '#2a2a2a' }}>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#888' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search quizzes..."
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
              onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
              onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
            />
          </div>
          <span className="text-xs" style={{ color: '#888' }}>{filtered.length} quiz{filtered.length !== 1 ? 'zes' : ''}</span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: '#0ABFBC', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#888' }}>Loading quizzes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(10,191,188,0.08)', border: '1px solid rgba(10,191,188,0.15)' }}>
              <GamepadIcon className="w-7 h-7" style={{ color: '#0ABFBC' }} />
            </div>
            <p className="font-medium mb-1" style={{ color: '#f0f0f0' }}>{search ? 'No quizzes match' : 'No quizzes yet'}</p>
            <p className="text-sm mb-4" style={{ color: '#888' }}>{search ? 'Try a different search' : 'Create your first quiz to get started.'}</p>
            {!search && (
              <button
                onClick={() => navigate('/admin/builder')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'rgba(10,191,188,0.1)', color: '#0ABFBC', border: '1px solid rgba(10,191,188,0.2)' }}
              >
                <Plus className="w-4 h-4" /> Create Quiz
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>Quiz</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>Status</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: '#888' }}>Created</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: '#888' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((quiz, i) => {
                  return (
                    <tr
                      key={quiz.id}
                      className="group transition-colors"
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid #2a2a2a' : 'none' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(10,191,188,0.08)', border: '1px solid rgba(10,191,188,0.15)' }}>
                            <GamepadIcon className="w-4 h-4" style={{ color: '#0ABFBC' }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#f0f0f0' }}>{quiz.title?.en || 'Untitled'}</p>
                            {quiz.description?.en && <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: '#888' }}>{quiz.description.en}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusDropdown 
                          type="quiz" 
                          id={quiz.id} 
                          initialStatus={quiz.status} 
                          fullObject={quiz} 
                          onStatusChange={fetchQuizzes}
                        />
                      </td>
                      <td className="px-5 py-4 text-sm hidden sm:table-cell" style={{ color: '#888' }}>
                        {quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/admin/builder/${quiz.id}`)}
                            className="p-1.5 rounded-lg transition-colors"
                            title="Edit Quiz"
                            style={{ color: '#888' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#0ABFBC'; e.currentTarget.style.backgroundColor = 'rgba(10,191,188,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShareUrl(`${window.location.origin}/quiz/${quiz.id}`)}
                            className="p-1.5 rounded-lg transition-colors"
                            title="Share Quiz"
                            style={{ color: '#888' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#0ABFBC'; e.currentTarget.style.backgroundColor = 'rgba(10,191,188,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          {quiz.status === (0 as any) && (
                            <button
                              onClick={() => handleActivate(quiz.id)}
                              disabled={actionId === quiz.id}
                              className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                              title="Activate"
                              style={{ color: '#888' }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#22c97a'; e.currentTarget.style.backgroundColor = 'rgba(34,201,122,0.1)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                          )}
                          {quiz.status === (1 as any) && (
                            <>
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await client.post(`/api/v1/quizzes/${quiz.id}/sessions`, { host_id: admin?.id });
                                    addToast('success', 'Session hosted successfully');
                                    navigate(`/host/lobby/${res.data.id}`);
                                  } catch (err: any) {
                                    addToast('error', err.response?.data?.error || 'Failed to host session');
                                  }
                                }}
                                className="p-1.5 rounded-lg transition-colors"
                                title="Host Session"
                                style={{ color: '#888' }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#0ABFBC'; e.currentTarget.style.backgroundColor = 'rgba(10,191,188,0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                <Play className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleArchive(quiz.id)}
                                disabled={actionId === quiz.id}
                                className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                                title="Archive"
                                style={{ color: '#888' }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#e05555'; e.currentTarget.style.backgroundColor = 'rgba(224,85,85,0.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(quiz.id)}
                            disabled={actionId === quiz.id}
                            className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                            title="Delete"
                            style={{ color: '#888' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#e05555'; e.currentTarget.style.backgroundColor = 'rgba(224,85,85,0.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {shareUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShareUrl(null)}>
          <div className="bg-[#141414] border border-[#2a2a2a] p-6 rounded-2xl max-w-sm w-full mx-4 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#f0f0f0' }}>Share Quiz Link</h3>
            <div className="flex gap-2">
              <input 
                readOnly 
                value={shareUrl} 
                className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none" 
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  addToast('success', 'Link copied to clipboard!');
                }}
                className="bg-[#0ABFBC] hover:bg-[#09aba8] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Copy
              </button>
            </div>
            <button 
              onClick={() => setShareUrl(null)}
              className="absolute top-4 right-4 text-[#888] hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizzesPage;
