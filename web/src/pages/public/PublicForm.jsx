import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { CheckCircle, Check, Clock } from 'lucide-react';
import styles from './PublicForm.module.css';

const PublicForm = () => {
    const { id } = useParams();
    const [form, setForm] = useState(null);
    const [fields, setFields] = useState([]);
    const [answers, setAnswers] = useState({});
    const [respondent, setRespondent] = useState({ name: '', email: '' });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const fetchFormDetails = useCallback(async () => {
        try {
            const [formRes, fieldsRes] = await Promise.all([
                api.get(`/forms/${id}`),
                api.get(`/forms/${id}/fields`)
            ]);
            setForm(formRes.data);
            // Sort fields by field_order
            const sortedFields = (fieldsRes.data || []).sort((a, b) => a.field_order - b.field_order);
            setFields(sortedFields);
            setError('');
        } catch (err) {
            setError('Form not found.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchFormDetails();
    }, [fetchFormDetails]);

    // Auto-refresh every 10 seconds when the form is not published
    useEffect(() => {
        if (!form || form.status === 1 || submitted) return;

        const interval = setInterval(() => {
            fetchFormDetails();
        }, 10000);

        return () => clearInterval(interval);
    }, [form, submitted, fetchFormDetails]);

    const handleAnswerChange = (fieldId, value) => {
        setAnswers(prev => ({ ...prev, [fieldId]: value }));
    };

    const renderField = (field) => {
        const label = field.label?.en || 'Untitled Question';
        const placeholder = field.placeholder?.en || '';
        const helpText = field.help_text?.en || '';

        // Common props
        const commonProps = {
            required: field.required,
            className: styles.fieldInput
        };

        switch (field.type.toLowerCase()) {
            case 'text':
            case 'email':
            case 'number':
            case 'date':
                return (
                    <Input
                        label={label}
                        type={field.type.toLowerCase()}
                        placeholder={placeholder}
                        value={answers[field.id] || ''}
                        onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                        {...commonProps}
                    />
                );
            case 'textarea':
                return (
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>
                            {label} {field.required && <span className={styles.required}>*</span>}
                        </label>
                        <textarea
                            className={styles.textarea}
                            placeholder={placeholder}
                            value={answers[field.id] || ''}
                            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                            required={field.required}
                        />
                        {helpText && <span className={styles.helpText}>{helpText}</span>}
                    </div>
                );
            case 'select':
                return (
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>
                            {label} {field.required && <span className={styles.required}>*</span>}
                        </label>
                        <select
                            className={styles.select}
                            value={answers[field.id] || ''}
                            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                            required={field.required}
                        >
                            <option value="">Select an option</option>
                            {Object.entries(field.options || {}).map(([key, val]) => (
                                <option key={key} value={key}>{val}</option>
                            ))}
                        </select>
                    </div>
                );
            case 'radio':
                return (
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>
                            {label} {field.required && <span className={styles.required}>*</span>}
                        </label>
                        {helpText && <span className={styles.helpText}>{helpText}</span>}
                        <div className={styles.optionsList}>
                            {Object.entries(field.options || {}).map(([key, val]) => (
                                <label key={key} className={styles.optionLabel}>
                                    <input
                                        type="radio"
                                        name={field.id}
                                        value={key}
                                        checked={answers[field.id] === key}
                                        onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                                        required={field.required}
                                    />
                                    <span className={styles.radioIndicator} />
                                    <span className={styles.optionText}>{val}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                );
            case 'checkbox':
                return (
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>
                            {label} {field.required && <span className={styles.required}>*</span>}
                        </label>
                        {helpText && <span className={styles.helpText}>{helpText}</span>}
                        <div className={styles.optionsList}>
                            {Object.entries(field.options || {}).map(([key, val]) => {
                                const currentVals = answers[field.id] || [];
                                const isChecked = currentVals.includes(key);
                                return (
                                    <label key={key} className={styles.optionLabel}>
                                        <input
                                            type="checkbox"
                                            name={field.id}
                                            value={key}
                                            checked={isChecked}
                                            onChange={(e) => {
                                                const newVals = e.target.checked
                                                    ? [...currentVals, key]
                                                    : currentVals.filter(v => v !== key);
                                                handleAnswerChange(field.id, newVals);
                                            }}
                                        />
                                        <span className={styles.checkboxIndicator}>
                                            <Check size={14} strokeWidth={3} />
                                        </span>
                                        <span className={styles.optionText}>{val}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                );
            default:
                return (
                    <Input
                        label={label}
                        placeholder="Field type not fully supported yet"
                        disabled
                    />
                );
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const payload = {
            form_id: id,
            respondent: respondent,
            answers: fields.map(field => {
                const val = answers[field.id];
                // Value structure depends on field type. For simplest MVP, wrapping text in object
                // The backend expects `value: map[string]any`.
                // Common convention: {"text": "val"} or {"selected": "val"}
                let valueObj = {};
                if (field.type.toLowerCase() === 'select' || field.type.toLowerCase() === 'radio') {
                    valueObj = { selected: val };
                } else if (field.type.toLowerCase() === 'checkbox') {
                    // Checkbox likely creates an array of selected keys
                    valueObj = { selected: val }; // val is []string
                } else {
                    valueObj = { text: val };
                }

                return {
                    field_id: field.id,
                    field_type: field.type, // Send exact casing? Backend might need enum match
                    value: valueObj
                };
            }).filter(a => a.value) // Filter empty? No, keep structure but maybe validate
        };

        try {
            await api.post('/responses/', payload);
            setSubmitted(true);
        } catch (err) {
            const msg = err?.response?.data?.error || 'Failed to submit response. Please try again.';
            alert(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className={styles.loading}>Loading form...</div>;
    if (error) return <div className={styles.error}>{error}</div>;

    // Show waiting screen if form is not published
    if (form && form.status !== 1) {
        return (
            <div className={styles.centerContainer}>
                <Card className={styles.waitingCard}>
                    <div className={styles.waitingIcon}>
                        <Clock size={56} />
                    </div>
                    <h2 className={styles.waitingTitle}>Form Not Available Yet</h2>
                    <p className={styles.waitingMessage}>
                        <strong>{form.title}</strong> is currently not accepting responses.
                    </p>
                    <p className={styles.waitingSubtext}>
                        Please wait — this page will automatically refresh when the form becomes available.
                    </p>
                    <div className={styles.waitingSpinner}>
                        <div className={styles.spinnerDot} />
                        <div className={styles.spinnerDot} />
                        <div className={styles.spinnerDot} />
                    </div>
                </Card>
            </div>
        );
    }

    if (submitted) return (
        <div className={styles.centerContainer}>
            <Card className={styles.successCard}>
                <div className={styles.successIcon}>
                    <CheckCircle size={64} />
                </div>
                <h2 className={styles.successTitle}>Thank You!</h2>
                <p className={styles.successMessage}>
                    Your response has been submitted successfully.
                </p>
                <p className={styles.successSubtext}>
                    We appreciate you taking the time to fill out this form.
                </p>
                <div className={styles.successActions}>
                    <Button onClick={() => window.location.reload()} variant="secondary">
                        Submit Another Response
                    </Button>
                </div>
            </Card>
        </div>
    );

    return (
        <div className={styles.container}>
            <Card className={styles.formCard}>
                <header className={styles.formHeader}>
                    <h1 className={styles.title}>{form.title}</h1>
                    <p className={styles.desc}>{form.description}</p>
                </header>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Respondent Info (Optional/Required based on logic, adding for demo) */}
                    <div className={styles.section}>
                        <h3>Your Information</h3>
                        <Input
                            label="Name"
                            value={respondent.name}
                            onChange={e => setRespondent({ ...respondent, name: e.target.value })}
                        />
                        <Input
                            label="Email"
                            type="email"
                            value={respondent.email}
                            onChange={e => setRespondent({ ...respondent, email: e.target.value })}
                        />
                    </div>

                    <div className={styles.section}>
                        {fields.map(field => (
                            <div key={field.id} className={styles.fieldWrapper}>
                                {renderField(field)}
                            </div>
                        ))}
                    </div>

                    <div className={styles.footer}>
                        <Button type="submit" disabled={submitting} className={styles.submitBtn}>
                            {submitting ? 'Submitting...' : 'Submit'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default PublicForm;
