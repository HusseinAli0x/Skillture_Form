import React, { useEffect, useState } from 'react';
import { Plus, Search, FileText, Trash2, Eye, Edit3, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import client from '../api/client';
import { apiErrorMessage } from '../lib/apiError';
import type { Form } from '../api/types';
import { localized } from '../lib/i18n';
import StatusDropdown from '../components/StatusDropdown';
import ShareModal from '../components/ShareModal';
import { useToastStore } from '../context/ToastStore';
import { formShareUrl } from '../lib/links';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  LoadingState,
  PageHeader,
} from '../components/ui';

const FormsPage: React.FC = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Form | null>(null);
  const [shareForm, setShareForm] = useState<{ id: string; title: string } | null>(null);
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const res = await client.get<Form[]>('/api/v1/forms');
      setForms(res.data || []);
    } catch {
      setForms([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeletingId(id);
    try {
      await client.delete(`/api/v1/forms/${id}`);
      setForms(prev => prev.filter(f => f.id !== id));
      addToast('success', 'Form deleted successfully');
      setPendingDelete(null);
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to delete form'));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = forms.filter(f =>
    localized(f.title, 'Untitled Form').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms"
        description="Create and manage your survey forms."
        action={
          <Button onClick={() => navigate('/admin/forms/new')}>
            <Plus className="w-4 h-4" /> New Form
          </Button>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
          <div className="flex-1 max-w-xs">
            <Input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search forms..."
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <span className="text-xs text-muted">
            {filtered.length} form{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isLoading ? (
          <LoadingState message="Loading forms..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-7 h-7" />}
            title={search ? 'No forms match your search' : 'No forms yet'}
            description={search ? 'Try a different search term' : 'Create your first form to get started.'}
            action={
              !search && (
                <Button variant="subtle" size="md" onClick={() => navigate('/admin/forms/new')}>
                  <Plus className="w-4 h-4" /> Create Form
                </Button>
              )
            }
          />
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-hover-overlay">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Title</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted hidden sm:table-cell">
                    Created
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((form, i) => {
                  const title = localized(form.title, 'Untitled Form');
                  return (
                    <tr
                      key={form.id}
                      className={`group transition-colors hover:bg-hover-overlay ${
                        i < filtered.length - 1 ? 'border-b border-border' : ''
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-subtle border border-primary-border-soft text-primary">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-text">{title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusDropdown type="form" id={form.id} initialStatus={form.status} />
                      </td>
                      <td className="px-5 py-4 text-sm text-muted hidden sm:table-cell">
                        {form.creat_at ? new Date(form.creat_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <IconButton
                            label="Share form"
                            tone="info"
                            onClick={() => setShareForm({ id: form.id, title })}
                          >
                            <Share2 className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            label="View fields"
                            tone="primary"
                            onClick={() => navigate(`/admin/forms/${form.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            label="Edit form"
                            onClick={() => navigate(`/admin/forms/${form.id}/edit`)}
                          >
                            <Edit3 className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            label="Delete form"
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
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete form"
          message={`"${localized(pendingDelete.title, 'Untitled Form')}" and all of its responses will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
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
