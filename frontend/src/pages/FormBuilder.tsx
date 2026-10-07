import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Plus, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import client from '../api/client';
import { apiErrorMessage } from '../lib/apiError';
import { FormStatus } from '../api/types';
import type { Form, FormField } from '../api/types';
import { localized, toLocalized } from '../lib/i18n';
import { useToastStore } from '../context/ToastStore';
import StatusDropdown from '../components/StatusDropdown';
import FieldEditor from '../components/forms/FieldEditor';
import {
  duplicateField,
  emptyField,
  formSnapshot,
  HAS_OPTIONS,
  readField,
  serializeField,
  validateField,
  type FieldState,
} from '../components/forms/fieldState';
import { Button, Card, ConfirmDialog, IconButton, Input, Label, LoadingState, Textarea } from '../components/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const FormBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const { addToast } = useToastStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldState[]>(() => [emptyField()]);
  const [status, setStatus] = useState<FormStatus>(FormStatus.Draft);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  /** Snapshot of what is on the server; the page is "unsaved" whenever the form differs from it. */
  const [baseline, setBaseline] = useState<string | null>(null);

  useDocumentTitle(isEditMode ? 'Edit form' : 'New form');

  const loadForm = useCallback(
    async (formId: string) => {
      try {
        const [fRes, ffRes] = await Promise.all([
          client.get<Form>(`/api/v1/forms/${formId}`),
          client.get<FormField[]>(`/api/v1/forms/${formId}/fields`),
        ]);
        // title/description are JSONB maps ({en: "..."}), not strings — reading
        // them raw put "[object Object]" in these inputs.
        const t = localized(fRes.data.title);
        const d = localized(fRes.data.description);
        const list = (ffRes.data || [])
          .slice()
          .sort((a, b) => a.field_order - b.field_order)
          .map(readField);
        const next = list.length > 0 ? list : [emptyField()];
        setTitle(t);
        setDescription(d);
        setStatus((fRes.data.status ?? FormStatus.Draft) as FormStatus);
        setFields(next);
        setBaseline(formSnapshot(t, d, next));
        return true;
      } catch {
        addToast('error', 'Failed to load form for editing.');
        return false;
      }
    },
    [addToast]
  );

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    loadForm(id).finally(() => setIsLoading(false));
  }, [id, loadForm]);

  const snapshot = useMemo(() => formSnapshot(title, description, fields), [title, description, fields]);
  const dirty =
    baseline === null
      ? title !== '' || description !== '' || fields.length > 1 || fields.some(f => f.label !== '')
      : snapshot !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const issues = useMemo(() => fields.map(validateField), [fields]);
  const titleMissing = !title.trim();
  const problemCount = issues.reduce((n, list) => n + list.length, 0) + (titleMissing ? 1 : 0);

  const addField = useCallback(() => {
    const f = emptyField();
    setFields(prev => [...prev, f]);
    setFocusId(f._id);
  }, []);

  // Removal needs no bookkeeping: the save sends the complete desired list,
  // and the server deletes whatever is missing from it.
  const removeField = (fieldId: string) => setFields(prev => prev.filter(f => f._id !== fieldId));

  const duplicate = (index: number) => {
    const copy = duplicateField(fields[index]);
    setFields(prev => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]);
    setFocusId(copy._id);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setFields(next);
  };

  const updateField = (fieldId: string, patch: Partial<FieldState>) => {
    setFields(prev =>
      prev.map(f => {
        if (f._id !== fieldId) return f;
        const updated = { ...f, ...patch };
        // Options are meaningless once the type is no longer option-based.
        if (patch.type && !HAS_OPTIONS.includes(patch.type)) updated.options = [];
        return updated;
      })
    );
  };

  useEffect(() => {
    if (!focusId) return;
    document.querySelector(`[data-field-id="${focusId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusId]);

  const jumpTo = (fieldId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-field-id="${fieldId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
  };

  const save = useCallback(async () => {
    if (problemCount > 0) {
      setShowIssues(true);
      const firstBad = issues.findIndex(list => list.length > 0);
      if (titleMissing) document.getElementById('form-title')?.focus();
      else if (firstBad >= 0) jumpTo(fields[firstBad]._id);
      addToast('error', 'Fix the highlighted items, then save again.');
      return;
    }

    setIsSaving(true);
    try {
      let formId = id;
      const formPayload = { title: toLocalized(title.trim()), description: toLocalized(description) };

      if (isEditMode) {
        await client.put(`/api/v1/forms/${id}`, formPayload);
      } else {
        const formRes = await client.post('/api/v1/forms', formPayload);
        formId = formRes.data.id;
      }

      // One transactional replace, not a request per field plus one per
      // deletion. The old loop had no rollback: a failure part-way through
      // left the form half-written, with some fields updated, some not, and
      // the deletions already applied.
      await client.put(`/api/v1/forms/${formId}/fields`, { fields: fields.map(serializeField) });

      // Reload so every row carries its server id and the next save is an update.
      await loadForm(formId as string);
      setShowIssues(false);
      addToast('success', isEditMode ? 'Form saved.' : 'Form created.');
      if (!isEditMode) navigate(`/admin/forms/${formId}/edit`, { replace: true });
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to save form. Your edits are still here.'));
    } finally {
      setIsSaving(false);
    }
  }, [problemCount, issues, titleMissing, fields, id, isEditMode, title, description, loadForm, navigate, addToast]);

  // Ctrl/Cmd+S saves; Ctrl/Cmd+Enter adds a field.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        addField();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addField]);

  const goBack = () => (dirty ? setConfirmLeave(true) : navigate('/admin/forms'));

  if (isLoading) return <LoadingState message="Loading form…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-border bg-bg px-4 py-3 sm:mx-0 sm:px-4">
        <IconButton label="Back to forms" onClick={goBack} className="border border-border !p-2 hover:border-border-strong">
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight text-text">{title.trim() || (isEditMode ? 'Edit Form' : 'New Form')}</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted" role="status" aria-live="polite">
            {dirty ? (
              <>
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" />
                <span className="text-warning">Unsaved changes</span>
              </>
            ) : baseline !== null ? (
              <>
                <Check className="h-3 w-3 text-primary" aria-hidden="true" /> All changes saved
              </>
            ) : (
              'Not saved yet'
            )}
          </p>
        </div>
        {isEditMode && (
          <a
            href={`/preview/form/${id}`}
            target="_blank"
            rel="noreferrer"
            title={dirty ? 'Preview shows the last saved version' : 'Open the form as respondents see it'}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel-2 px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:border-border-strong hover:bg-panel-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Preview
          </a>
        )}
        <Button onClick={save} loading={isSaving} aria-keyshortcuts="Control+S Meta+S">
          {!isSaving && <Save className="h-4 w-4" aria-hidden="true" />}
          {isSaving ? 'Saving…' : 'Save Form'}
        </Button>
      </div>

      {showIssues && problemCount > 0 && (
        <div role="alert" className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
          <p className="font-semibold">
            {problemCount} {problemCount === 1 ? 'thing needs' : 'things need'} fixing before this can be saved:
          </p>
          <ul className="mt-1 list-inside list-disc">
            {titleMissing && <li>Give the form a title.</li>}
            {fields.map((f, i) =>
              issues[i].length > 0 ? (
                <li key={f._id}>
                  <button type="button" onClick={() => jumpTo(f._id)} className="underline underline-offset-2">
                    Field {i + 1}
                  </button>
                  : {issues[i].map(x => x.message).join(' ')}
                </li>
              ) : null
            )}
          </ul>
        </div>
      )}

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Form Details</h2>
          {isEditMode && <StatusDropdown type="form" id={id!} initialStatus={status} onStatusChange={setStatus} />}
        </div>

        <div>
          <Label htmlFor="form-title" required>
            Title
          </Label>
          <Input
            id="form-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Customer Satisfaction Survey"
            invalid={showIssues && titleMissing}
            autoFocus={!isEditMode}
            className="!py-2.5 font-display !text-lg font-semibold"
          />
          {showIssues && titleMissing && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
              Give the form a title respondents will recognise.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="form-description">Description</Label>
          <Textarea
            id="form-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Brief description for form respondents..."
            className="resize-none !py-2.5"
          />
        </div>
      </Card>

      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold">Fields</h2>
        <p className="text-sm text-muted">
          {fields.length} {fields.length === 1 ? 'field' : 'fields'} · {fields.filter(f => f.required).length} required
        </p>
      </div>

      <div className="space-y-4">
        {fields.map((field, idx) => (
          <FieldEditor
            key={field._id}
            field={field}
            index={idx}
            total={fields.length}
            issues={showIssues ? issues[idx] : []}
            autoFocus={field._id === focusId}
            onChange={patch => updateField(field._id, patch)}
            onRemove={() => removeField(field._id)}
            onMove={direction => moveField(idx, direction)}
            onDuplicate={() => duplicate(idx)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addField}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted transition-colors hover:border-primary hover:bg-primary-subtle hover:text-primary"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Add Field
        <kbd className="ms-1 hidden rounded border border-border-strong px-1.5 py-0.5 font-sans text-xs sm:inline">Ctrl + Enter</kbd>
      </button>

      {confirmLeave && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have changes that have not been saved. They will be lost."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          destructive
          onConfirm={() => navigate('/admin/forms')}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </div>
  );
};

export default FormBuilder;
