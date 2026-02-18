import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { Plus, Trash2, Save, ArrowLeft, CheckCircle } from 'lucide-react';
import styles from './FormBuilder.module.css';

const FIELD_TYPES = [
    { value: 'text', label: 'Short Text' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'number', label: 'Number' },
    { value: 'email', label: 'Email' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Dropdown' },
    { value: 'radio', label: 'Multiple Choice' },
    { value: 'checkbox', label: 'Checkbox' },
];

const FormBuilder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState(null);
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);

    // New Field State
    const [newField, setNewField] = useState({
        label: '',
        type: 'text',
        required: false,
        options: '' // Comma separated for MVP
    });
    const [addingField, setAddingField] = useState(false);

    useEffect(() => {
        fetchForm();
        fetchFields();
    }, [id]);

    const fetchForm = async () => {
        try {
            const res = await api.get(`/forms/${id}`);
            setForm(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchFields = async () => {
        try {
            const res = await api.get(`/forms/${id}/fields`);
            setFields((res.data || []).sort((a, b) => a.field_order - b.field_order));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddField = async (e) => {
        e.preventDefault();
        if (!newField.label) return;

        setAddingField(true);
        try {
            // Parse options if select
            let optionsMap = {};
            if (['select', 'radio', 'checkbox'].includes(newField.type) && newField.options) {
                newField.options.split(',').forEach(opt => {
                    const trimmed = opt.trim();
                    if (trimmed) optionsMap[trimmed] = trimmed;
                });
            }

            const payload = {
                form_id: id,
                label: { en: newField.label },
                type: newField.type,
                field_order: fields.length + 1,
                required: newField.required,
                options: optionsMap
            };

            const res = await api.post('/fields/', payload);
            setFields([...fields, res.data]);

            // Reset form
            setNewField({
                label: '',
                type: 'text',
                required: false,
                options: ''
            });
        } catch (err) {
            alert('Failed to add field');
            console.error(err);
        } finally {
            setAddingField(false);
        }
    };

    const handleDeleteField = async (fieldId) => {
        if (!window.confirm('Delete this field?')) return;
        try {
            await api.delete(`/fields/${fieldId}`);
            setFields(fields.filter(f => f.id !== fieldId));
        } catch (err) {
            console.error(err);
        }
    };

    const handlePublish = async () => {
        if (!window.confirm('Publishing will make the form visible to users. Continue?')) return;
        try {
            await api.post(`/forms/${id}/publish`);
            setForm({ ...form, status: 1 }); // Update local state to active
            alert('Form Published!');
        } catch (err) {
            alert('Failed to publish');
        }
    };

    if (loading) return <div className={styles.loading}>Loading Builder...</div>;
    if (!form) return <div className={styles.error}>Form not found</div>;

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <Button variant="secondary" onClick={() => navigate('/admin/dashboard')} className={styles.backBtn}>
                        <ArrowLeft size={18} />
                    </Button>
                    <div>
                        <h1 className={styles.title}>{form.title}</h1>
                        <span className={styles.subtitle}>Form Builder</span>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <a href={`/forms/${id}`} target="_blank" rel="noreferrer" className={styles.previewLink}>
                        Preview Form
                    </a>
                    {form.status === 0 && (
                        <Button onClick={handlePublish} className={styles.publishBtn}>
                            <CheckCircle size={18} style={{ marginRight: '0.5rem' }} />
                            Publish Form
                        </Button>
                    )}
                    {form.status === 1 && (
                        <span className={styles.publishedBadge}>Published</span>
                    )}
                </div>
            </header>

            <div className={styles.content}>
                {/* Fields List */}
                <div className={styles.previewArea}>
                    {fields.length === 0 ? (
                        <div className={styles.emptyState}>No fields added yet. Add one from the sidebar.</div>
                    ) : (
                        <div className={styles.fieldsList}>
                            {fields.map((field, index) => (
                                <Card key={field.id} className={styles.fieldCard}>
                                    <div className={styles.fieldHeader}>
                                        <span className={styles.fieldLabel}>
                                            {index + 1}. {field.label?.en || field.label}
                                            {field.required && <span className={styles.required}>*</span>}
                                        </span>
                                        <Button
                                            variant="danger"
                                            className={styles.deleteBtn}
                                            onClick={() => handleDeleteField(field.id)}
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                    <div className={styles.fieldPreview}>
                                        <Input disabled placeholder={`[${field.type}] User input...`} />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar Controls */}
                <aside className={styles.sidebar}>
                    <Card title="Add Field" className={styles.controlsCard}>
                        <form onSubmit={handleAddField} className={styles.addForm}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Label</label>
                                <Input
                                    value={newField.label}
                                    onChange={e => setNewField({ ...newField, label: e.target.value })}
                                    placeholder="Question text..."
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Type</label>
                                <select
                                    className={styles.select}
                                    value={newField.type}
                                    onChange={e => setNewField({ ...newField, type: e.target.value })}
                                >
                                    {FIELD_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            {['select', 'radio', 'checkbox'].includes(newField.type) && (
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Options (comma separated)</label>
                                    <Input
                                        value={newField.options}
                                        onChange={e => setNewField({ ...newField, options: e.target.value })}
                                        placeholder="Option 1, Option 2, Option 3"
                                    />
                                </div>
                            )}

                            <div className={styles.checkboxGroup}>
                                <input
                                    type="checkbox"
                                    id="required"
                                    checked={newField.required}
                                    onChange={e => setNewField({ ...newField, required: e.target.checked })}
                                />
                                <label htmlFor="required">Required Field</label>
                            </div>

                            <Button type="submit" disabled={addingField} className={styles.addBtn}>
                                <Plus size={18} style={{ marginRight: '0.5rem' }} />
                                Add Field
                            </Button>
                        </form>
                    </Card>
                </aside>
            </div>
        </div>
    );
};

export default FormBuilder;
