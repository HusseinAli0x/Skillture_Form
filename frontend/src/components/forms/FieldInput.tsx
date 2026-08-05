import React from 'react';
import { FieldType } from '../../api/types';
import type { FormField } from '../../api/types';
import { Input, Select, Textarea } from '../ui';
import { optionLabel } from '../../lib/i18n';

interface Props {
  field: FormField;
  value: unknown;
  invalid?: boolean;
  onChange: (value: unknown) => void;
}

/** `<input type>` for the field types that render as a single text box. */
const inputType: Partial<Record<FieldType, string>> = {
  [FieldType.Number]: 'number',
  [FieldType.Email]: 'email',
  [FieldType.Date]: 'date',
};

// `options` is typed Record<string, unknown> because the API shape varies:
// the form builder writes {label}, older rows carry {value} or {en}.
type RawOption = Parameters<typeof optionLabel>[0];

const options = (field: FormField): [string, string][] =>
  Object.entries(field.options ?? {}).map(([key, opt]) => [key, optionLabel(opt as RawOption, key)]);

/**
 * Renders one form field for a respondent.
 *
 * `type` is an int16 (enums.FieldType), not a string. This was once compared
 * against 'textarea'/'select'/'radio'/'checkbox', so every field fell through
 * to a plain text input.
 */
const FieldInput: React.FC<Props> = ({ field, value, invalid, onChange }) => {
  const describedBy = invalid ? `${field.id}-error` : undefined;
  const shared = {
    'aria-required': field.required || undefined,
    'aria-describedby': describedBy,
    invalid,
  };

  switch (field.type) {
    case FieldType.Textarea:
      return (
        <Textarea
          {...shared}
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Your answer"
          className="min-h-[100px]"
        />
      );

    case FieldType.Select:
      return (
        <Select
          {...shared}
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          className="!py-3"
        >
          <option value="">Choose…</option>
          {options(field).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      );

    case FieldType.Radio:
      return (
        <div className="space-y-2" role="radiogroup" aria-describedby={describedBy}>
          {options(field).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={key}
                checked={value === key}
                onChange={() => onChange(key)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      );

    case FieldType.Checkbox: {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2" role="group" aria-describedby={describedBy}>
          {options(field).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                value={key}
                checked={selected.includes(key)}
                onChange={e =>
                  onChange(e.target.checked ? [...selected, key] : selected.filter(k => k !== key))
                }
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      );
    }

    default:
      return (
        <Input
          {...shared}
          type={inputType[field.type] ?? 'text'}
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Your answer"
          className="!py-3"
        />
      );
  }
};

export default FieldInput;
