import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, MailOpen, Reply, Search, Trash2 } from 'lucide-react';
import client from '../api/client';
import { useToastStore } from '../context/ToastStore';
import { readSeen, useMessagesStore } from '../context/MessagesStore';
import { apiErrorMessage } from '../lib/apiError';
import { timeAgo } from '../lib/relativeTime';
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
  StatusChip,
} from '../components/ui';

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
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  // What was already seen when this page opened; those are the unread ones now.
  const [seenAtOnOpen] = useState(readSeen);
  const [toDelete, setToDelete] = useState<Submission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToastStore();
  const markSeen = useMessagesStore(s => s.markSeen);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const res = await client.get<Submission[]>('/api/v1/admin/contact');
      const list = Array.isArray(res.data) ? res.data : [];
      setMessages(list);
      markSeen(list);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [markSeen]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await client.delete(`/api/v1/admin/contact/${toDelete.id}`);
      setMessages(prev => prev.filter(m => m.id !== toDelete.id));
      addToast('success', 'Message deleted');
      setToDelete(null);
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Could not delete the message. Try again.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...messages]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .filter(
        m =>
          !query ||
          m.name.toLowerCase().includes(query) ||
          m.email.toLowerCase().includes(query) ||
          m.message.toLowerCase().includes(query)
      );
  }, [messages, search]);

  const isNew = (m: Submission) => seenAtOnOpen !== null && Date.parse(m.created_at) > Date.parse(seenAtOnOpen);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Notes sent through the Contact form on the public site, newest first."
      />

      <Card>
        {messages.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
            <div className="flex-1 sm:max-w-xs">
              <Input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email or text"
                aria-label="Search messages"
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <p className="text-xs text-muted" aria-live="polite">
              {visible.length} {visible.length === 1 ? 'message' : 'messages'}
            </p>
          </div>
        )}

        {isLoading ? (
          <SkeletonRows rows={4} label="Loading messages" />
        ) : loadFailed ? (
          <ErrorState title="Could not load messages" onRetry={load} />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MailOpen className="w-7 h-7" />}
            title="No messages yet"
            description="When a visitor writes to you through the Contact form on the homepage, the message lands here."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            icon={<Search className="w-6 h-6" />}
            title="No messages match"
            description="Try a different name, email or word."
            action={
              <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                Clear search
              </Button>
            }
          />
        ) : (
          <ul>
            {visible.map((m, i) => (
              <li
                key={m.id}
                className={`px-5 py-5 ${i < visible.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                      <p className="font-semibold text-text">{m.name}</p>
                      {isNew(m) && <StatusChip tone="brand">New</StatusChip>}
                      <a
                        href={`mailto:${m.email}`}
                        className="text-sm text-primary hover:text-primary-hover inline-flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Mail className="w-3.5 h-3.5" aria-hidden="true" /> {m.email}
                      </a>
                      <time
                        dateTime={m.created_at}
                        title={new Date(m.created_at).toLocaleString()}
                        className="text-xs text-muted"
                      >
                        {timeAgo(m.created_at)}
                      </time>
                    </div>
                    <p className="text-sm text-text/90 mt-3 whitespace-pre-wrap leading-relaxed break-words">
                      {m.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <a
                      href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to Skillture')}`}
                      aria-label={`Reply to ${m.name}`}
                      title={`Reply to ${m.name}`}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary-soft transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Reply className="w-4 h-4" />
                    </a>
                    <IconButton label={`Delete message from ${m.name}`} tone="danger" onClick={() => setToDelete(m)}>
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {toDelete && (
        <ConfirmDialog
          title="Delete message"
          message={`Delete the message from "${toDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete message"
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
