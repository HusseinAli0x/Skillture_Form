import React, { useCallback, useState } from 'react';
import { ConfirmDialog } from '../ui';
import type { FieldErrors } from './serverErrors';

interface Session<F> {
  /** `null` while creating. */
  id: string | null;
  initial: F;
}

/**
 * State for a create/edit drawer: the working copy of the form, what it started
 * as (so "unsaved" is a fact, not a guess), field errors, a saving flag, an
 * upload-in-flight flag, and the "discard your changes?" step when closing.
 *
 * The working copy is only ever replaced by the user (`patch`) or by opening a
 * different record, so a failed save never loses what was typed.
 */
export function useRecordEditor<F extends object>() {
  const [session, setSession] = useState<Session<F> | null>(null);
  const [form, setForm] = useState<F | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const open = useCallback((id: string | null, initial: F) => {
    setSession({ id, initial });
    setForm(initial);
    setErrors({});
    setFormError(null);
    setSaving(false);
    setBusy(false);
    setConfirmingClose(false);
  }, []);

  const close = useCallback(() => {
    setSession(null);
    setForm(null);
    setConfirmingClose(false);
  }, []);

  const patch = useCallback((p: Partial<F>) => {
    setForm(f => (f ? { ...f, ...p } : f));
    // Editing a field is the user answering its error.
    setErrors(prev => {
      const keys = Object.keys(p).map(k => k.replace(/_(en|ar)$/, ''));
      if (!keys.some(k => k in prev)) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
    setFormError(null);
  }, []);

  const dirty = session !== null && form !== null && JSON.stringify(form) !== JSON.stringify(session.initial);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty) setConfirmingClose(true);
    else close();
  }, [dirty, saving, close]);

  const discardDialog: React.ReactNode = confirmingClose ? (
    <ConfirmDialog
      title="Discard your changes?"
      message="What you typed in this panel has not been saved. Closing it now will throw those edits away."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      destructive
      onCancel={() => setConfirmingClose(false)}
      onConfirm={close}
    />
  ) : null;

  /** Put focus on the first invalid control (after React has painted the errors). */
  const focusFirstError = useCallback(() => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus();
    });
  }, []);

  return {
    session,
    isOpen: session !== null && form !== null,
    isNew: session?.id === null,
    form,
    errors,
    setErrors,
    formError,
    setFormError,
    saving,
    setSaving,
    busy,
    setBusy,
    dirty,
    open,
    close,
    patch,
    requestClose,
    confirmingClose,
    discardDialog,
    focusFirstError,
  };
}
