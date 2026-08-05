import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import client from '../api/client';
import { FormStatus, FormStatusLabels } from '../api/types';
import type { Form, FormField } from '../api/types';
import { localized } from '../lib/i18n';
import ResponsesTable from '../components/ResponsesTable';
import { IconButton, LoadingState } from '../components/ui';

const statusBadge: Record<FormStatus, string> = {
  [FormStatus.Draft]: 'bg-panel-3 text-muted border-border-strong',
  [FormStatus.Published]: 'bg-success-soft text-success border-success',
  [FormStatus.Closed]: 'bg-danger-soft text-danger border-danger-border',
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
    ])
      .then(([fRes, ffRes]) => {
        setForm(fRes.data);
        setFields(
          Array.isArray(ffRes.data) ? ffRes.data.sort((a, b) => a.field_order - b.field_order) : []
        );
      })
      .catch(() => navigate('/admin/forms'))
      .finally(() => setIsLoading(false));
  }, [id, navigate]);

  if (isLoading) return <LoadingState message="Loading form…" />;
  if (!form) return null;

  const status = (form.status ?? FormStatus.Draft) as FormStatus;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <IconButton
          label="Back to forms"
          onClick={() => navigate('/admin/forms')}
          className="border border-border hover:border-border-strong !p-2"
        >
          <ArrowLeft className="w-4 h-4" />
        </IconButton>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate text-text">
              {localized(form.title, 'Untitled Form')}
            </h1>
            <span
              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 border ${
                statusBadge[status] ?? statusBadge[FormStatus.Draft]
              }`}
            >
              {FormStatusLabels[status] ?? FormStatusLabels[FormStatus.Draft]}
            </span>
          </div>
          {form.description && (
            <p className="mt-0.5 text-sm truncate text-muted">{localized(form.description)}</p>
          )}
        </div>
      </div>

      <ResponsesTable formId={id!} fields={fields} />
    </div>
  );
};

export default FormDetailPage;
