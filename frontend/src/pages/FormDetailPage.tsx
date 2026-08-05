import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import type { Form, FormField } from '../api/types';
import ResponsesTable from '../components/ResponsesTable';

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

  useEffect(() => {
    if (!id) return;
    Promise.all([
      client.get<Form>(`/api/v1/forms/${id}`),
      client.get<FormField[]>(`/api/v1/forms/${id}/fields`),
    ]).then(([fRes, ffRes]) => {
      setForm(fRes.data);
      setFields(Array.isArray(ffRes.data) ? ffRes.data.sort((a, b) => a.field_order - b.field_order) : []);
    }).catch(() => navigate('/admin/forms'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0ABFBC', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!form) return null;

  const getStatusText = (s: number | string) => {
    if (s === 0 || s === '0') return 'draft';
    if (s === 1 || s === '1') return 'published';
    if (s === 2 || s === '2') return 'closed';
    return String(s).toLowerCase();
  };

  const statusText = getStatusText(form.status);
  const st = statusStyle[statusText] || statusStyle.draft;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/forms')}
          className="p-2 rounded-lg transition-colors flex-shrink-0"
          style={{ color: '#888', border: '1px solid #2a2a2a' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#3a3a3a'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate" style={{ color: '#f0f0f0' }}>{form.title?.en || 'Untitled Form'}</h1>
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0" style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
              {statusText.charAt(0).toUpperCase() + statusText.slice(1)}
            </span>
          </div>
          {form.description && <p className="mt-0.5 text-sm truncate" style={{ color: '#888' }}>{form.description.en}</p>}
        </div>
      </div>

      <ResponsesTable formId={id!} fields={fields} />
    </div>
  );
};

export default FormDetailPage;
