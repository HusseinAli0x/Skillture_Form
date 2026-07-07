import React, { useEffect, useState } from 'react';
import { Plus, Search, FileText, Trash2, Eye, Edit3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import type { Form } from '../api/types';

// 0=draft, 1=published, 2=closed
const statusStyle: Record<number, { bg: string; color: string; border: string; label: string }> = {
  0: { bg: 'rgba(136,136,136,0.1)', color: '#888',    border: 'rgba(136,136,136,0.25)', label: 'Draft' },
  1: { bg: 'rgba(34,201,122,0.1)',  color: '#22c97a', border: 'rgba(34,201,122,0.25)', label: 'Published' },
  2: { bg: 'rgba(224,85,85,0.1)',   color: '#e05555', border: 'rgba(224,85,85,0.25)', label: 'Closed' },
};

const FormsPage: React.FC = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { fetchForms(); }, []);

  const fetchForms = async () => {
    try {
      const res = await client.get<Form[]>('/api/v1/forms');
      setForms(res.data || []);
    } catch { setForms([]); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this form?')) return;
    setDeletingId(id);
    try {
      await client.delete(`/api/v1/forms/${id}`);
      setForms(prev => prev.filter(f => f.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete form');
    } finally { setDeletingId(null); }
  };

  const filtered = forms.filter(f => {
    const titleStr = typeof f.title === 'string' ? f.title : ((f.title as any)?.en || '');
    return titleStr.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f0f0f0' }}>Forms</h1>
          <p className="mt-1 text-sm" style={{ color: '#888' }}>Create and manage your survey forms.</p>
        </div>
        <button
          onClick={() => navigate('/forms/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
          style={{ backgroundColor: '#0ABFBC', color: '#0a0a0a' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#09a8a5'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0ABFBC'}
        >
          <Plus className="w-4 h-4" /> New Form
        </button>
      </div>

      {/* Table Card */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
        {/* Toolbar */}
        <div className="flex items-center gap-4 px-5 py-4 border-b" style={{ borderColor: '#2a2a2a' }}>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#888' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search forms..."
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
              onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
              onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
            />
          </div>
          <span className="text-xs" style={{ color: '#888' }}>{filtered.length} form{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: '#0ABFBC', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#888' }}>Loading forms...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(10,191,188,0.08)', border: '1px solid rgba(10,191,188,0.15)' }}>
              <FileText className="w-7 h-7" style={{ color: '#0ABFBC' }} />
            </div>
            <p className="font-medium mb-1" style={{ color: '#f0f0f0' }}>{search ? 'No forms match your search' : 'No forms yet'}</p>
            <p className="text-sm mb-4" style={{ color: '#888' }}>
              {search ? 'Try a different search term' : 'Create your first form to get started.'}
            </p>
            {!search && (
              <button
                onClick={() => navigate('/forms/new')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'rgba(10,191,188,0.1)', color: '#0ABFBC', border: '1px solid rgba(10,191,188,0.2)' }}
              >
                <Plus className="w-4 h-4" /> Create Form
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>Title</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>Status</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: '#888' }}>Created</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: '#888' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((form, i) => {
                  const st = statusStyle[form.status as any as number] || statusStyle[0];
                  return (
                    <tr
                      key={form.id}
                      className="group transition-colors"
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid #2a2a2a' : 'none' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(10,191,188,0.08)', border: '1px solid rgba(10,191,188,0.15)' }}>
                            <FileText className="w-4 h-4" style={{ color: '#0ABFBC' }} />
                          </div>
                          <span className="text-sm font-medium" style={{ color: '#f0f0f0' }}>{typeof form.title === 'string' ? form.title : ((form.title as any)?.en || 'Untitled Form')}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm hidden sm:table-cell" style={{ color: '#888' }}>
                        {form.creat_at ? new Date(form.creat_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/forms/${form.id}`)}
                            className="p-1.5 rounded-lg transition-colors"
                            title="View Fields"
                            style={{ color: '#888' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#0ABFBC'; e.currentTarget.style.backgroundColor = 'rgba(10,191,188,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/forms/${form.id}/edit`)}
                            className="p-1.5 rounded-lg transition-colors"
                            title="Edit Form"
                            style={{ color: '#888' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#f0f0f0'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(form.id)}
                            disabled={deletingId === form.id}
                            className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                            title="Delete Form"
                            style={{ color: '#888' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#e05555'; e.currentTarget.style.backgroundColor = 'rgba(224,85,85,0.1)'; }}
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
    </div>
  );
};

export default FormsPage;
