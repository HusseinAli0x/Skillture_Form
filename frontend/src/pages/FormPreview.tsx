import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { CheckCircle } from 'lucide-react';

interface Field {
  id: string;
  type: string;
  label: { en?: string; ar?: string; value?: string };
  is_required: boolean;
  options?: Record<string, { value?: string; en?: string; ar?: string }>;
}

const FormPreview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    client.get(`/api/v1/forms/${id}`)
      .then(res => setForm(res.data))
      .catch(() => setError('Form not found'));

    client.get(`/api/v1/forms/${id}/fields`)
      .then(res => setFields(res.data || []))
      .catch(() => setError('Failed to load fields'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleChange = (fieldId: string, val: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});
    setIsSubmitting(true);
    
    // Validation Logic
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (field.is_required) {
        const val = formData[field.id];
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          errors[field.id] = 'This field is required';
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please fill in all required fields correctly.');
      setIsSubmitting(false);
      return;
    }
    
    try {
      const answers: Record<string, any> = {};
      Object.keys(formData).forEach(k => {
        answers[k] = { en: formData[k] }; // storing as simple json string value
      });
      
      // Auto-detect respondent info
      let respondentName = "";
      let respondentEmail = "";
      
      fields.forEach(f => {
        const lbl = (f.label?.en || '').toLowerCase();
        if (lbl.includes('name') || lbl.includes('اسم')) {
          if (!respondentName && formData[f.id]) respondentName = formData[f.id];
        }
        if (lbl.includes('email') || lbl.includes('بريد')) {
          if (!respondentEmail && formData[f.id]) respondentEmail = formData[f.id];
        }
      });
      
      let respondentData: Record<string, any> = { en: "Anonymous" };
      if (respondentName || respondentEmail) {
        respondentData = { 
          name: respondentName || respondentEmail, 
          email: respondentEmail 
        };
      }

      await client.post('/api/v1/responses', {
        form_id: id,
        respondent: respondentData,
        answers
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#0ABFBC] border-t-transparent rounded-full animate-spin"></div></div>;
  
  if (submitted) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Thank You!</h2>
        <p className="text-slate-400">Your response has been submitted successfully.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 font-sans text-slate-200">
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-t-xl border-t-[6px] border-t-[#0ABFBC] p-8 mb-4 shadow-xl">
          <h1 className="text-3xl font-bold text-white mb-2">{form?.title?.en || 'Form'}</h1>
          {form?.description?.en && <p className="text-slate-400">{form.description.en}</p>}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(field => {
            const labelStr = field.label?.en || field.label?.value || 'Question';
            return (
              <div key={field.id} className={`bg-[#141414] border ${validationErrors[field.id] ? 'border-red-500/50 bg-red-500/5' : 'border-[#2a2a2a]'} rounded-xl p-6 shadow-md transition-all hover:border-[#3a3a3a]`}>
                <label className="block text-sm font-medium text-slate-200 mb-3 flex items-center justify-between">
                  <span>
                    {labelStr}
                    {field.is_required && <span className="text-red-400 ml-1">*</span>}
                  </span>
                  {validationErrors[field.id] && (
                    <span className="text-red-400 text-xs flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {validationErrors[field.id]}
                    </span>
                  )}
                </label>
                
                {field.type === 'textarea' ? (
                  <textarea
                    required={field.is_required}
                    onChange={e => handleChange(field.id, e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-slate-200 outline-none focus:border-[#0ABFBC] resize-y min-h-[100px]"
                    placeholder="Your answer"
                  />
                ) : field.type === 'select' ? (
                  <select
                    required={field.is_required}
                    onChange={e => handleChange(field.id, e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-slate-200 outline-none focus:border-[#0ABFBC]"
                  >
                    <option value="">Choose...</option>
                    {field.options && Object.entries(field.options).map(([k, opt]) => (
                      <option key={k} value={k}>{opt.en || opt.value || k}</option>
                    ))}
                  </select>
                ) : field.type === 'radio' ? (
                  <div className="space-y-2">
                    {field.options && Object.entries(field.options).map(([k, opt]) => (
                      <label key={k} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name={field.id}
                          value={k}
                          required={field.is_required}
                          onChange={e => handleChange(field.id, e.target.value)}
                          className="w-4 h-4 text-[#0ABFBC] bg-[#0a0a0a] border-[#2a2a2a] focus:ring-[#0ABFBC] focus:ring-offset-[#0a0a0a]"
                        />
                        <span className="text-sm">{opt.en || opt.value || k}</span>
                      </label>
                    ))}
                  </div>
                ) : field.type === 'checkbox' ? (
                  <div className="space-y-2">
                    {field.options && Object.entries(field.options).map(([k, opt]) => (
                      <label key={k} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          value={k}
                          onChange={e => {
                            const current = formData[field.id] || [];
                            const updated = e.target.checked ? [...current, k] : current.filter((x: string) => x !== k);
                            handleChange(field.id, updated);
                          }}
                          className="w-4 h-4 text-[#0ABFBC] bg-[#0a0a0a] border-[#2a2a2a] rounded focus:ring-[#0ABFBC] focus:ring-offset-[#0a0a0a]"
                        />
                        <span className="text-sm">{opt.en || opt.value || k}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                    required={field.is_required}
                    onChange={e => handleChange(field.id, e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-slate-200 outline-none focus:border-[#0ABFBC]"
                    placeholder="Your answer"
                  />
                )}
              </div>
            );
          })}
          
          <div className="pt-4 flex justify-between items-center">
            <p className="text-xs text-slate-500">Never submit passwords through forms.</p>
            <button
              type="submit"
              disabled={isSubmitting || fields.length === 0}
              className="px-6 py-2.5 rounded-lg bg-[#0ABFBC] text-black font-semibold hover:bg-[#09a8a5] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormPreview;
