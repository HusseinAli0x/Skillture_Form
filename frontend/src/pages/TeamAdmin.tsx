import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Plus, Users } from 'lucide-react';
import client from '../api/client';
import { useToastStore } from '../context/ToastStore';
import { apiErrorMessage } from '../lib/apiError';
import { Button, ConfirmDialog, PageHeader } from '../components/ui';
import Drawer from '../components/admin/Drawer';
import SaveBar from '../components/admin/SaveBar';
import { EmptyPanel, FormBanner, ListSkeleton, LoadFailed } from '../components/admin/AdminStates';
import { fieldForServerMessage, sentence } from '../components/admin/serverErrors';
import { useRecordEditor } from '../components/admin/useRecordEditor';
import { useUnsavedGuard } from '../components/admin/useUnsavedGuard';
import MemberFormFields from '../components/admin/team/MemberFormFields';
import { TeamBoard, TeamToolbar } from '../components/admin/team/TeamBoard';
import {
  TEAM_SERVER_FIELDS,
  emptyMemberForm,
  formToPayload,
  memberToForm,
  memberToPayload,
  reorderInGroup,
  sortOrderForSave,
  validateMemberForm,
  type Group,
  type Member,
  type MemberForm,
} from '../components/admin/team/teamModel';

const uploadTeamPhoto = async (file: File): Promise<string> => {
  const body = new FormData();
  body.append('image', file);
  const res = await client.post<{ file_path: string }>('/api/v1/admin/team/image', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.file_path;
};

const TeamAdmin: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<Group | 'all'>('all');
  const [toDelete, setToDelete] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const { addToast } = useToastStore();
  const editor = useRecordEditor<MemberForm>();
  const { guard } = useUnsavedGuard(editor.isOpen && editor.dirty);

  const load = useCallback(
    (showSpinner = true) => {
      if (showSpinner) setIsLoading(true);
      setLoadFailed(false);
      return client
        .get<Member[]>('/api/v1/team')
        .then(res => setMembers(res.data || []))
        .catch(err => {
          setLoadFailed(true);
          addToast('error', apiErrorMessage(err, 'Failed to load the team'));
        })
        .finally(() => setIsLoading(false));
    },
    [addToast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const current = editor.session?.id ? members.find(m => m.id === editor.session?.id) : undefined;
  const total = useMemo(() => members.length, [members]);

  const handleSave = async () => {
    const form = editor.form;
    if (!form) return;
    const problems = validateMemberForm(form);
    if (Object.keys(problems).length > 0) {
      editor.setErrors(problems);
      editor.setFormError(null);
      // Inline errors, the save bar's count and focus on the first bad field say
      // it; a toast would sit on top of the Save button.
      editor.focusFirstError();
      return;
    }

    editor.setSaving(true);
    editor.setErrors({});
    editor.setFormError(null);
    try {
      const payload = formToPayload(form, sortOrderForSave(members, current, form.group));
      if (editor.session?.id) {
        await client.put(`/api/v1/admin/team/${editor.session.id}`, payload);
        addToast('success', `${form.name_en.trim()} updated`);
      } else {
        await client.post('/api/v1/admin/team', payload);
        addToast('success', `${form.name_en.trim()} added to the team`);
      }
      editor.close();
      void load(false);
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not save this person. Your edits are still here; try again.');
      const field = fieldForServerMessage(message, TEAM_SERVER_FIELDS);
      if (field) {
        editor.setErrors({ [field]: sentence(message) });
        editor.focusFirstError();
      } else {
        editor.setFormError(message);
      }
      addToast('error', message);
    } finally {
      editor.setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await client.delete(`/api/v1/admin/team/${toDelete.id}`);
      addToast('success', `${toDelete.name.en} removed`);
      setMembers(list => list.filter(m => m.id !== toDelete.id));
      setToDelete(null);
      void load(false);
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to remove this person'));
    } finally {
      setIsDeleting(false);
    }
  };

  /** Move within the group; the list updates at once and each changed person is saved. */
  const handleMove = async (id: string, to: number) => {
    if (isReordering) return;
    const { changes } = reorderInGroup(members, id, to);
    if (changes.length === 0) return;
    const before = members;
    const orderOf = new Map(changes.map(c => [c.id, c.sort_order]));
    setMembers(list => list.map(m => (orderOf.has(m.id) ? { ...m, sort_order: orderOf.get(m.id)! } : m)));
    setIsReordering(true);
    try {
      await Promise.all(
        changes.map(c => {
          const m = before.find(x => x.id === c.id)!;
          return client.put(`/api/v1/admin/team/${c.id}`, memberToPayload(m, c.sort_order));
        })
      );
      addToast('success', 'Order saved');
    } catch (err) {
      setMembers(before);
      addToast('error', apiErrorMessage(err, 'Could not save the new order. It has been put back.'));
      void load(false);
    } finally {
      setIsReordering(false);
    }
  };

  const openNew = (group: Group = 'core') => editor.open(null, emptyMemberForm(group));
  const openEdit = (m: Member) => editor.open(m.id, memberToForm(m));
  const errorCount = Object.keys(editor.errors).length;

  return (
    <div className="space-y-6">
      {guard}
      <PageHeader
        title="Team"
        description="The people on the public Team page and in the team strip on the homepage. Drag cards, or use the arrows, to set the order within each group."
        action={
          <div className="flex items-center gap-3">
            <a
              href="/team"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
            >
              View Team page <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
            </a>
            <Button onClick={() => openNew()}>
              <Plus aria-hidden="true" className="w-4 h-4" /> Add member
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <ListSkeleton />
      ) : loadFailed ? (
        <LoadFailed what="the team" onRetry={() => void load()} />
      ) : total === 0 ? (
        <EmptyPanel
          icon={<Users className="w-6 h-6" />}
          title="No team members yet"
          description="Add the first person and they appear on the public Team page straight away."
          action={
            <Button onClick={() => openNew()}>
              <Plus aria-hidden="true" className="w-4 h-4" /> Add member
            </Button>
          }
        />
      ) : (
        <>
          <TeamToolbar query={query} onQuery={setQuery} group={groupFilter} onGroup={setGroupFilter} members={members} />
          {query.trim() !== '' && (
            <p className="text-xs text-muted">Reordering is off while a search is active.</p>
          )}
          <TeamBoard
            members={members}
            query={query}
            groupFilter={groupFilter}
            onAdd={openNew}
            onEdit={openEdit}
            onDelete={setToDelete}
            onMove={(id, to) => void handleMove(id, to)}
          />
        </>
      )}

      {editor.isOpen && editor.form && (
        <Drawer
          title={editor.isNew ? 'Add team member' : `Edit ${current?.name.en ?? 'team member'}`}
          subtitle={editor.isNew ? 'Name and role are needed in both languages.' : undefined}
          onClose={editor.requestClose}
          escapeDisabled={editor.confirmingClose}
          maxWidth="sm:max-w-xl"
          footer={
            <SaveBar
              variant="footer"
              mode={editor.isNew ? 'new' : 'edit'}
              dirty={editor.dirty}
              saving={editor.saving}
              busy={editor.busy}
              problems={errorCount}
              saveLabel={editor.isNew ? 'Add member' : 'Save changes'}
              discardLabel={editor.isNew ? 'Cancel' : 'Discard'}
              onSave={handleSave}
              onDiscard={() => (editor.isNew ? editor.requestClose() : current && editor.open(current.id, memberToForm(current)))}
            />
          }
        >
          <FormBanner message={editor.formError} />
          <MemberFormFields
            form={editor.form}
            errors={editor.errors}
            patch={editor.patch}
            upload={uploadTeamPhoto}
            onBusyChange={editor.setBusy}
          />
        </Drawer>
      )}
      {editor.discardDialog}

      {toDelete && (
        <ConfirmDialog
          title="Remove from the team?"
          message={`${toDelete.name.en} will disappear from the public Team page straight away. This cannot be undone.`}
          confirmLabel="Remove"
          destructive
          loading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

export default TeamAdmin;
