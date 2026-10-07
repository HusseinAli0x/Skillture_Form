import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Mail, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import client from '../../../api/client';
import { useToastStore } from '../../../context/ToastStore';
import { apiErrorMessage } from '../../../lib/apiError';
import { copyText, filenameFromDisposition, saveBlob } from '../../../lib/download';
import { timeAgo } from '../../../lib/relativeTime';
import { Button, ConfirmDialog, EmptyState, ErrorState, IconButton, Input, SkeletonRows } from '../../ui';
import Drawer from '../Drawer';
import { registeredLabel, type Workshop } from './workshopModel';

export interface Registrant {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface Props {
  workshop: Workshop;
  onClose: () => void;
  /** Tells the workshop list the live number of sign-ups after a load or a removal. */
  onCountChange: (workshopId: string, count: number) => void;
}

/**
 * Who has signed up for one workshop: search, export to CSV, copy all the
 * emails, remove an entry. Opens as a side panel over the Workshops list.
 */
const RegistrantsPanel: React.FC<Props> = ({ workshop, onClose, onCountChange }) => {
  const { addToast } = useToastStore();
  const [rows, setRows] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [toRemove, setToRemove] = useState<Registrant | null>(null);
  const [removing, setRemoving] = useState(false);

  const base = `/api/v1/admin/workshops/${workshop.id}/registrations`;
  const onCountRef = useRef(onCountChange);
  onCountRef.current = onCountChange;

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await client.get<Registrant[]>(base);
      const list = Array.isArray(res.data) ? res.data : [];
      setRows(list);
      onCountRef.current(workshop.id, list.length);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [base, workshop.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [rows, search]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await client.get<Blob>(`${base}.csv`, { responseType: 'blob' });
      const name = filenameFromDisposition(res.headers?.['content-disposition'], 'registrations.csv');
      saveBlob(res.data, name);
      addToast('success', `Exported ${rows.length} ${rows.length === 1 ? 'registration' : 'registrations'}`);
    } catch (err) {
      // An error body arrives as a Blob here, so the server's text is not readable.
      addToast('error', apiErrorMessage(err, 'Could not export the list. Try again.'));
    } finally {
      setExporting(false);
    }
  };

  const copyEmails = async () => {
    const ok = await copyText(rows.map(r => r.email).join(', '));
    addToast(
      ok ? 'success' : 'error',
      ok
        ? `Copied ${rows.length} ${rows.length === 1 ? 'email' : 'emails'}`
        : 'Could not copy. Select the emails by hand or use Export CSV.'
    );
  };

  const remove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await client.delete(`${base}/${toRemove.id}`);
      const next = rows.filter(r => r.id !== toRemove.id);
      setRows(next);
      onCountRef.current(workshop.id, next.length);
      addToast('success', `Removed ${toRemove.name}`);
      setToRemove(null);
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Could not remove this registration. Try again.'));
    } finally {
      setRemoving(false);
    }
  };

  const hasRows = rows.length > 0;

  return (
    <>
      <Drawer
        title="Registrants"
        subtitle={workshop.title.en}
        onClose={onClose}
        escapeDisabled={toRemove !== null}
        maxWidth="sm:max-w-3xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-text" aria-live="polite">
            <Users aria-hidden="true" className="w-4 h-4 text-primary" />
            {loading && !hasRows ? 'Counting…' : registeredLabel(rows.length, workshop.capacity)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw aria-hidden="true" className={`w-3.5 h-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void copyEmails()} disabled={!hasRows}>
              <Copy aria-hidden="true" className="w-3.5 h-3.5" /> Copy all emails
            </Button>
            <Button size="sm" onClick={() => void exportCsv()} loading={exporting} disabled={!hasRows}>
              {!exporting && <Download aria-hidden="true" className="w-3.5 h-3.5" />} Export CSV
            </Button>
          </div>
        </div>

        {hasRows && (
          <div className="sm:max-w-xs">
            <Input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email"
              aria-label="Search registrants"
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        )}

        <div className="rounded-xl border border-border bg-panel">
          {loading && !hasRows ? (
            <SkeletonRows rows={4} label="Loading registrants" />
          ) : failed && !hasRows ? (
            <ErrorState title="Could not load registrants" onRetry={() => void load()} retrying={loading} />
          ) : !hasRows ? (
            <EmptyState
              compact
              icon={<Users className="w-6 h-6" />}
              title="Nobody has registered yet"
              description="People who sign up on the workshop page will appear here."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              compact
              icon={<Search className="w-6 h-6" />}
              title="No one matches"
              description="Try a different name or email."
              action={
                <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">People registered for {workshop.title.en}</caption>
                <thead>
                  <tr className="border-b border-border text-start text-xs text-muted">
                    <th scope="col" className="px-4 py-2.5 text-start font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start font-medium">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start font-medium whitespace-nowrap">
                      Registered
                    </th>
                    <th scope="col" className="px-4 py-2.5 w-12">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.id} className="border-b border-border last:border-b-0 align-middle">
                      <td className="px-4 py-3 font-medium text-text break-words">{r.name}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`mailto:${r.email}`}
                          className="inline-flex items-center gap-1.5 text-primary hover:text-primary-hover break-all rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Mail aria-hidden="true" className="w-3.5 h-3.5 shrink-0" /> {r.email}
                        </a>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">
                        <time dateTime={r.created_at} title={new Date(r.created_at).toLocaleString()}>
                          {timeAgo(r.created_at)}
                        </time>
                      </td>
                      <td className="px-2 py-2 text-end">
                        <IconButton label={`Remove ${r.name}`} tone="danger" onClick={() => setToRemove(r)}>
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {failed && hasRows && (
          <p role="alert" className="text-sm text-danger">
            Could not refresh the list. What you see may be out of date.
          </p>
        )}
        {hasRows && search.trim() && (
          <p className="text-xs text-muted" aria-live="polite">
            Showing {visible.length} of {rows.length}
          </p>
        )}
      </Drawer>

      {toRemove && (
        <ConfirmDialog
          title="Remove this registration?"
          message={`${toRemove.name} (${toRemove.email}) will be taken off the list and their seat is released. They are not notified.`}
          confirmLabel="Remove"
          destructive
          loading={removing}
          onConfirm={() => void remove()}
          onCancel={() => setToRemove(null)}
        />
      )}
    </>
  );
};

export default RegistrantsPanel;
