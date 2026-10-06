import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Edit3, ExternalLink, Share2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import client from '../api/client';
import { FormStatus, FormStatusLabels } from '../api/types';
import type { Form, FormField } from '../api/types';
import { apiErrorStatus } from '../lib/apiError';
import { localized } from '../lib/i18n';
import { formShareUrl } from '../lib/links';
import ResponsesTable from '../components/ResponsesTable';
import ShareModal from '../components/ShareModal';
import { Button, Card, ErrorState, IconButton, Skeleton, SkeletonRows, StatusChip, statusTone } from '../components/ui';

const FormDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failure, setFailure] = useState<'none' | 'missing' | 'error'>('none');
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setFailure('none');
    try {
      const [fRes, ffRes] = await Promise.all([
        client.get<Form>(`/api/v1/forms/${id}`),
        client.get<FormField[]>(`/api/v1/forms/${id}/fields`),
      ]);
      setForm(fRes.data);
      setFields(Array.isArray(ffRes.data) ? [...ffRes.data].sort((a, b) => a.field_order - b.field_order) : []);
    } catch (err) {
      setFailure(apiErrorStatus(err) === 404 ? 'missing' : 'error');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <Link
      to="/admin/forms"
      className="inline-flex items-center gap-2 min-h-11 text-sm text-muted hover:text-text rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" /> All forms
    </Link>
  );

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        {back}
        <Skeleton className="h-9 w-64" />
        <Card>
          <SkeletonRows rows={5} label="Loading form" />
        </Card>
      </div>
    );
  }

  if (failure !== 'none' || !form) {
    return (
      <div className="space-y-6">
        {back}
        <Card>
          {failure === 'missing' ? (
            <ErrorState
              title="This form does not exist"
              message="It may have been deleted. Head back to the list to pick another."
              retryLabel="Back to forms"
              onRetry={() => navigate('/admin/forms')}
            />
          ) : (
            <ErrorState title="Could not load this form" onRetry={load} />
          )}
        </Card>
      </div>
    );
  }

  const status = (form.status ?? FormStatus.Draft) as FormStatus;
  const title = localized(form.title, 'Untitled form');

  return (
    <div className="space-y-6">
      {back}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight text-text break-words">{title}</h1>
            <StatusChip tone={statusTone(status)}>{FormStatusLabels[status] ?? FormStatusLabels[FormStatus.Draft]}</StatusChip>
          </div>
          {form.description && <p className="mt-1 text-sm text-muted">{localized(form.description)}</p>}
          <p className="mt-1 text-xs text-muted">
            {fields.length} {fields.length === 1 ? 'question' : 'questions'}
            {status === FormStatus.Published ? '' : ' · not accepting responses'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" onClick={() => navigate(`/admin/forms/${form.id}/edit`)}>
            <Edit3 className="w-4 h-4" /> Edit
          </Button>
          <Button variant="secondary" onClick={() => setSharing(true)}>
            <Share2 className="w-4 h-4" /> Share
          </Button>
          <IconButton
            label="Open the public form in a new tab"
            onClick={() => window.open(formShareUrl(form.id), '_blank', 'noopener,noreferrer')}
            className="border border-border hover:border-border-strong !p-2.5"
          >
            <ExternalLink className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      <ResponsesTable formId={form.id} fields={fields} />

      {sharing && (
        <ShareModal
          url={formShareUrl(form.id)}
          title={`Share "${title}"`}
          onClose={() => setSharing(false)}
          description={
            status === FormStatus.Published
              ? undefined
              : 'This form is not published yet, so people cannot submit it. Publish it first.'
          }
        />
      )}
    </div>
  );
};

export default FormDetailPage;
