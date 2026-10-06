import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Upload, Users } from 'lucide-react';
import client from '../api/client';
import { useToastStore } from '../context/ToastStore';
import { apiErrorMessage } from '../lib/apiError';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from '../components/ui';

type Group = 'leadership' | 'core' | 'volunteer' | 'alumni';

interface Member {
  id: string;
  name: { en: string; ar: string };
  role: { en: string; ar: string };
  bio?: { en?: string; ar?: string } | null;
  photo_path: string | null;
  linkedin_url: string | null;
  group: Group;
  sort_order: number;
}

interface MemberForm {
  name_en: string;
  name_ar: string;
  role_en: string;
  role_ar: string;
  bio_en: string;
  bio_ar: string;
  group: Group;
  sort_order: string;
  linkedin_url: string;
  photo_path: string;
}

const GROUPS: { value: Group; label: string }[] = [
  { value: 'leadership', label: 'Leadership' },
  { value: 'core', label: 'Core team' },
  { value: 'volunteer', label: 'Volunteers' },
  { value: 'alumni', label: 'Alumni' },
];

const EMPTY_FORM: MemberForm = {
  name_en: '',
  name_ar: '',
  role_en: '',
  role_ar: '',
  bio_en: '',
  bio_ar: '',
  group: 'core',
  sort_order: '0',
  linkedin_url: '',
  photo_path: '',
};

const toForm = (m: Member): MemberForm => ({
  name_en: m.name.en || '',
  name_ar: m.name.ar || '',
  role_en: m.role.en || '',
  role_ar: m.role.ar || '',
  bio_en: m.bio?.en || '',
  bio_ar: m.bio?.ar || '',
  group: m.group,
  sort_order: String(m.sort_order),
  linkedin_url: m.linkedin_url || '',
  photo_path: m.photo_path || '',
});

const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?';

const Avatar: React.FC<{ member: Pick<Member, 'photo_path' | 'name'>; size?: string }> = ({
  member,
  size = 'w-12 h-12',
}) =>
  member.photo_path ? (
    <img src={member.photo_path} alt="" className={`${size} rounded-full object-cover flex-shrink-0`} />
  ) : (
    <div
      aria-hidden="true"
      className={`${size} rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-primary-soft text-primary border border-primary-border`}
    >
      {initialsOf(member.name.en)}
    </div>
  );

