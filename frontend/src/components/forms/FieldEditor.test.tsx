import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FieldType } from '../../api/types';
import FieldEditor from './FieldEditor';
import { emptyField, HAS_OPTIONS, type FieldState } from './fieldState';

const renderEditor = (overrides: Partial<FieldState> = {}, onChange = vi.fn()) => {
  const field = { ...emptyField(), label: 'Your name', ...overrides };
  render(
    <FieldEditor
      field={field}
      index={0}
      total={2}
      onChange={onChange}
      onRemove={vi.fn()}
      onMove={vi.fn()}
    />
  );
  return { field, onChange };
};

describe('fieldState', () => {
  it('marks exactly the option-bearing types', () => {
    expect(HAS_OPTIONS).toEqual([FieldType.Select, FieldType.Radio, FieldType.Checkbox]);
  });

  it('gives each new field a distinct row key', () => {
    expect(emptyField()._id).not.toBe(emptyField()._id);
  });

  it('starts as a new, non-required text field', () => {
    const f = emptyField();
    expect(f.type).toBe(FieldType.Text);
    expect(f.required).toBe(false);
    expect(f.isNew).toBe(true);
  });
});

describe('FieldEditor options', () => {
  it('hides the option list for a plain text field', () => {
    renderEditor({ type: FieldType.Text });
    expect(screen.queryByRole('textbox', { name: 'Option 1' })).not.toBeInTheDocument();
  });

  it('shows one empty option row for a new select field', () => {
    // An option-based field with no options yet still needs somewhere to type.
    renderEditor({ type: FieldType.Select, options: [] });
    expect(screen.getByRole('textbox', { name: 'Option 1' })).toBeInTheDocument();
  });

  it('appends an option', async () => {
    const { onChange } = renderEditor({ type: FieldType.Radio, options: ['Red'] });

    await userEvent.click(screen.getByRole('button', { name: /add option/i }));
    expect(onChange).toHaveBeenCalledWith({ options: ['Red', ''] });
  });

  it('removes an option', async () => {
    const { onChange } = renderEditor({ type: FieldType.Radio, options: ['Red', 'Green'] });

    await userEvent.click(screen.getByRole('button', { name: 'Remove option 1' }));
    expect(onChange).toHaveBeenCalledWith({ options: ['Green'] });
  });

  it('will not remove the only option', () => {
    renderEditor({ type: FieldType.Radio, options: ['Red'] });
    expect(screen.queryByRole('button', { name: 'Remove option 1' })).not.toBeInTheDocument();
  });
});

describe('FieldEditor controls', () => {
  it('reports the numeric field type, not the option text', async () => {
    // enums.FieldType is an int16; a string here silently breaks every
    // comparison downstream.
    const { onChange } = renderEditor();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Type' }), String(FieldType.Email));
    expect(onChange).toHaveBeenCalledWith({ type: FieldType.Email });
  });

  it('toggles required', async () => {
    const { onChange } = renderEditor({ required: false });

    await userEvent.click(screen.getByRole('button', { name: /required/i }));
    expect(onChange).toHaveBeenCalledWith({ required: true });
  });

  it('will not remove the only field', () => {
    render(
      <FieldEditor
        field={emptyField()}
        index={0}
        total={1}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        onMove={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Remove field' })).toBeDisabled();
  });
});
