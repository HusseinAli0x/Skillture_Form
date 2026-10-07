import { describe, expect, it } from 'vitest';
import { FieldType } from '../../api/types';
import { duplicateField, emptyField, formSnapshot, readField, serializeField, validateField } from './fieldState';

describe('validateField', () => {
  it('needs a label', () => {
    expect(validateField(emptyField()).map(i => i.field)).toEqual(['label']);
    expect(validateField({ ...emptyField(), label: 'Name' })).toEqual([]);
  });

  it('needs options for a choice field, and no repeats', () => {
    const base = { ...emptyField(), label: 'Colour', type: FieldType.Radio };
    expect(validateField(base).map(i => i.field)).toEqual(['options']);
    expect(validateField({ ...base, options: ['Red', ' red '] }).map(i => i.field)).toEqual(['options']);
    expect(validateField({ ...base, options: ['Red', 'Green'] })).toEqual([]);
  });
});

describe('serializeField / readField', () => {
  it('writes ordered opt_N keys and drops blank options', () => {
    const f = { ...emptyField(), label: ' Pick ', type: FieldType.Select, options: ['A', '', 'B'] };
    const out = serializeField(f);
    expect(out.options).toEqual({ opt_0: { label: 'A' }, opt_1: { label: 'B' } });
    expect(out.label).toEqual({ en: 'Pick' });
    expect(out.id).toBeUndefined();
  });

  it('reads options back in numeric key order, past opt_9', () => {
    const options: Record<string, unknown> = {};
    for (let i = 0; i < 12; i++) options[`opt_${i}`] = { label: `L${i}` };
    const shuffled = Object.fromEntries(Object.entries(options).reverse());
    const back = readField({
      id: 'srv',
      form_id: 'f',
      label: { en: 'x' },
      required: true,
      options: shuffled,
      field_order: 1,
      type: FieldType.Checkbox,
      created_at: '',
      updated_at: '',
    });
    expect(back.options).toEqual(Array.from({ length: 12 }, (_, i) => `L${i}`));
    expect(back.isNew).toBe(false);
  });
});

describe('duplicateField and snapshot', () => {
  it('copies with a new id and its own options array', () => {
    const f = { ...emptyField(), isNew: false, options: ['A'] };
    const copy = duplicateField(f);
    expect(copy._id).not.toBe(f._id);
    expect(copy.isNew).toBe(true);
    copy.options.push('B');
    expect(f.options).toEqual(['A']);
  });

  it('changes only when something the author controls changes', () => {
    const f = emptyField();
    const base = formSnapshot('T', '', [f]);
    expect(formSnapshot('T', '', [f])).toBe(base);
    expect(formSnapshot('T', '', [{ ...f, required: true }])).not.toBe(base);
  });
});
