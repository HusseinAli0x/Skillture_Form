import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FieldType } from '../../api/types';
import type { FormField } from '../../api/types';
import FieldInput from './FieldInput';

const field = (type: FieldType, overrides: Partial<FormField> = {}): FormField => ({
  id: 'f1',
  form_id: 'form1',
  label: { en: 'Question' },
  required: false,
  field_order: 1,
  type,
  created_at: '',
  updated_at: '',
  ...overrides,
});

const colours = { opt_0: { label: 'Red' }, opt_1: { label: 'Green' } };

describe('FieldInput control selection', () => {
  // enums.FieldType is an int16, but this was once compared against the
  // strings 'textarea' / 'select' / 'radio' / 'checkbox', so every field on
  // every public form fell through to a plain text input.
  it('renders a textarea for Textarea', () => {
    render(<FieldInput field={field(FieldType.Textarea)} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  });

  it('renders a dropdown for Select', () => {
    render(<FieldInput field={field(FieldType.Select, { options: colours })} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Red' })).toBeInTheDocument();
  });

  it('renders radios for Radio', () => {
    render(<FieldInput field={field(FieldType.Radio, { options: colours })} value="" onChange={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('renders checkboxes for Checkbox', () => {
    render(<FieldInput field={field(FieldType.Checkbox, { options: colours })} value={[]} onChange={vi.fn()} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it.each([
    [FieldType.Number, 'number'],
    [FieldType.Email, 'email'],
    [FieldType.Date, 'date'],
    [FieldType.Text, 'text'],
  ])('maps type %i to input type %s', (type, expected) => {
    const { container } = render(<FieldInput field={field(type)} value="" onChange={vi.fn()} />);
    expect(container.querySelector('input')).toHaveAttribute('type', expected);
  });
});

describe('FieldInput option labels', () => {
  it('shows the label the builder wrote, not the option key', () => {
    // Respondents used to see opt_0 / opt_1 because readers only looked for
    // `en` and `value` while the builder writes `label`.
    render(<FieldInput field={field(FieldType.Radio, { options: colours })} value="" onChange={vi.fn()} />);
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.queryByText('opt_0')).not.toBeInTheDocument();
  });
});

describe('FieldInput is controlled', () => {
  // The inputs were once uncontrolled — only onChange was wired, no value —
  // so a field could not be reset or re-rendered from state.
  it('reflects the value it is given', () => {
    render(<FieldInput field={field(FieldType.Text)} value="hello" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('hello');
  });

  it('shows the selected radio as checked', () => {
    render(<FieldInput field={field(FieldType.Radio, { options: colours })} value="opt_1" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Green' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Red' })).not.toBeChecked();
  });

  it('reports the option key, not the label, when a radio is picked', async () => {
    const onChange = vi.fn();
    render(<FieldInput field={field(FieldType.Radio, { options: colours })} value="" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Green' }));
    expect(onChange).toHaveBeenCalledWith('opt_1');
  });
});

describe('FieldInput checkbox groups', () => {
  it('adds to the selection', async () => {
    const onChange = vi.fn();
    render(
      <FieldInput field={field(FieldType.Checkbox, { options: colours })} value={['opt_0']} onChange={onChange} />
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'Green' }));
    expect(onChange).toHaveBeenCalledWith(['opt_0', 'opt_1']);
  });

  it('removes from the selection', async () => {
    const onChange = vi.fn();
    render(
      <FieldInput field={field(FieldType.Checkbox, { options: colours })} value={['opt_0', 'opt_1']} onChange={onChange} />
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'Red' }));
    expect(onChange).toHaveBeenCalledWith(['opt_1']);
  });

  it('survives a non-array value without crashing', () => {
    // Answers written by an older build can be a bare string.
    render(
      <FieldInput field={field(FieldType.Checkbox, { options: colours })} value="opt_0" onChange={vi.fn()} />
    );
    screen.getAllByRole('checkbox').forEach(box => expect(box).not.toBeChecked());
  });
});
