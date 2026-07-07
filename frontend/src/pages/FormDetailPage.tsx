import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import type { Form, FormField } from '../api/types';

// Map int back to FieldType label
const INT_TO_LABEL: Record<number, string> = {
  1: 'Short Text', 2: 'Long Text', 3: 'Number', 4: 'Email',
  5: 'Dropdown', 6: 'Radio', 7: 'Checkbox', 8: 'Date',
};

const statusStyle: Record<string, { bg: string; color: string; border: string }> = {
  draft:     { bg: 'rgba(136,136,136,0.1)', color: '#888',    border: 'rgba(136,136,136,0.25)' },
  published: { bg: 'rgba(34,201,122,0.1)',  color: '#22c97a', border: 'rgba(34,201,122,0.25)' },
  closed:    { bg: 'rgba(224,85,85,0.1)',   color: '#e05555', border: 'rgba(224,85,85,0.25)' },
};

const FormDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      client.get<Form>(`/api/v1/forms/${id}`),
      client.get<FormField[]>(`/api/v1/forms/${id}/fields`),
    ]).then(([fRes, ffRes]) => {
      setForm(fRes.data);
      setFields(Array.isArray(ffRes.data) ? ffRes.data.sort((a, b) => a.field_order - b.field_order) : []);
    }).catch(() => navigate('/forms'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Delete this field?')) return;
    setDeletingId(fieldId);
    try {
      await client.delete(`/api/v1/fields/${fieldId}`);
      setFields(prev => prev.filter(f => f.id !== fieldId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete field');
    } finally { setDeletingId(null); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0ABFBC', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!form) return null;

  const st = statusStyle[form.status] || statusStyle.draft;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/forms')}
          className="p-2 rounded-lg transition-colors flex-shrink-0"
          style={{ color: '#888', border: '1px solid #2a2a2a' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#3a3a3a'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate" style={{ color: '#f0f0f0' }}>{form.title || 'Untitled Form'}</h1>
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0" style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
              {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
            </span>
          </div>
          {form.description && <p className="mt-0.5 text-sm truncate" style={{ color: '#888' }}>{form.description}</p>}
        </div>
        <button
          onClick={() => navigate(`/forms/new`)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0"
          style={{ backgroundColor: 'rgba(10,191,188,0.1)', color: '#0ABFBC', border: '1px solid rgba(10,191,188,0.2)' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(10,191,188,0.15)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(10,191,188,0.1)'}
        >
          <Plus className="w-4 h-4" /> Add Field
        </button>
      </div>

      {/* Fields */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#2a2a2a' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#f0f0f0' }}>
            Fields <span className="font-normal" style={{ color: '#888' }}>({fields.length})</span>
          </h2>
        </div>

        {fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm mb-4" style={{ color: '#888' }}>No fields yet. Add your first field to get started.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#2a2a2a' }}>
            {fields.map((field, i) => (
              <div
                key={field.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors group"
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {/* Order number */}
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ backgroundColor: 'rgba(10,191,188,0.08)', color: '#0ABFBC', border: '1px solid rgba(10,191,188,0.15)' }}>
                  {i + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: '#f0f0f0' }}>{field.label?.en || 'Untitled Field'}</span>
                    {field.required && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(10,191,188,0.1)', color: '#0ABFBC', border: '1px solid rgba(10,191,188,0.2)' }}>
                        Required
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#1a1a1a', color: '#888', border: '1px solid #2a2a2a' }}>
                      {INT_TO_LABEL[field.type] || `Type ${field.type}`}
                    </span>
                    {field.placeholder?.en && (
                      <span className="text-xs" style={{ color: '#888' }}>Placeholder: "{field.placeholder.en}"</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => handleDeleteField(field.id)}
                    disabled={deletingId === field.id}
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                    style={{ color: '#888' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#e05555'; e.currentTarget.style.backgroundColor = 'rgba(224,85,85,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FormDetailPage;
