import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ExternalLink, Plus } from 'lucide-react';
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
import WorkshopFormFields from '../components/admin/workshops/WorkshopFormFields';
import { WorkshopGroup, WorkshopToolbar } from '../components/admin/workshops/WorkshopList';
import {
  DEFAULT_FILTER,
  EMPTY_WORKSHOP_FORM,
  WORKSHOP_SERVER_FIELDS,
  duplicateForm,
  filterWorkshops,
  formToPayload,
  hasAfterEventData,
  phaseOf,
  splitByPhase,
  validateWorkshopForm,
  workshopToForm,
  type Workshop,
  type WorkshopFilter,
  type WorkshopForm,
} from '../components/admin/workshops/workshopModel';

/** Upload endpoint shared by the cover image and the gallery. */
const uploadWorkshopImage = async (file: File): Promise<string> => {
  const body = new FormData();
  body.append('image', file);
  const res = await client.post<{ file_path: string }>('/api/v1/admin/workshops/image', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.file_path;
};

const WorkshopsAdmin: React.FC = () => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<WorkshopFilter>(DEFAULT_FILTER);
  const [toDelete, setToDelete] = useState<Workshop | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToastStore();
  const editor = useRecordEditor<WorkshopForm>();
  const { guard } = useUnsavedGuard(editor.isOpen && editor.dirty);

  const load = useCallback(
    (showSpinner = true) => {
      if (showSpinner) setIsLoading(true);
      setLoadFailed(false);
      return client
        .get<Workshop[]>('/api/v1/admin/workshops')
        .then(res => setWorkshops(res.data || []))
        .catch(err => {
          setLoadFailed(true);
          addToast('error', apiErrorMessage(err, 'Failed to load workshops'));
        })
        .finally(() => setIsLoading(false));
    },
    [addToast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => filterWorkshops(workshops, filter), [workshops, filter]);
  const { upcoming, past } = useMemo(() => splitByPhase(visible), [visible]);
  const counts = useMemo(
    () => ({
      upcoming: workshops.filter(w => phaseOf(w) === 'upcoming').length,
      past: workshops.filter(w => phaseOf(w) === 'past').length,
    }),
    [workshops]
  );

  const current = editor.session?.id ? workshops.find(w => w.id === editor.session?.id) : undefined;

  const handleSave = async () => {
    const form = editor.form;
    if (!form) return;
    const problems = validateWorkshopForm(form);
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
      const payload = formToPayload(form);
      if (editor.session?.id) {
        await client.put(`/api/v1/admin/workshops/${editor.session.id}`, payload);
        addToast('success', `"${form.title_en.trim()}" updated`);
      } else {
        await client.post('/api/v1/admin/workshops', payload);
        addToast('success', `"${form.title_en.trim()}" created`);
      }
      editor.close();
      void load(false);
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not save the workshop. Your edits are still here; try again.');
      const field = fieldForServerMessage(message, WORKSHOP_SERVER_FIELDS);
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
      await client.delete(`/api/v1/admin/workshops/${toDelete.id}`);
      addToast('success', `"${toDelete.title.en}" deleted`);
      setWorkshops(list => list.filter(w => w.id !== toDelete.id));
      setToDelete(null);
      void load(false);
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to delete workshop'));
    } finally {
      setIsDeleting(false);
    }
  };

  const openNew = () => editor.open(null, EMPTY_WORKSHOP_FORM);
  const openEdit = (w: Workshop) => editor.open(w.id, workshopToForm(w));
  const openDuplicate = (w: Workshop) => {
    editor.open(null, duplicateForm(w));
    addToast('info', 'Copied into a new workshop. Set its date, then save.');
  };

  const handlers = { onEdit: openEdit, onDuplicate: openDuplicate, onDelete: setToDelete };
  const errorCount = Object.keys(editor.errors).length;

  return (
    <div className="space-y-6">
      {guard}
      <PageHeader
        title="Workshops"
        description="Everything the public site shows about workshops: the upcoming list on the homepage, past results on Our Work, and each workshop's own page."
        action={
          <div className="flex items-center gap-3">
            <a
              href="/our-work"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
            >
              View Our Work <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
            </a>
            <Button onClick={openNew}>
              <Plus aria-hidden="true" className="w-4 h-4" /> New workshop
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <ListSkeleton />
      ) : loadFailed ? (
        <LoadFailed what="workshops" onRetry={() => void load()} />
      ) : workshops.length === 0 ? (
        <EmptyPanel
          icon={<Calendar className="w-6 h-6" />}
          title="No workshops yet"
          description="Add the first one. It appears on the homepage as soon as you save, and moves to Our Work once its date passes."
          action={
            <Button onClick={openNew}>
              <Plus aria-hidden="true" className="w-4 h-4" /> New workshop
            </Button>
          }
        />
      ) : (
        <>
          <WorkshopToolbar filter={filter} onChange={setFilter} shown={visible.length} total={workshops.length} counts={counts} />
          {visible.length === 0 ? (
            <div className="rounded-xl border border-border bg-panel px-5 py-12 text-center">
              <p className="font-medium text-text">No workshop matches these filters.</p>
              <Button className="mt-4" variant="secondary" onClick={() => setFilter(DEFAULT_FILTER)}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              <WorkshopGroup heading="Upcoming" note="Soonest first. Shown on the homepage." workshops={upcoming} {...handlers} />
              <WorkshopGroup heading="Past" note="Latest first. Shown as results on Our Work." workshops={past} {...handlers} />
            </div>
          )}
        </>
      )}

      {editor.isOpen && editor.form && (
        <Drawer
          title={editor.isNew ? 'New workshop' : 'Edit workshop'}
          subtitle={
            editor.isNew ? (
              'Fill in the basics; everything else is optional.'
            ) : (
              <a
                href={`/workshops/${editor.session?.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:text-primary-hover"
              >
                View this workshop on the site <ExternalLink aria-hidden="true" className="w-3 h-3" />
              </a>
            )
          }
          onClose={editor.requestClose}
          escapeDisabled={editor.confirmingClose}
          footer={
            <SaveBar
              variant="footer"
              mode={editor.isNew ? 'new' : 'edit'}
              dirty={editor.dirty}
              saving={editor.saving}
              busy={editor.busy}
              problems={errorCount}
              saveLabel={editor.isNew ? 'Create workshop' : 'Save changes'}
              discardLabel={editor.isNew ? 'Cancel' : 'Discard'}
              onSave={handleSave}
              onDiscard={() => (editor.isNew ? editor.requestClose() : current && editor.open(current.id, workshopToForm(current)))}
            />
          }
        >
          <FormBanner message={editor.formError} />
          <WorkshopFormFields
            // Re-mount on a different record so collapsed sections reset.
            key={editor.session?.id ?? 'new'}
            form={editor.form}
            errors={editor.errors}
            patch={editor.patch}
            upload={uploadWorkshopImage}
            onBusyChange={editor.setBusy}
            afterOpen={hasAfterEventData(editor.form) || (Boolean(editor.form.event_date) && phaseOf({ event_date: editor.form.event_date }) === 'past')}
          />
        </Drawer>
      )}
      {editor.discardDialog}

      {toDelete && (
        <ConfirmDialog
          title="Delete this workshop?"
          message={`"${toDelete.title.en}" will disappear from the public site straight away, along with its results and gallery. This cannot be undone.`}
          confirmLabel="Delete workshop"
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
