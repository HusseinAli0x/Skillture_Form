import React, { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Copy, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { FieldType, FieldTypeLabels } from '../../api/types';
import { IconButton, Input, Label, Select } from '../ui';
import { FIELD_TYPES, HAS_OPTIONS, type FieldIssue, type FieldIssueKind, type FieldState } from './fieldState';

interface Props {
  field: FieldState;
  index: number;
  total: number;
  onChange: (patch: Partial<FieldState>) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onDuplicate?: () => void;
  /** Problems to show beside the offending input; pass them once the author has tried to save. */
  issues?: FieldIssue[];
  /** Put the cursor in the label on mount (a field that was just added). */
  autoFocus?: boolean;
}

/**
 * Editor for a single form field. Extracted from FormBuilder, which was a
 * 433-line file holding page chrome, save orchestration and this editor.
 * Enter in an option adds the next one.
 */
const FieldEditor: React.FC<Props> = ({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  onDuplicate,
  issues = [],
  autoFocus = false,
}) => {
  const root = useRef<HTMLDivElement>(null);
  const focusIndex = useRef<number | null>(null);

  // Ids are scoped to the field so several editors on the page do not collide,
  // and so each Label actually names its control — without htmlFor the visible
  // text is decoration and the field is unnamed to a screen reader.
  const fieldId = (name: string) => `f-${field._id}-${name}`;

  // An option-based field always shows at least one row to type into.
  const options = field.options.length === 0 ? [''] : field.options;

  const issue = (kind: FieldIssueKind) => issues.find(i => i.field === kind)?.message;
  const problem = (kind: FieldIssueKind) => {
    const message = issue(kind);
    return message ? (
      <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
        {message}
      </p>
    ) : null;
  };

  const setOption = (i: number, value: string) => {
    const next = [...options];
    next[i] = value;
    onChange({ options: next });
  };

  const addOption = () => {
    focusIndex.current = options.length;
    onChange({ options: [...(field.options.length === 0 ? [] : field.options), ''] });
  };

  useEffect(() => {
    if (focusIndex.current === null) return;
    const el = root.current?.querySelectorAll<HTMLInputElement>('[data-option-input]')[focusIndex.current];
    focusIndex.current = null;
    el?.focus();
  }, [field.options.length]);

  return (
    <div
      ref={root}
      data-field-id={field._id}
      className={`rounded-xl border bg-panel ${issues.length ? 'border-danger-border' : 'border-border'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-hover-overlay px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-primary px-2 font-display text-base font-extrabold text-ink">
            {index + 1}
          </span>
          <span className="sr-only">Field {index + 1}</span>
          <div className="flex items-center gap-1">
            <IconButton label="Move field up" disabled={index === 0} onClick={() => onMove('up')}>
              <ArrowUp className="h-4 w-4" />
            </IconButton>
            <IconButton label="Move field down" disabled={index === total - 1} onClick={() => onMove('down')}>
              <ArrowDown className="h-4 w-4" />
            </IconButton>
          </div>
          <span className="rounded-full border border-primary-border bg-primary-soft px-2 py-0.5 text-xs text-primary">
            {FieldTypeLabels[field.type]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ required: !field.required })}
            aria-pressed={field.required}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
              field.required ? 'text-primary' : 'text-muted hover:text-text'
            }`}
          >
            {field.required ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            Required
          </button>
          {onDuplicate && (
            <IconButton label="Duplicate field" tone="primary" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
            </IconButton>
          )}
          <IconButton label="Remove field" tone="danger" disabled={total === 1} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor={fieldId('label')} required>
              Label
            </Label>
            <Input
              id={fieldId('label')}
              value={field.label}
              onChange={e => onChange({ label: e.target.value })}
              placeholder="Field label..."
              invalid={!!issue('label')}
              autoFocus={autoFocus}
              className="!px-3 !py-2 font-medium"
            />
            {problem('label')}
          </div>
          <div className="w-44">
            <Label htmlFor={fieldId('type')}>Type</Label>
            <div className="relative">
              <Select id={fieldId('type')} value={field.type} onChange={e => onChange({ type: Number(e.target.value) as FieldType })}>
                {FIELD_TYPES.map(t => (
                  <option key={t} value={t}>
                    {FieldTypeLabels[t]}
                  </option>
                ))}
              </Select>
              <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor={fieldId('placeholder')}>Placeholder</Label>
            <Input
              id={fieldId('placeholder')}
              value={field.placeholder}
              onChange={e => onChange({ placeholder: e.target.value })}
              placeholder="Hint text shown inside the field..."
              className="!px-3 !py-2"
            />
          </div>
          <div>
            <Label htmlFor={fieldId('help')}>Help Text</Label>
            <Input
              id={fieldId('help')}
              value={field.helpText}
              onChange={e => onChange({ helpText: e.target.value })}
              placeholder="Helper text shown below the field..."
              className="!px-3 !py-2"
            />
          </div>
        </div>

        {HAS_OPTIONS.includes(field.type) && (
          <div>
            <Label required className="mb-2">
              Options
            </Label>
            <div className="space-y-2">
              {options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold text-muted">
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <Input
                    value={opt}
                    data-option-input=""
                    onChange={e => setOption(oi, e.target.value)}
                    onKeyDown={e => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      if (oi === options.length - 1) addOption();
                      else root.current?.querySelectorAll<HTMLInputElement>('[data-option-input]')[oi + 1]?.focus();
                    }}
                    placeholder={`Option ${oi + 1}...`}
                    aria-label={`Option ${oi + 1}`}
                    className="flex-1 !px-3 !py-1.5"
                  />
                  {options.length > 1 && (
                    <IconButton
                      label={`Remove option ${oi + 1}`}
                      tone="danger"
                      onClick={() => onChange({ options: options.filter((_, i) => i !== oi) })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
            {problem('options')}
            <button
              type="button"
              onClick={addOption}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
            >
              <Plus className="h-3.5 w-3.5" /> Add Option
              <span className="text-muted">(or press Enter in the last one)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldEditor;
