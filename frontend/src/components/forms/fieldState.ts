import { FieldType } from '../../api/types';
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
