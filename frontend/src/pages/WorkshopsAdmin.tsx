import React, { useEffect, useState } from 'react';
import { Calendar, ChevronDown, Clock, MapPin, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import client from '../api/client';
import { useToastStore } from '../context/ToastStore';
import { apiErrorMessage } from '../lib/apiError';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from '../components/ui';

interface Workshop {
  id: string;
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  extra_info?: { en?: string; ar?: string } | null;
  image_path: string | null;
  event_date: string;
  event_time: string | null;
  track?: Track | null;
  location?: string | null;
  speaker?: string | null;
  attendees?: number | null;
  outcome?: { en?: string; ar?: string } | null;
  recap?: { en?: string; ar?: string } | null;
  gallery?: string[];
  registration_url?: string | null;
}

type Track = 'technical' | 'career' | 'industry' | 'business';

const TRACKS: { value: Track; label: string }[] = [
  { value: 'technical', label: 'Technical' },
  { value: 'career', label: 'Career' },
  { value: 'industry', label: 'Industry' },
  { value: 'business', label: 'Business' },
];

const MAX_GALLERY = 12;

interface WorkshopForm {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  extra_info_en: string;
  extra_info_ar: string;
  event_date: string;
  event_time: string;
  image_path: string;
  track: Track | '';
  location: string;
  speaker: string;
  attendees: string;
  outcome_en: string;
  outcome_ar: string;
  recap_en: string;
  recap_ar: string;
  registration_url: string;
  gallery: string[];
}

const EMPTY_FORM: WorkshopForm = {
  title_en: '',
  title_ar: '',
  description_en: '',
  description_ar: '',
  extra_info_en: '',
  extra_info_ar: '',
  event_date: '',
  event_time: '',
  image_path: '',
  track: '',
  location: '',
  speaker: '',
  attendees: '',
  outcome_en: '',
  outcome_ar: '',
  recap_en: '',
  recap_ar: '',
  registration_url: '',
  gallery: [],
};

const toForm = (w: Workshop): WorkshopForm => ({
  title_en: w.title.en || '',
  title_ar: w.title.ar || '',
  description_en: w.description.en || '',
  description_ar: w.description.ar || '',
  extra_info_en: w.extra_info?.en || '',
  extra_info_ar: w.extra_info?.ar || '',
  event_date: w.event_date,
  event_time: w.event_time || '',
  image_path: w.image_path || '',
  track: w.track || '',
  location: w.location || '',
  speaker: w.speaker || '',
  attendees: w.attendees == null ? '' : String(w.attendees),
  outcome_en: w.outcome?.en || '',
  outcome_ar: w.outcome?.ar || '',
  recap_en: w.recap?.en || '',
  recap_ar: w.recap?.ar || '',
  registration_url: w.registration_url || '',
  gallery: w.gallery || [],
});

// A bilingual map is sent only when at least one language has text; the
// backend stores an absent/empty map as NULL.
const bilingual = (en: string, ar: string) =>
  en.trim() || ar.trim() ? { en: en.trim(), ar: ar.trim() } : {};

const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

const WorkshopsAdmin: React.FC = () => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<Workshop | 'new' | null>(null);
  const [form, setForm] = useState<WorkshopForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGalleryUploading, setIsGalleryUploading] = useState(false);
  const [showAfter, setShowAfter] = useState(false);
  const [toDelete, setToDelete] = useState<Workshop | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToastStore();

  const load = () => {
    setIsLoading(true);
    client
      .get<Workshop[]>('/api/v1/admin/workshops')
      .then(res => setWorkshops(res.data || []))
      .catch(() => addToast('error', 'Failed to load workshops'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [addToast]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowAfter(false);
    setEditing('new');
  };

  const openEdit = (w: Workshop) => {
    setForm(toForm(w));
    setShowAfter(Boolean(w.recap || w.outcome || w.attendees != null || (w.gallery?.length ?? 0) > 0));
    setEditing(w);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await client.post('/api/v1/admin/workshops/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm(f => ({ ...f, image_path: res.data.file_path }));
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to upload image'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const room = MAX_GALLERY - form.gallery.length;
    if (room <= 0) {
      addToast('error', `A gallery holds at most ${MAX_GALLERY} images`);
      return;
    }
    if (files.length > room) addToast('error', `Only ${room} more image(s) fit; extra files were skipped`);

    setIsGalleryUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of files.slice(0, room)) {
        const formData = new FormData();
        formData.append('image', file);
        const res = await client.post<{ file_path: string }>('/api/v1/admin/workshops/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded.push(res.data.file_path);
      }
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to upload image'));
    } finally {
      if (uploaded.length > 0) setForm(f => ({ ...f, gallery: [...f.gallery, ...uploaded] }));
      setIsGalleryUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title_en.trim() || !form.title_ar.trim()) {
      addToast('error', 'Title is required in both English and Arabic');
      return;
    }
    if (!form.description_en.trim() || !form.description_ar.trim()) {
      addToast('error', 'Description is required in both English and Arabic');
      return;
    }
    if (!form.event_date) {
      addToast('error', 'Event date is required');
      return;
    }

    if (form.registration_url.trim() && !isHttpUrl(form.registration_url.trim())) {
      addToast('error', 'Registration link must start with http:// or https://');
      return;
    }
    if (form.attendees.trim() && !(Number.isInteger(Number(form.attendees)) && Number(form.attendees) >= 0)) {
      addToast('error', 'Attendees must be a whole number, 0 or more');
      return;
    }

    const payload = {
      title: { en: form.title_en.trim(), ar: form.title_ar.trim() },
      description: { en: form.description_en.trim(), ar: form.description_ar.trim() },
      extra_info:
        form.extra_info_en.trim() || form.extra_info_ar.trim()
          ? { en: form.extra_info_en.trim(), ar: form.extra_info_ar.trim() }
          : undefined,
      event_date: form.event_date,
      event_time: form.event_time || null,
      image_path: form.image_path || null,
      track: form.track || null,
      location: form.location.trim() || null,
      speaker: form.speaker.trim() || null,
      attendees: form.attendees.trim() ? Number(form.attendees) : null,
      outcome: bilingual(form.outcome_en, form.outcome_ar),
      recap: bilingual(form.recap_en, form.recap_ar),
      gallery: form.gallery,
      registration_url: form.registration_url.trim() || null,
    };

    setIsSaving(true);
    try {
      if (editing === 'new') {
        await client.post('/api/v1/admin/workshops', payload);
        addToast('success', 'Workshop created');
      } else if (editing) {
        await client.put(`/api/v1/admin/workshops/${editing.id}`, payload);
        addToast('success', 'Workshop updated');
      }
      setEditing(null);
      load();
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to save workshop'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await client.delete(`/api/v1/admin/workshops/${toDelete.id}`);
      addToast('success', 'Workshop deleted');
      setToDelete(null);
      load();
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to delete workshop'));
    } finally {
      setIsDeleting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workshops"
        description="Manage the events shown on the homepage's Upcoming Workshops section."
        action={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" /> New Workshop
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : workshops.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title="No workshops yet"
          description="Create one and it appears on the public homepage automatically."
          action={
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> New Workshop
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workshops.map(w => {
            const isPast = w.event_date < today;
            return (
              <Card key={w.id} className="overflow-hidden flex flex-col">
                <div className="aspect-video bg-panel-2 border-b border-border overflow-hidden">
                  {w.image_path ? (
                    <img src={w.image_path} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <Calendar className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                        isPast ? 'bg-panel-3 text-muted' : 'bg-primary-soft text-primary border border-primary-border'
                      }`}
                    >
                      {isPast ? 'Past' : 'Upcoming'}
                    </span>
                    {w.track && (
                      <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border border-border text-muted">
                        {w.track}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-text mb-1">{w.title.en}</h3>
                  <p className="text-xs text-muted mb-1" dir="rtl">
                    {w.title.ar}
                  </p>
                  <p className="text-sm text-muted line-clamp-2 mb-3">{w.description.en}</p>
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted mb-4">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {w.event_date}
                    </span>
                    {w.event_time && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {w.event_time}
                      </span>
                    )}
                    {w.location && (
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{w.location}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(w)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setToDelete(w)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal
          title={editing === 'new' ? 'New Workshop' : 'Edit Workshop'}
          onClose={() => setEditing(null)}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="aspect-video rounded-lg border border-border bg-bg overflow-hidden relative">
              {form.image_path ? (
                <img src={form.image_path} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">
                  No image
                </div>
              )}
            </div>
            <label className="relative block">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="w-full flex justify-center items-center gap-2 py-2 rounded-lg border border-border bg-hover-overlay-strong text-text text-sm font-medium pointer-events-none">
                <Upload className="w-4 h-4" />
                {isUploading ? 'Uploading…' : 'Upload Image'}
              </span>
            </label>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title-en">Title (English)</Label>
                <Input
                  id="title-en"
                  value={form.title_en}
                  onChange={e => setForm(f => ({ ...f, title_en: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
              <div>
                <Label htmlFor="title-ar">Title (Arabic)</Label>
                <Input
                  id="title-ar"
                  dir="rtl"
                  value={form.title_ar}
                  onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="desc-en">Description (English)</Label>
                <Textarea
                  id="desc-en"
                  rows={3}
                  value={form.description_en}
                  onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
                  className="!py-2 !px-3 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="desc-ar">Description (Arabic)</Label>
                <Textarea
                  id="desc-ar"
                  dir="rtl"
                  rows={3}
                  value={form.description_ar}
                  onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))}
                  className="!py-2 !px-3 resize-none"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="extra-en">Additional Info (English, optional)</Label>
                <Textarea
                  id="extra-en"
                  rows={2}
                  value={form.extra_info_en}
                  onChange={e => setForm(f => ({ ...f, extra_info_en: e.target.value }))}
                  className="!py-2 !px-3 resize-none"
                />
              </div>
              <div>
                <Label htmlFor="extra-ar">Additional Info (Arabic, optional)</Label>
                <Textarea
                  id="extra-ar"
                  dir="rtl"
                  rows={2}
                  value={form.extra_info_ar}
                  onChange={e => setForm(f => ({ ...f, extra_info_ar: e.target.value }))}
                  className="!py-2 !px-3 resize-none"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
              <div>
                <Label htmlFor="event-time">Time (optional)</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={form.event_time}
                  onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="track">Track (optional)</Label>
                <Select
                  id="track"
                  value={form.track}
                  onChange={e => setForm(f => ({ ...f, track: e.target.value as Track | '' }))}
                >
                  <option value="">None</option>
                  {TRACKS.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="location">Location (optional)</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
              <div>
                <Label htmlFor="speaker">Speaker / host (optional)</Label>
                <Input
                  id="speaker"
                  value={form.speaker}
                  onChange={e => setForm(f => ({ ...f, speaker: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
              <div>
                <Label htmlFor="registration-url">Registration link (optional)</Label>
                <Input
                  id="registration-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={form.registration_url}
                  onChange={e => setForm(f => ({ ...f, registration_url: e.target.value }))}
                  className="!py-2 !px-3"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setShowAfter(v => !v)}
                aria-expanded={showAfter}
                aria-controls="after-event"
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-text text-left"
              >
                After the event (shown on Our Work)
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${showAfter ? 'rotate-180' : ''}`} />
              </button>
              {showAfter && (
                <div id="after-event" className="space-y-4 px-4 pb-4 border-t border-border pt-4">
                  <div>
                    <Label htmlFor="attendees">Attendees</Label>
                    <Input
                      id="attendees"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={form.attendees}
                      onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))}
                      className="!py-2 !px-3 sm:max-w-[12rem]"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="outcome-en">Outcome headline (English)</Label>
                      <Input
                        id="outcome-en"
                        placeholder="+34% average quiz score"
                        value={form.outcome_en}
                        onChange={e => setForm(f => ({ ...f, outcome_en: e.target.value }))}
                        className="!py-2 !px-3"
                      />
                    </div>
                    <div>
                      <Label htmlFor="outcome-ar">Outcome headline (Arabic)</Label>
                      <Input
                        id="outcome-ar"
                        dir="rtl"
                        value={form.outcome_ar}
                        onChange={e => setForm(f => ({ ...f, outcome_ar: e.target.value }))}
                        className="!py-2 !px-3"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="recap-en">Recap (English)</Label>
                      <Textarea
                        id="recap-en"
                        rows={4}
                        value={form.recap_en}
                        onChange={e => setForm(f => ({ ...f, recap_en: e.target.value }))}
                        className="!py-2 !px-3 resize-none"
                      />
                    </div>
                    <div>
                      <Label htmlFor="recap-ar">Recap (Arabic)</Label>
                      <Textarea
                        id="recap-ar"
                        dir="rtl"
                        rows={4}
                        value={form.recap_ar}
                        onChange={e => setForm(f => ({ ...f, recap_ar: e.target.value }))}
                        className="!py-2 !px-3 resize-none"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>
                      Photo gallery ({form.gallery.length}/{MAX_GALLERY})
                    </Label>
                    {form.gallery.length > 0 && (
                      <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                        {form.gallery.map((path, i) => (
                          <li key={path} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                            <img src={path} alt={`Gallery image ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              aria-label={`Remove gallery image ${i + 1}`}
                              onClick={() => setForm(f => ({ ...f, gallery: f.gallery.filter(g => g !== path) }))}
                              className="absolute top-1 right-1 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/70 text-white hover:bg-danger"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <label className="relative block">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleGalleryUpload}
                        disabled={isGalleryUploading || form.gallery.length >= MAX_GALLERY}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="w-full flex justify-center items-center gap-2 py-2 rounded-lg border border-border bg-hover-overlay-strong text-text text-sm font-medium pointer-events-none">
                        <Upload className="w-4 h-4" />
                        {isGalleryUploading ? 'Uploading…' : 'Add gallery photos'}
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              {editing === 'new' ? 'Create Workshop' : 'Save Changes'}
            </Button>
          </div>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete workshop"
          message={`Delete "${toDelete.title.en}"? This removes it from the homepage immediately and cannot be undone.`}
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

export default WorkshopsAdmin;
