import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { AlertCircle } from 'lucide-react';
import client from '../api/client';
import { apiErrorMessage } from '../lib/apiError';
import { FieldType, FormStatus } from '../api/types';
import type { Form, FormField } from '../api/types';
import { localized } from '../lib/i18n';
import { Button, Card, Spinner } from '../components/ui';
import { Frieze, Logo, Pattern } from '../components/brand';
import { useDocumentTitle } from '../lib/useDocumentTitle';
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

  useDocumentTitle(form ? localized(form.title, 'Form') : 'Form');

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

  const required = fields.filter(f => f.required).length;
  const answeredRequired = fields.filter(f => f.required && !isBlank(formData[f.id])).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg p-4">
        <Pattern className="text-white opacity-[0.04]" />
        <Card className="relative w-full max-w-md p-8 text-center shadow-2xl">
          <Logo variant="icon" decorative className="mx-auto mb-4 h-12 text-primary" />
          <h1 className="mb-2 text-3xl font-bold text-text">Thank you</h1>
          <p className="text-muted">Your response has been submitted. You can close this page.</p>
          <Frieze className="mt-6 text-border-strong" />
          <button
            type="button"
            onClick={() => {
              setFormData({});
              setSubmitted(false);
            }}
            className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
          >
            Submit another response
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg px-4 py-8 font-sans text-text sm:py-12">
      <Pattern className="text-white opacity-[0.035]" />
      <div className="relative mx-auto max-w-2xl">
        <div className="mb-5 flex items-center gap-3">
          <Logo variant="icon" decorative className="h-8 text-primary" />
          <span className="font-display text-lg font-bold tracking-wide">Skillture</span>
        </div>
        <Card className="mb-4 rounded-t-xl border-t-[6px] border-t-primary p-6 shadow-xl sm:p-8">
          <h1 className="mb-2 text-3xl font-bold text-text">{localized(form?.title, 'Form')}</h1>
          {form?.description && <p className="text-muted">{localized(form.description)}</p>}
          {required > 0 && (
            <p className="mt-4 text-xs text-muted">
              <span className="text-danger">*</span> marks a required question. {answeredRequired} of {required} answered.
            </p>
          )}
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
                    {field.required && <span className="ms-1 text-danger" aria-hidden="true">*</span>}
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

          <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-4 sm:backdrop-blur-none">
            <p className="text-xs text-muted">Never submit passwords through forms.</p>
            <Button type="submit" size="lg" loading={isSubmitting} disabled={fields.length === 0 || !isAcceptingResponses}>
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormPreview;
