import { FieldType } from '../../api/types';
import type { FormField } from '../../api/types';
import { localized, toLocalized } from '../../lib/i18n';
import { newId } from '../../lib/id';

/**
 * A form field while it is being edited. Kept apart from FieldEditor so that
 * file only exports a component — a module mixing components and constants
 * defeats React Fast Refresh, which then reloads the whole page and discards
 * whatever the user had typed.
 */
export interface FieldState {
  /** Client-side row key; the server id once the field has been saved. */
  _id: string;
  label: string;
  placeholder: string;
  helpText: string;
  type: FieldType;
  required: boolean;
  options: string[];
  isNew?: boolean;
}

/** Field types that need an option list. */
export const HAS_OPTIONS: FieldType[] = [FieldType.Select, FieldType.Radio, FieldType.Checkbox];

export const FIELD_TYPES: FieldType[] = [
  FieldType.Text,
  FieldType.Textarea,
  FieldType.Number,
  FieldType.Email,
  FieldType.Select,
  FieldType.Radio,
  FieldType.Checkbox,
  FieldType.Date,
];

export const emptyField = (): FieldState => ({
  _id: newId(),
  label: '',
  placeholder: '',
  helpText: '',
  type: FieldType.Text,
  required: false,
  options: [],
  isNew: true,
});

/** A copy that saves as a new field. */
export const duplicateField = (f: FieldState): FieldState => ({ ...f, _id: newId(), options: [...f.options], isNew: true });

export type FieldIssueKind = 'label' | 'options';

export interface FieldIssue {
  field: FieldIssueKind;
  message: string;
}

export function validateField(f: FieldState): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (!f.label.trim()) issues.push({ field: 'label', message: 'Give this field a label so people know what to enter.' });
  if (HAS_OPTIONS.includes(f.type)) {
    const filled = f.options.map(o => o.trim()).filter(Boolean);
    if (filled.length === 0) issues.push({ field: 'options', message: 'Add at least one option to choose from.' });
    else if (new Set(filled.map(o => o.toLowerCase())).size !== filled.length) {
      issues.push({ field: 'options', message: 'Two options are the same.' });
    }
  }
  return issues;
}

/**
 * The API payload for one field. Option keys are `opt_0`, `opt_1`, … so a
 * lexical sort restores the order they were written in.
 */
export function serializeField(f: FieldState) {
  const options: Record<string, { label: string }> = {};
  if (HAS_OPTIONS.includes(f.type)) {
    f.options
      .map(o => o.trim())
      .filter(Boolean)
      .forEach((o, i) => {
        options[`opt_${i}`] = { label: o };
      });
  }
  return {
    // A new field has a client-generated `_id` that means nothing to the
    // server; omitting it is what marks the field as an insert.
    id: f.isNew ? undefined : f._id,
    label: toLocalized(f.label.trim()),
    placeholder: f.placeholder ? toLocalized(f.placeholder) : undefined,
    help_text: f.helpText ? toLocalized(f.helpText) : undefined,
    required: f.required,
    type: f.type,
    options: Object.keys(options).length > 0 ? options : undefined,
  };
}

/** Rebuilds the editor state from a stored field. */
export function readField(f: FormField): FieldState {
  return {
    _id: f.id,
    label: localized(f.label),
    placeholder: localized(f.placeholder),
    helpText: localized(f.help_text),
    type: (f.type ?? FieldType.Text) as FieldType,
    required: f.required || false,
    // Unlike the read-only views this falls back to an empty string rather
    // than the key — the key is not something the author typed, and saving it
    // back would make it the option's label.
    options: Object.entries(f.options ?? {})
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([, opt]) => {
        const o = opt as { label?: string; value?: string; en?: string };
        return o?.label || o?.value || o?.en || '';
      }),
    isNew: false,
  };
}

/** Stable string of everything the author can change, to tell "unsaved" from "saved". */
export const formSnapshot = (title: string, description: string, fields: FieldState[]): string =>
  JSON.stringify([
    title,
    description,
    fields.map(f => [f._id, f.label, f.placeholder, f.helpText, f.type, f.required, f.options]),
  ]);
