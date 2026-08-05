import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Save, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import { FieldType, FormStatus } from '../api/types';
import type { Form } from '../api/types';
import { localized, toLocalized } from '../lib/i18n';
import { useToastStore } from '../context/ToastStore';
import StatusDropdown from '../components/StatusDropdown';
import FieldEditor from '../components/forms/FieldEditor';
import { emptyField, HAS_OPTIONS, type FieldState } from '../components/forms/fieldState';
import { Button, Card, IconButton, Input, Label, Textarea } from '../components/ui';

const FormBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const { addToast } = useToastStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldState[]>([emptyField()]);
  const [status, setStatus] = useState<FormStatus>(FormStatus.Draft);
  const [fullObject, setFullObject] = useState<Form | null>(null);
  const [deletedFieldIds, setDeletedFieldIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const loadForm = useCallback(async () => {
    if (!isEditMode) return;
    try {
      const [fRes, ffRes] = await Promise.all([
        client.get(`/api/v1/forms/${id}`),
        client.get(`/api/v1/forms/${id}/fields`),
      ]);

      // title/description are JSONB maps ({en: "..."}), not strings — reading
      // them raw put "[object Object]" in these inputs.
      setTitle(localized(fRes.data.title));
      setDescription(localized(fRes.data.description));
      setStatus((fRes.data.status ?? FormStatus.Draft) as FormStatus);
      setFullObject(fRes.data);

      const fetched: FieldState[] = (ffRes.data || [])
        .slice()
        .sort((a: any, b: any) => a.field_order - b.field_order)
        .map((f: any) => ({
          _id: f.id,
          label: localized(f.label),
          placeholder: localized(f.placeholder),
          helpText: localized(f.help_text),
          type: (f.type ?? FieldType.Text) as FieldType,
          required: f.required || false,
          options: f.options
            ? Object.keys(f.options)
                .sort()
                .map(k => f.options[k].label || f.options[k].value || '')
            : [],
          isNew: false,
        }));

      if (fetched.length > 0) setFields(fetched);
    } catch {
      addToast('error', 'Failed to load form for editing.');
    }
  }, [id, isEditMode, addToast]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const addField = () => setFields(prev => [...prev, emptyField()]);

  const removeField = (fieldId: string) => {
    const field = fields.find(f => f._id === fieldId);
    if (field && !field.isNew) setDeletedFieldIds(prev => [...prev, fieldId]);
    setFields(prev => prev.filter(f => f._id !== fieldId));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setFields(next);
  };

  const updateField = (fieldId: string, patch: Partial<FieldState>) => {
    setFields(prev =>
      prev.map(f => {
        if (f._id !== fieldId) return f;
        const updated = { ...f, ...patch };
        // Options are meaningless once the type is no longer option-based.
        if (patch.type && !HAS_OPTIONS.includes(patch.type)) updated.options = [];
        return updated;
      })
    );
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Form title is required.';
    for (const f of fields) {
      if (!f.label.trim()) return 'All fields must have a label.';
      if (HAS_OPTIONS.includes(f.type) && f.options.filter(o => o.trim()).length === 0) {
        return `"${f.label}" requires at least one option.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    setError(validationError ?? '');
    if (validationError) return;

    setIsSaving(true);
    try {
      let formId = id;

      const formPayload = {
        title: toLocalized(title),
        description: toLocalized(description),
      };

      if (isEditMode) {
        await client.put(`/api/v1/forms/${id}`, formPayload);
      } else {
        const formRes = await client.post('/api/v1/forms', formPayload);
        formId = formRes.data.id;
      }

      for (const delId of deletedFieldIds) {
        await client.delete(`/api/v1/forms/${formId}/fields/${delId}`);
      }

      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];

        const optionsMap: Record<string, { label: string }> = {};
        if (HAS_OPTIONS.includes(f.type)) {
          f.options
            .filter(o => o.trim())
            .forEach((o, idx) => {
              optionsMap[`opt_${idx}`] = { label: o };
            });
        }

        const payload = {
          label: toLocalized(f.label),
          placeholder: f.placeholder ? toLocalized(f.placeholder) : undefined,
          help_text: f.helpText ? toLocalized(f.helpText) : undefined,
          required: f.required,
          type: f.type,
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
      <div className="flex items-center gap-4">
        <IconButton
          label="Back to forms"
          onClick={() => navigate('/admin/forms')}
          className="border border-border hover:border-border-strong !p-2"
        >
          <ArrowLeft className="w-4 h-4" />
        </IconButton>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-text">{isEditMode ? 'Edit Form' : 'New Form'}</h1>
          <p className="text-sm mt-0.5 text-muted">
            {isEditMode ? 'Update your form fields and details.' : 'Build your form by adding fields below.'}
          </p>
        </div>
        <Button onClick={handleSave} loading={isSaving}>
          {!isSaving && <Save className="w-4 h-4" />}
          {isSaving ? 'Saving…' : 'Save Form'}
        </Button>
      </div>

      {error && (
        <div role="alert" className="px-4 py-3 rounded-lg text-sm border bg-danger-soft border-danger-border text-danger">
          {error}
        </div>
      )}

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Form Details</h2>
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
          <Label required>Title</Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Customer Satisfaction Survey"
            className="!py-2.5 font-medium"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Brief description for form respondents..."
            className="!py-2.5 resize-none"
          />
        </div>
      </Card>

      <div className="space-y-4">
        {fields.map((field, idx) => (
          <FieldEditor
            key={field._id}
            field={field}
            index={idx}
            total={fields.length}
            onChange={patch => updateField(field._id, patch)}
            onRemove={() => removeField(field._id)}
            onMove={direction => moveField(idx, direction)}
          />
        ))}
      </div>

      <button
        onClick={addField}
        className="w-full py-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border-2 border-dashed border-border text-muted transition-colors hover:border-primary hover:text-primary hover:bg-primary-subtle"
      >
        <Plus className="w-4 h-4" /> Add Field
      </button>
    </div>
  );
};

export default FormBuilder;
