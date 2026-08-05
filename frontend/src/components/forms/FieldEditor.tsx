import React from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { FieldType, FieldTypeLabels } from '../../api/types';
import { IconButton, Input, Label, Select } from '../ui';
import { FIELD_TYPES, HAS_OPTIONS, type FieldState } from './fieldState';

interface Props {
  field: FieldState;
  index: number;
  total: number;
  onChange: (patch: Partial<FieldState>) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
}

/**
 * Editor for a single form field. Extracted from FormBuilder, which was a
 * 433-line file holding page chrome, save orchestration and this editor.
 */
const FieldEditor: React.FC<Props> = ({ field, index, total, onChange, onRemove, onMove }) => {
  // Ids are scoped to the field so several editors on the page do not collide,
  // and so each Label actually names its control — without htmlFor the visible
  // text is decoration and the field is unnamed to a screen reader.
  const fieldId = (name: string) => `f-${field._id}-${name}`;

  // An option-based field always shows at least one row to type into.
  const options = field.options.length === 0 ? [''] : field.options;

  const setOption = (i: number, value: string) => {
    const next = [...options];
    next[i] = value;
    onChange({ options: next });
  };

  return (
    <div className="rounded-xl border border-border bg-panel overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-hover-overlay">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-1">
            <button
              onClick={() => onMove('up')}
              disabled={index === 0}
              aria-label="Move field up"
              className="p-1.5 rounded-md border border-primary-border bg-primary-soft text-primary transition-colors hover:bg-primary hover:text-bg disabled:opacity-30 disabled:hover:bg-primary-soft disabled:hover:text-primary"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onMove('down')}
              disabled={index === total - 1}
              aria-label="Move field down"
              className="p-1.5 rounded-md border border-primary-border bg-primary-soft text-primary transition-colors hover:bg-primary hover:text-bg disabled:opacity-30 disabled:hover:bg-primary-soft disabled:hover:text-primary"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
          <span className="text-sm font-medium text-muted">Field {index + 1}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary-border">
            {FieldTypeLabels[field.type]}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange({ required: !field.required })}
            aria-pressed={field.required}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              field.required ? 'text-primary' : 'text-muted hover:text-text'
            }`}
          >
            {field.required ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            Required
          </button>
          <IconButton label="Remove field" tone="danger" disabled={total === 1} onClick={onRemove}>
            <Trash2 className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor={fieldId('label')} required>
              Label
            </Label>
            <Input
              id={fieldId('label')}
              value={field.label}
              onChange={e => onChange({ label: e.target.value })}
              placeholder="Field label..."
              className="!py-2 !px-3"
            />
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
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted" />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor={fieldId('placeholder')}>Placeholder</Label>
          <Input
            id={fieldId('placeholder')}
            value={field.placeholder}
            onChange={e => onChange({ placeholder: e.target.value })}
            placeholder="Hint text shown inside the field..."
            className="!py-2 !px-3"
          />
        </div>

        <div>
          <Label htmlFor={fieldId('help')}>Help Text</Label>
          <Input
            id={fieldId('help')}
            value={field.helpText}
            onChange={e => onChange({ helpText: e.target.value })}
            placeholder="Helper text shown below the field..."
            className="!py-2 !px-3"
          />
        </div>

        {HAS_OPTIONS.includes(field.type) && (
          <div>
            <Label required className="mb-2">
              Options
            </Label>
            <div className="space-y-2">
              {options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex-shrink-0 border border-border flex items-center justify-center text-xs font-bold text-muted">
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <Input
                    value={opt}
                    onChange={e => setOption(oi, e.target.value)}
                    placeholder={`Option ${oi + 1}...`}
                    aria-label={`Option ${oi + 1}`}
                    className="flex-1 !py-1.5 !px-3"
                  />
                  {options.length > 1 && (
                    <IconButton
                      label={`Remove option ${oi + 1}`}
                      tone="danger"
                      onClick={() => onChange({ options: options.filter((_, i) => i !== oi) })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => onChange({ options: [...(field.options.length === 0 ? [] : field.options), ''] })}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Option
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldEditor;