const TeamAdmin: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toDelete, setToDelete] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToastStore();

  const load = () => {
    setIsLoading(true);
    client
      .get<Member[]>('/api/v1/team')
      .then(res => setMembers(res.data || []))
      .catch(() => addToast('error', 'Failed to load team'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [addToast]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing('new');
  };

  const openEdit = (m: Member) => {
    setForm(toForm(m));
    setEditing(m);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await client.post<{ file_path: string }>('/api/v1/admin/team/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm(f => ({ ...f, photo_path: res.data.file_path }));
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to upload photo'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.name_en.trim() || !form.name_ar.trim()) {
      addToast('error', 'Name is required in both English and Arabic');
      return;
    }
    if (!form.role_en.trim() || !form.role_ar.trim()) {
      addToast('error', 'Role is required in both English and Arabic');
      return;
    }
    if (form.linkedin_url.trim() && !isHttpUrl(form.linkedin_url.trim())) {
      addToast('error', 'LinkedIn link must start with http:// or https://');
      return;
    }
    const sortOrder = Number(form.sort_order || '0');
    if (!Number.isInteger(sortOrder)) {
      addToast('error', 'Sort order must be a whole number');
      return;
    }

    const payload = {
      name: { en: form.name_en.trim(), ar: form.name_ar.trim() },
      role: { en: form.role_en.trim(), ar: form.role_ar.trim() },
      bio:
        form.bio_en.trim() || form.bio_ar.trim()
          ? { en: form.bio_en.trim(), ar: form.bio_ar.trim() }
          : {},
      photo_path: form.photo_path || null,
      linkedin_url: form.linkedin_url.trim() || null,
      group: form.group,
      sort_order: sortOrder,
    };

    setIsSaving(true);
    try {
      if (editing === 'new') {
        await client.post('/api/v1/admin/team', payload);
        addToast('success', 'Team member added');
      } else if (editing) {
        await client.put(`/api/v1/admin/team/${editing.id}`, payload);
        addToast('success', 'Team member updated');
      }
      setEditing(null);
      load();
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to save team member'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await client.delete(`/api/v1/admin/team/${toDelete.id}`);
      addToast('success', 'Team member removed');
      setToDelete(null);
      load();
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to remove team member'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="The people shown on the public Team page, grouped and ordered here."
        action={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" /> Add Member
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No team members yet"
          description="Add the first person and they appear on the public Team page."
          action={
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> Add Member
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {GROUPS.map(g => {
            const inGroup = members.filter(m => m.group === g.value);
            if (inGroup.length === 0) return null;
            return (
              <section key={g.value} aria-labelledby={`group-${g.value}`}>
                <h2
                  id={`group-${g.value}`}
                  className="text-xs font-semibold uppercase tracking-widest text-muted mb-3"
                >
                  {g.label} · {inGroup.length}
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inGroup.map(m => (
                    <Card key={m.id} className="p-4 flex items-center gap-3">
                      <Avatar member={m} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-text truncate">{m.name.en}</p>
                        <p className="text-sm text-muted truncate">{m.role.en}</p>
                        <p className="text-xs text-muted truncate" dir="rtl">
                          {m.name.ar}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <IconButton label={`Edit ${m.name.en}`} tone="primary" onClick={() => openEdit(m)}>
                          <Pencil className="w-4 h-4" />
                        </IconButton>
                        <IconButton label={`Delete ${m.name.en}`} tone="danger" onClick={() => setToDelete(m)}>
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal
          title={editing === 'new' ? 'Add Team Member' : 'Edit Team Member'}
          onClose={() => setEditing(null)}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex items-center gap-4">
              <Avatar member={{ photo_path: form.photo_path || null, name: { en: form.name_en, ar: form.name_ar } }} size="w-20 h-20" />
              <label className="relative block flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={isUploading}
                  aria-label="Upload photo"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="w-full flex justify-center items-center gap-2 py-2 rounded-lg border border-border bg-hover-overlay-strong text-text text-sm font-medium pointer-events-none">
                  <Upload className="w-4 h-4" />
                  {isUploading ? 'Uploading…' : form.photo_path ? 'Change photo' : 'Upload photo'}
                </span>
              </label>
              {form.photo_path && (
                <Button variant="secondary" size="sm" onClick={() => setForm(f => ({ ...f, photo_path: '' }))}>
                  Remove
                </Button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name-en" required>
                  Name (English)
                </Label>
                <Input
                  id="name-en"
                  value={form.name_en}
                  onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
              <div>
                <Label htmlFor="name-ar" required>
                  Name (Arabic)
                </Label>
                <Input
                  id="name-ar"
                  dir="rtl"
                  value={form.name_ar}
                  onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
              <div>
                <Label htmlFor="role-en" required>
                  Role (English)
                </Label>
                <Input
                  id="role-en"
                  value={form.role_en}
                  onChange={e => setForm(f => ({ ...f, role_en: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
              <div>
                <Label htmlFor="role-ar" required>
                  Role (Arabic)
                </Label>
                <Input
                  id="role-ar"
                  dir="rtl"
                  value={form.role_ar}
                  onChange={e => setForm(f => ({ ...f, role_ar: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bio-en">Bio (English, optional)</Label>
                <Textarea
                  id="bio-en"
                  rows={3}
                  value={form.bio_en}
                  onChange={e => setForm(f => ({ ...f, bio_en: e.target.value }))}
                  className="!py-2 !px-3 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="bio-ar">Bio (Arabic, optional)</Label>
                <Textarea
                  id="bio-ar"
                  dir="rtl"
                  rows={3}
                  value={form.bio_ar}
                  onChange={e => setForm(f => ({ ...f, bio_ar: e.target.value }))}
                  className="!py-2 !px-3 resize-none"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="group">Group</Label>
                <Select
                  id="group"
                  value={form.group}
                  onChange={e => setForm(f => ({ ...f, group: e.target.value as Group }))}
                >
                  {GROUPS.map(g => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="sort-order">Sort order (lower shows first)</Label>
                <Input
                  id="sort-order"
                  type="number"
                  inputMode="numeric"
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="linkedin">LinkedIn (optional)</Label>
              <Input
                id="linkedin"
                type="url"
                inputMode="url"
                placeholder="https://www.linkedin.com/in/…"
                value={form.linkedin_url}
                onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))}
                className="!py-2 !px-3"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              {editing === 'new' ? 'Add Member' : 'Save Changes'}
            </Button>
          </div>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Remove team member"
          message={`Remove "${toDelete.name.en}" from the Team page? This cannot be undone.`}
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
