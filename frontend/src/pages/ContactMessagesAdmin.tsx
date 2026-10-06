import React, { useEffect, useState } from 'react';
import { Mail, MailOpen, Trash2 } from 'lucide-react';
import client from '../api/client';
import { useToastStore } from '../context/ToastStore';
import { apiErrorMessage } from '../lib/apiError';
import { Button, Card, ConfirmDialog, EmptyState, PageHeader, Spinner } from '../components/ui';

interface Submission {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
}

const ContactMessagesAdmin: React.FC = () => {
  const [messages, setMessages] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toDelete, setToDelete] = useState<Submission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToastStore();

  const load = () => {
    setIsLoading(true);
    client
      .get<Submission[]>('/api/v1/admin/contact')
      .then(res => setMessages(res.data || []))
      .catch(() => addToast('error', 'Failed to load messages'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [addToast]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await client.delete(`/api/v1/admin/contact/${toDelete.id}`);
      addToast('success', 'Message deleted');
      setToDelete(null);
      load();
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to delete message'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Contact Messages" description="Submissions from the homepage's Contact Us form." />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={<MailOpen className="w-6 h-6" />}
          title="No messages yet"
          description="Visitor messages from the homepage contact form show up here."
        />
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <Card key={m.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-text">{m.name}</p>
                    <a
                      href={`mailto:${m.email}`}
                      className="text-xs text-primary hover:text-primary-hover inline-flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" /> {m.email}
                    </a>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{new Date(m.created_at).toLocaleString()}</p>
                  <p className="text-sm text-text mt-3 whitespace-pre-wrap leading-relaxed">{m.message}</p>
                </div>
                <Button variant="danger" size="sm" onClick={() => setToDelete(m)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete message"
          message={`Delete the message from "${toDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          loading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

export default ContactMessagesAdmin;
