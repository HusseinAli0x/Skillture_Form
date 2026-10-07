import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, FileText, Trash2, BarChart3, Edit3, Share2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import client from '../api/client';
import { apiErrorMessage } from '../lib/apiError';
import { FormStatus } from '../api/types';
import type { Form } from '../api/types';
import { localized } from '../lib/i18n';
import StatusDropdown, { type StatusValue } from '../components/StatusDropdown';
import ShareModal from '../components/ShareModal';
import { useToastStore } from '../context/ToastStore';
import { formShareUrl } from '../lib/links';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  PageHeader,
  SkeletonRows,
  Tabs,
  type TabItem,
} from '../components/ui';

type Filter = 'all' | 'published' | 'draft' | 'closed';

const FILTER_STATUS: Record<Exclude<Filter, 'all'>, FormStatus> = {
  published: FormStatus.Published,
  draft: FormStatus.Draft,
  closed: FormStatus.Closed,
};

const FormsPage: React.FC = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Form | null>(null);
  const [shareForm, setShareForm] = useState<{ id: string; title: string } | null>(null);
  const { addToast } = useToastStore();

  const fetchForms = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const res = await client.get<Form[]>('/api/v1/forms');
      setForms(Array.isArray(res.data) ? res.data : []);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchForms();
  }, [fetchForms]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeletingId(id);
    try {
      await client.delete(`/api/v1/forms/${id}`);
      setForms(prev => prev.filter(f => f.id !== id));
      addToast('success', 'Form deleted');
      setPendingDelete(null);
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Could not delete the form. Try again.'));
    } finally {
      setDeletingId(null);
    }
  };

  const onStatusChange = (id: string, status: StatusValue) => {
    setForms(prev => prev.map(f => (f.id === id ? { ...f, status: status as FormStatus } : f)));
  };

  const counts = useMemo(
    () => ({
      all: forms.length,
      published: forms.filter(f => f.status === FormStatus.Published).length,
      draft: forms.filter(f => f.status === FormStatus.Draft).length,
      closed: forms.filter(f => f.status === FormStatus.Closed).length,
    }),
    [forms]
  );

  const tabs: TabItem<Filter>[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'published', label: 'Published', count: counts.published },
    { id: 'draft', label: 'Drafts', count: counts.draft },
    { id: 'closed', label: 'Closed', count: counts.closed },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...forms]
      .sort((a, b) => Date.parse(b.creat_at) - Date.parse(a.creat_at))
      .filter(f => filter === 'all' || f.status === FILTER_STATUS[filter])
      .filter(f => !query || localized(f.title, 'Untitled form').toLowerCase().includes(query));
  }, [forms, search, filter]);

  const hasFilters = search.trim() !== '' || filter !== 'all';
  const clearFilters = () => {
    setSearch('');
    setFilter('all');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms"
        description="Sign-ups, feedback and surveys. Publish one to start collecting answers."
        action={
          <Button onClick={() => navigate('/admin/forms/new')}>
            <Plus className="w-4 h-4" /> New form
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-5 py-4 border-b border-border">
          <div className="lg:w-72">
            <Input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search forms"
              aria-label="Search forms"
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <Tabs items={tabs} value={filter} onChange={setFilter} label="Filter forms by status" className="lg:ms-auto" />
        </div>

        {isLoading ? (
          <SkeletonRows rows={5} label="Loading forms" />
        ) : loadFailed ? (
          <ErrorState title="Could not load forms" onRetry={fetchForms} />
        ) : forms.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-7 h-7" />}
            title="No forms yet"
            description="A form collects answers from people: event sign-ups, feedback, anything. Build one, publish it, share the link or QR code."
            action={
              <Button onClick={() => navigate('/admin/forms/new')}>
                <Plus className="w-4 h-4" /> Create your first form
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            compact
            icon={<Search className="w-6 h-6" />}
            title="No forms match"
            description="Try a different search, or clear the filters."
            action={
              hasFilters && (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="w-full">
            <table className="w-full text-start max-md:block">
              <thead className="max-md:hidden">
                <tr className="border-b border-border bg-hover-overlay">
                  <th scope="col" className="px-5 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted">
                    Title
                  </th>
                  <th scope="col" className="px-5 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted">
                    Created
                  </th>
                  <th scope="col" className="px-5 py-3 text-end text-xs font-semibold uppercase tracking-wider text-muted">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="max-md:block">
                {filtered.map((form, i) => {
                  const title = localized(form.title, 'Untitled form');
                  return (
                    <tr
                      key={form.id}
                      className={`transition-colors hover:bg-hover-overlay max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3 max-md:gap-y-2 max-md:px-4 max-md:py-3 ${
                        i < filtered.length - 1 ? 'border-b border-border' : ''
                      }`}
                    >
                      <td className="md:px-5 md:py-3.5 max-md:w-full">
                        <Link
                          to={`/admin/forms/${form.id}`}
                          className="flex items-center gap-3 min-w-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-subtle border border-primary-border-soft text-primary">
                            <FileText className="w-4 h-4" />
                          </span>
                          <span className="text-sm font-medium text-text hover:text-primary truncate">{title}</span>
                        </Link>
                      </td>
                      <td className="md:px-5 md:py-3.5">
                        <StatusDropdown
                          type="form"
                          id={form.id}
                          initialStatus={form.status}
                          onStatusChange={status => onStatusChange(form.id, status)}
                        />
                      </td>
                      <td className="md:px-5 md:py-3.5 text-sm text-muted whitespace-nowrap">
                        {form.creat_at
                          ? new Date(form.creat_at).toLocaleDateString('en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="md:px-5 md:py-3.5 max-md:ms-auto">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton
                            label={`Responses for ${title}`}
                            tone="primary"
                            onClick={() => navigate(`/admin/forms/${form.id}`)}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </IconButton>
                          <IconButton label={`Edit ${title}`} onClick={() => navigate(`/admin/forms/${form.id}/edit`)}>
                            <Edit3 className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            label={`Share ${title}`}
                            tone="info"
                            onClick={() => setShareForm({ id: form.id, title })}
                          >
                            <Share2 className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            label={`Delete ${title}`}
                            tone="danger"
                            disabled={deletingId === form.id}
                            onClick={() => setPendingDelete(form)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {shareForm && (
        <ShareModal
          url={formShareUrl(shareForm.id)}
          title={`Share "${shareForm.title}"`}
          onClose={() => setShareForm(null)}
          description={
            forms.find(f => f.id === shareForm.id)?.status === FormStatus.Published
              ? undefined
              : 'This form is not published yet, so people cannot submit it. Publish it first.'
          }
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete form"
          message={`"${localized(pendingDelete.title, 'Untitled form')}" and all of its responses will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete form"
          destructive
          loading={deletingId === pendingDelete.id}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

export default FormsPage;
