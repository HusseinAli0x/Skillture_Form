import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { AlertCircle, CheckCircle } from 'lucide-react';
import client from '../api/client';
import { apiErrorMessage } from '../lib/apiError';
import { FieldType, FormStatus } from '../api/types';
import type { Form, FormField } from '../api/types';
import { localized } from '../lib/i18n';
import { Button, Card, Spinner } from '../components/ui';
import FieldInput from '../components/forms/FieldInput';

const isBlank = (value: unknown) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

// Matches the backend's sanity check in response_usecase.go — permissive by
// design, not a full RFC 5322 validator.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Best-effort respondent identity, taken from a field labelled name or email. */
const findRespondent = (fields: FormField[], data: Record<string, unknown>) => {
  let name = '';
  let email = '';
  for (const field of fields) {
    const label = localized(field.label).toLowerCase();
    const value = data[field.id];
    if (typeof value !== 'string' || !value) continue;
    if (!name && (label.includes('name') || label.includes('اسم'))) name = value;
    if (!email && (label.includes('email') || label.includes('بريد'))) email = value;
  }
  if (!name && !email) return { en: 'Anonymous' };
  return { name: name || email, email };
};

const FormPreview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // A draft or closed form is not open for responses. The backend rejects the
  // submission, but without this the page renders as a live form and only
  // surfaces the problem after the respondent has filled it in.
  const isAcceptingResponses = form != null && form.status === FormStatus.Published;

  useEffect(() => {
    client
      .get<Form>(`/api/v1/forms/${id}`)
      .then(res => setForm(res.data))
      .catch(() => setError('Form not found'));

    client
      .get<FormField[]>(`/api/v1/forms/${id}/fields`)
      .then(res => setFields(res.data || []))
      .catch(() => setError('Failed to load fields'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleChange = (fieldId: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    // Clear the inline error as soon as the respondent acts on the field.
    setValidationErrors(prev => {
      if (!prev[fieldId]) return prev;
      const { [fieldId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Required fields are enforced here rather than with the native `required`
    // attribute: the browser blocks submit and shows its own tooltip, which
    // means the inline messages below would never appear, and native required
    // does not cover a checkbox group where any one box satisfies it.
    const errors: Record<string, string> = {};
    for (const field of fields) {
      const value = formData[field.id];
      if (field.required && isBlank(value)) {
        errors[field.id] = 'This field is required';
      } else if (field.type === FieldType.Email && !isBlank(value) && !EMAIL_RE.test(String(value))) {
        errors[field.id] = 'Enter a valid email address';
      }
    }
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const answers: Record<string, { en: unknown }> = {};
      for (const [fieldId, value] of Object.entries(formData)) {
        answers[fieldId] = { en: value };
      }

      await client.post('/api/v1/responses', {
        form_id: id,
        respondent: findRespondent(fields, formData),
        answers,
      });
      setSubmitted(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to submit form'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center shadow-2xl">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-text mb-2">Thank You!</h2>
          <p className="text-muted">Your response has been submitted successfully.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-12 px-4 font-sans text-text">
      <div className="max-w-2xl mx-auto">
        <Card className="rounded-t-xl border-t-[6px] border-t-primary p-8 mb-4 shadow-xl">
          <h1 className="text-3xl font-bold text-text mb-2">{localized(form?.title, 'Form')}</h1>
          {form?.description && <p className="text-muted">{localized(form.description)}</p>}
        </Card>

        {error && (
          <div role="alert" className="bg-danger-soft border border-danger-border text-danger px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {form && !isAcceptingResponses && (
          <div role="status" className="bg-warning-soft border border-warning-border text-warning px-4 py-3 rounded-lg mb-6">
            {form.status === FormStatus.Closed
              ? 'This form is closed and is no longer accepting responses.'
              : 'This form is still a draft and is not yet accepting responses.'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {fields.map(field => {
            const fieldError = validationErrors[field.id];
            return (
              <Card
                key={field.id}
                className={`p-6 shadow-md transition-colors ${
                  fieldError ? 'border-danger-border bg-danger-soft' : 'hover:border-border-strong'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-text">
                    {localized(field.label, 'Question')}
                    {field.required && <span className="text-danger ml-1">*</span>}
                  </span>
                  {fieldError && (
                    <span
                      id={`${field.id}-error`}
                      className="text-danger text-xs flex items-center gap-1 bg-danger-soft px-2 py-1 rounded"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {fieldError}
                    </span>
                  )}
                </div>

                <FieldInput
                  field={field}
                  value={formData[field.id]}
                  invalid={!!fieldError}
                  onChange={value => handleChange(field.id, value)}
                />
              </Card>
            );
          })}

          <div className="pt-4 flex justify-between items-center">
            <p className="text-xs text-muted">Never submit passwords through forms.</p>
            <Button type="submit" loading={isSubmitting} disabled={fields.length === 0 || !isAcceptingResponses}>
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormPreview;
