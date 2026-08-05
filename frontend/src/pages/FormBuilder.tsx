import React, { useState } from 'react';
import { Plus, Trash2, Save, ArrowLeft, ToggleLeft, ToggleRight, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import { FieldTypeToInt, FieldTypeLabels } from '../api/types';
import type { FieldType } from '../api/types';
import { useToastStore } from '../context/ToastStore';
import StatusDropdown from '../components/StatusDropdown';

const FIELD_TYPES: FieldType[] = ['text', 'textarea', 'number', 'email', 'select', 'radio', 'checkbox', 'date'];
const HAS_OPTIONS: FieldType[] = ['select', 'radio', 'checkbox'];

const generateId = () => Math.random().toString(36).substring(2, 9);

interface FieldState {
  _id: string;
  label: string;
  placeholder: string;
  helpText: string;
  type: FieldType;
  required: boolean;
  options: string[];
  isNew?: boolean;
}

const FormBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const { addToast } = useToastStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldState[]>([
    { _id: generateId(), label: '', placeholder: '', helpText: '', type: 'text', required: false, options: [], isNew: true }
  ]);
  const [status, setStatus] = useState<0|1|2>(0);
  const [fullObject, setFullObject] = useState<any>(null);
  const [deletedFieldIds, setDeletedFieldIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!isEditMode) return;
    Promise.all([
      client.get(`/api/v1/forms/${id}`),
      client.get(`/api/v1/forms/${id}/fields`)
    ]).then(([fRes, ffRes]) => {
      setTitle(fRes.data.title || '');
      setDescription(fRes.data.description || '');
      setStatus(fRes.data.status as 0|1|2 || 0);
      setFullObject(fRes.data);
      const fetchedFields = (ffRes.data || []).sort((a: any, b: any) => a.field_order - b.field_order).map((f: any) => {
        let opts: string[] = [];
        if (f.options) {
          const keys = Object.keys(f.options).sort();
          opts = keys.map(k => f.options[k].label || f.options[k].value || '');
        }
        return {
          _id: f.id,
          label: f.label?.en || f.label || '',
          placeholder: f.placeholder?.en || f.placeholder || '',
          helpText: f.help_text?.en || f.help_text || '',
          type: Object.keys(FieldTypeToInt).find((k: any) => FieldTypeToInt[k as FieldType] === f.type) as FieldType || 'text',
          required: f.required || false,
          options: opts,
          isNew: false
        };
      });
      if (fetchedFields.length > 0) setFields(fetchedFields);
    }).catch(_err => {
      addToast('error', 'Failed to load form for editing.');
    });
  }, [id, isEditMode]);

  const addField = () => {
    setFields(prev => [...prev, {
      _id: generateId(), label: '', placeholder: '', helpText: '',
      type: 'text', required: false, options: [], isNew: true
    }]);
  };

  const removeField = (fieldId: string) => {
    const field = fields.find(f => f._id === fieldId);
    if (field && !field.isNew) {
      setDeletedFieldIds(prev => [...prev, fieldId]);
    }
    setFields(prev => prev.filter(f => f._id !== fieldId));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === fields.length - 1)) return;
    const newFields = [...fields];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
    setFields(newFields);
  };

  const updateField = (id: string, patch: Partial<FieldState>) => {
    setFields(prev => prev.map(f => {
      if (f._id !== id) return f;
      const updated = { ...f, ...patch };
      // Reset options when type changes away from option-based
      if (patch.type && !HAS_OPTIONS.includes(patch.type)) updated.options = [];
      return updated;
    }));
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) { setError('Form title is required.'); return; }
    for (const f of fields) {
      if (!f.label.trim()) { setError('All fields must have a label.'); return; }
      if (HAS_OPTIONS.includes(f.type) && f.options.filter(o => o.trim()).length === 0) {
        setError(`"${f.label}" requires at least one option.`); return;
      }
    }
    setIsSaving(true);
    try {
      let formId = id;

      // 1. Create or Update form
      const payload = {
        title: { en: title },
        description: { en: description }
      };

      if (isEditMode) {
        await client.put(`/api/v1/forms/${id}`, payload);
      } else {
        const formRes = await client.post('/api/v1/forms', payload);
        formId = formRes.data.id;
      }

      // 2. Process deletions
      for (const delId of deletedFieldIds) {
        await client.delete(`/api/v1/forms/${formId}/fields/${delId}`);
      }

      // 3. Create or Update fields
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const optionsMap: Record<string, any> = {};
        if (HAS_OPTIONS.includes(f.type)) {
          f.options.filter(o => o.trim()).forEach((o, idx) => {
            optionsMap[`opt_${idx}`] = { label: o };
          });
        }
        
        const payload = {
          label: { en: f.label },
          placeholder: f.placeholder ? { en: f.placeholder } : undefined,
          help_text: f.helpText ? { en: f.helpText } : undefined,
          required: f.required,
          type: FieldTypeToInt[f.type],
          field_order: i + 1,
          options: Object.keys(optionsMap).length > 0 ? optionsMap : undefined,
        };

        if (f.isNew) {
          await client.post(`/api/v1/forms/${formId}/fields`, payload);
        } else {
          await client.put(`/api/v1/forms/${formId}/fields/${f._id}`, payload);
        }
      }
      addToast('success', `Form ${isEditMode ? 'updated' : 'created'} successfully!`);
      navigate('/admin/forms');
    } catch (err: any) {
      addToast('error', err.response?.data?.error || 'Failed to save form.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/forms')}
          className="p-2 rounded-lg transition-colors"
          style={{ color: '#888', border: '1px solid #2a2a2a' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#3a3a3a'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f0f0f0' }}>{isEditMode ? 'Edit Form' : 'New Form'}</h1>
          <p className="text-sm mt-0.5" style={{ color: '#888' }}>{isEditMode ? 'Update your form fields and details.' : 'Build your form by adding fields below.'}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{ backgroundColor: '#0ABFBC', color: '#0a0a0a' }}
          onMouseEnter={e => !isSaving && (e.currentTarget.style.backgroundColor = '#09a8a5')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0ABFBC')}
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Form'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm border" style={{ backgroundColor: 'rgba(224,85,85,0.08)', borderColor: 'rgba(224,85,85,0.25)', color: '#e05555' }}>
          {error}
        </div>
      )}

      {/* Form metadata */}
      <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: '#f0f0f0' }}>Form Details</h2>
          {isEditMode && fullObject && (
            <StatusDropdown 
              type="form" 
              id={id!} 
              initialStatus={status} 
              fullObject={fullObject} 
              onStatusChange={setStatus} 
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Title <span style={{ color: '#0ABFBC' }}>*</span></label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all font-medium"
            style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
            onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
            onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
            placeholder="e.g. Customer Satisfaction Survey"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
            style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
            onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
            onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
            placeholder="Brief description for form respondents..."
          />
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {fields.map((field, idx) => (
          <div key={field._id} className="rounded-xl border overflow-hidden transition-all" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
            {/* Field header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#2a2a2a', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 p-1">
                  <button 
                    onClick={() => moveField(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 border border-[#0ABFBC]/20 bg-[#0ABFBC]/10 rounded-md transition-all duration-200 disabled:opacity-30 disabled:grayscale hover:bg-[#0ABFBC]/20 hover:border-[#0ABFBC]/40 group"
                  >
                    <ArrowUp className="w-4 h-4 text-[#0ABFBC] transition-colors" />
                  </button>
                  <button 
                    onClick={() => moveField(idx, 'down')}
                    disabled={idx === fields.length - 1}
                    className="p-1.5 border border-[#0ABFBC]/20 bg-[#0ABFBC]/10 rounded-md transition-all duration-200 disabled:opacity-30 disabled:grayscale hover:bg-[#0ABFBC]/20 hover:border-[#0ABFBC]/40 group"
                  >
                    <ArrowDown className="w-4 h-4 text-[#0ABFBC] transition-colors" />
                  </button>
                </div>
                <span className="text-sm font-medium" style={{ color: '#888' }}>Field {idx + 1}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(10,191,188,0.1)', color: '#0ABFBC', border: '1px solid rgba(10,191,188,0.2)' }}>
                  {FieldTypeLabels[field.type]}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Required toggle */}
                <button
                  onClick={() => updateField(field._id, { required: !field.required })}
                  className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                  style={{ color: field.required ? '#0ABFBC' : '#888' }}
                >
                  {field.required ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  Required
                </button>
                <button
                  onClick={() => removeField(field._id)}
                  disabled={fields.length === 1}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                  style={{ color: '#888' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#e05555'; e.currentTarget.style.backgroundColor = 'rgba(224,85,85,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Row: Label + Type */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Label <span style={{ color: '#0ABFBC' }}>*</span></label>
                  <input
                    value={field.label}
                    onChange={e => updateField(field._id, { label: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                    style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                    onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                    placeholder="Field label..."
                  />
                </div>
                <div className="w-44">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Type</label>
                  <div className="relative">
                    <select
                      value={field.type}
                      onChange={e => updateField(field._id, { type: e.target.value as FieldType })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none cursor-pointer"
                      style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                    >
                      {FIELD_TYPES.map(t => (
                        <option key={t} value={t}>{FieldTypeLabels[t]}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#888' }} />
                  </div>
                </div>
              </div>

              {/* Placeholder */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Placeholder</label>
                <input
                  value={field.placeholder}
                  onChange={e => updateField(field._id, { placeholder: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                  style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                  onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                  placeholder="Hint text shown inside the field..."
                />
              </div>

              {/* Help text */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Help Text</label>
                <input
                  value={field.helpText}
                  onChange={e => updateField(field._id, { helpText: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                  style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                  onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                  placeholder="Helper text shown below the field..."
                />
              </div>

              {/* Options — only for select/radio/checkbox */}
              {HAS_OPTIONS.includes(field.type) && (
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#888' }}>Options <span style={{ color: '#0ABFBC' }}>*</span></label>
                  <div className="space-y-2">
                    {(field.options.length === 0 ? [''] : field.options).map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex-shrink-0 border flex items-center justify-center" style={{ borderColor: '#2a2a2a' }}>
                          <span className="text-xs font-bold" style={{ color: '#888' }}>{String.fromCharCode(65 + oi)}</span>
                        </div>
                        <input
                          value={opt}
                          onChange={e => {
                            const newOpts = [...(field.options.length === 0 ? [''] : field.options)];
                            newOpts[oi] = e.target.value;
                            updateField(field._id, { options: newOpts });
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none transition-all"
                          style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                          onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                          placeholder={`Option ${oi + 1}...`}
                        />
                        {(field.options.length === 0 ? [''] : field.options).length > 1 && (
                          <button
                            onClick={() => {
                              const newOpts = (field.options.length === 0 ? [''] : field.options).filter((_, i) => i !== oi);
                              updateField(field._id, { options: newOpts });
                            }}
                            style={{ color: '#888' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#e05555'}
                            onMouseLeave={e => e.currentTarget.style.color = '#888'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => updateField(field._id, { options: [...(field.options.length === 0 ? [] : field.options), ''] })}
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium transition-colors"
                    style={{ color: '#0ABFBC' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Option
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add field button */}
      <button
        onClick={addField}
        className="w-full py-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all duration-150"
        style={{ border: '2px dashed #2a2a2a', color: '#888' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#0ABFBC'; e.currentTarget.style.color = '#0ABFBC'; e.currentTarget.style.backgroundColor = 'rgba(10,191,188,0.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <Plus className="w-4 h-4" /> Add Field
      </button>
    </div>
  );
};

export default FormBuilder;
