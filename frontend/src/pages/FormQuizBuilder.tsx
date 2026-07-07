import React, { useState } from 'react';
import { Plus, Trash2, Save, ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import type { QuizQuestionType } from '../api/types';

interface OptionState {
  id: string;
  value: string;
}

interface QuestionState {
  id: string;
  question: string;
  type: QuizQuestionType;
  options: OptionState[];
  correctOptionId: string;
  timeLimit: number;
  points: number;
  isNew?: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const FormQuizBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionState[]>([
    {
      id: generateId(), question: '', type: 'mcq',
      options: [{ id: generateId(), value: 'Option A' }, { id: generateId(), value: 'Option B' }],
      correctOptionId: '', timeLimit: 15, points: 1000, isNew: true
    }
  ]);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!isEditMode) return;
    Promise.all([
      client.get(`/api/v1/quizzes/${id}`),
      client.get(`/api/v1/quizzes/${id}/questions`)
    ]).then(([qRes, qqRes]) => {
      setTitle(qRes.data.title?.en || '');
      setDescription(qRes.data.description?.en || '');
      const fetchedQs = (qqRes.data || []).sort((a: any, b: any) => a.position - b.position).map((q: any) => {
        let opts: OptionState[] = [];
        let correctId = '';
        if (q.type === 'short') {
          correctId = q.correct_answer?.value || q.correct_answer?.en || '';
        } else {
          if (q.options) {
            Object.keys(q.options).forEach(k => {
              opts.push({ id: k, value: q.options[k].value || q.options[k].en || '' });
            });
            // Try to match correct option
            const ansValue = q.correct_answer?.value || q.correct_answer?.en || '';
            const found = opts.find(o => o.value === ansValue);
            if (found) correctId = found.id;
          }
        }
        return {
          id: q.id,
          question: q.question?.en || '',
          type: q.type,
          options: opts.length > 0 ? opts : [{ id: generateId(), value: 'True' }, { id: generateId(), value: 'False' }],
          correctOptionId: correctId,
          timeLimit: q.time_limit_sec || 15,
          points: q.points || 1000,
          isNew: false
        };
      });
      if (fetchedQs.length > 0) setQuestions(fetchedQs);
    }).catch(_err => {
      setError('Failed to load quiz.');
    });
  }, [id, isEditMode]);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: generateId(),
        question: '',
        type: 'mcq',
        options: [
          { id: generateId(), value: 'Option A' },
          { id: generateId(), value: 'Option B' }
        ],
        correctOptionId: '',
        timeLimit: 15,
        points: 1000,
        isNew: true
      }
    ]);
  };

  const handleRemoveQuestion = (qId: string) => {
    const q = questions.find(q => q.id === qId);
    if (q && !q.isNew) {
      setDeletedQuestionIds(prev => [...prev, qId]);
    }
    setQuestions(questions.filter(q => q.id !== qId));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === questions.length - 1)) return;
    const newQs = [...questions];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newQs[index], newQs[swapIndex]] = [newQs[swapIndex], newQs[index]];
    setQuestions(newQs);
  };

  const handleUpdateQuestion = (id: string, field: keyof QuestionState, value: any) => {
    setQuestions(questions.map(q => {
      if (q.id === id) {
        const updated = { ...q, [field]: value };
        // Reset options/correct option if type changes
        if (field === 'type') {
          if (value === 'tf') {
            updated.options = [
              { id: generateId(), value: 'True' },
              { id: generateId(), value: 'False' }
            ];
            updated.correctOptionId = '';
          } else if (value === 'short') {
            updated.options = [];
            updated.correctOptionId = '';
          }
        }
        return updated;
      }
      return q;
    }));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Quiz title is required');
      return;
    }
    
    // Validate questions
    for (const q of questions) {
      if (!q.question.trim()) {
        setError('All questions must have a title');
        return;
      }
      if (q.type !== 'short' && !q.correctOptionId) {
        setError(`Please select a correct answer for: "${q.question}"`);
        return;
      }
    }

    setError('');
    setIsSaving(true);

    try {
      let quizId = id;

      // 1. Create or Update Quiz
      if (isEditMode) {
        await client.put(`/api/v1/quizzes/${id}`, {
          title: { en: title },
          description: { en: description }
        });
      } else {
        const quizRes = await client.post('/api/v1/quizzes', {
          title: { en: title },
          description: { en: description }
        });
        quizId = quizRes.data.id;
      }

      // 2. Process Deletions
      for (const delId of deletedQuestionIds) {
        await client.delete(`/api/v1/quizzes/${quizId}/questions/${delId}`);
      }

      // 3. Add or Update Questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        let correctValue = '';
        if (q.type === 'short') {
          correctValue = q.correctOptionId; 
        } else {
          correctValue = q.options.find(o => o.id === q.correctOptionId)?.value || '';
        }

        const optionsMap: Record<string, any> = {};
        q.options.forEach((opt) => {
          // Use a stable key so we can track the correct answer
          optionsMap[opt.id] = { value: opt.value };
        });

        const payload = {
          question: { en: q.question },
          type: q.type,
          position: i + 1,
          time_limit_sec: q.timeLimit,
          points: q.points,
          options: q.type !== 'short' ? optionsMap : {},
          correct_answer: { value: correctValue }
        };

        if (q.isNew) {
          await client.post(`/api/v1/quizzes/${quizId}/questions`, payload);
        } else {
          await client.put(`/api/v1/quizzes/${quizId}/questions/${q.id}`, payload);
        }
      }

      navigate('/quizzes');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save quiz');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/quizzes')}
          className="p-2 rounded-lg transition-colors flex-shrink-0"
          style={{ color: '#888', border: '1px solid #2a2a2a' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#3a3a3a'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f0f0f0' }}>{isEditMode ? 'Edit Quiz' : 'New Quiz'}</h1>
          <p className="text-sm mt-0.5" style={{ color: '#888' }}>{isEditMode ? 'Update your quiz details and questions.' : 'Design your quiz, add questions, and set answers.'}</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0 disabled:opacity-50"
          style={{ backgroundColor: '#0ABFBC', color: '#0a0a0a' }}
          onMouseEnter={e => !isSaving && (e.currentTarget.style.backgroundColor = '#09a8a5')}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0ABFBC'}
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Quiz'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm border" style={{ backgroundColor: 'rgba(224,85,85,0.08)', borderColor: 'rgba(224,85,85,0.25)', color: '#e05555' }}>
          {error}
        </div>
      )}

      {/* Quiz Metadata */}
      <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
        <h2 className="text-sm font-semibold" style={{ color: '#f0f0f0' }}>Quiz Details</h2>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Quiz Title <span style={{ color: '#0ABFBC' }}>*</span></label>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all font-medium"
            style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
            onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
            onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
            placeholder="E.g., Intro to Golang"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Description</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
            style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
            onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
            onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
            placeholder="A short description of this quiz..."
          />
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((q, index) => (
          <div key={q.id} className="rounded-xl border overflow-hidden transition-all" style={{ backgroundColor: '#141414', borderColor: '#2a2a2a' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#2a2a2a', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-md">
                  <button 
                    onClick={() => moveQuestion(index, 'up')}
                    disabled={index === 0}
                    className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button 
                    onClick={() => moveQuestion(index, 'down')}
                    disabled={index === questions.length - 1}
                    className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
                <span className="text-sm font-medium" style={{ color: '#888' }}>Question {index + 1}</span>
              </div>
              <button 
                onClick={() => handleRemoveQuestion(q.id)}
                disabled={questions.length === 1}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                style={{ color: '#888' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#e05555'; e.currentTarget.style.backgroundColor = 'rgba(224,85,85,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Question Text</label>
                  <input 
                    type="text" 
                    value={q.question}
                    onChange={(e) => handleUpdateQuestion(q.id, 'question', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                    style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                    onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                    placeholder="Enter your question..."
                  />
                </div>
                <div className="w-44">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Type</label>
                  <select
                    value={q.type}
                    onChange={(e) => handleUpdateQuestion(q.id, 'type', e.target.value as QuizQuestionType)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none cursor-pointer"
                    style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="tf">True / False</option>
                    <option value="short">Short Answer</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-32">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Time (sec)</label>
                  <input 
                    type="number" 
                    value={q.timeLimit}
                    onChange={(e) => handleUpdateQuestion(q.id, 'timeLimit', parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                    style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                    onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>Points</label>
                  <input 
                    type="number" 
                    value={q.points}
                    onChange={(e) => handleUpdateQuestion(q.id, 'points', parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                    style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                    onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                  />
                </div>
              </div>

              {/* Options & Correct Answer logic based on Type */}
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: '#2a2a2a' }}>
                <label className="block text-xs font-medium mb-3" style={{ color: '#888' }}>Answers <span style={{ color: '#0ABFBC' }}>*</span></label>
                
                {q.type === 'mcq' && (
                  <div className="space-y-3">
                    {q.options.map((opt, optIdx) => (
                      <div key={opt.id} className="flex items-center gap-3">
                        <div 
                          onClick={() => handleUpdateQuestion(q.id, 'correctOptionId', opt.id)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors`}
                          style={{ 
                            borderColor: q.correctOptionId === opt.id ? '#0ABFBC' : '#2a2a2a',
                            backgroundColor: q.correctOptionId === opt.id ? 'rgba(10,191,188,0.2)' : 'transparent'
                          }}
                        >
                          {q.correctOptionId === opt.id && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0ABFBC' }} />}
                        </div>
                        <input 
                          type="text" 
                          value={opt.value}
                          onChange={(e) => {
                            const newOpts = [...q.options];
                            newOpts[optIdx].value = e.target.value;
                            handleUpdateQuestion(q.id, 'options', newOpts);
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none transition-all"
                          style={{ 
                            backgroundColor: '#0a0a0a', 
                            border: `1px solid ${q.correctOptionId === opt.id ? '#0ABFBC' : '#2a2a2a'}`, 
                            color: q.correctOptionId === opt.id ? '#0ABFBC' : '#f0f0f0' 
                          }}
                          onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                          onBlur={e => e.currentTarget.style.borderColor = q.correctOptionId === opt.id ? '#0ABFBC' : '#2a2a2a'}
                          placeholder={`Option ${optIdx + 1}`}
                        />
                        {q.options.length > 2 && (
                          <button 
                            onClick={() => {
                              const newOpts = q.options.filter(o => o.id !== opt.id);
                              handleUpdateQuestion(q.id, 'options', newOpts);
                              if (q.correctOptionId === opt.id) handleUpdateQuestion(q.id, 'correctOptionId', '');
                            }}
                            style={{ color: '#888' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#e05555'}
                            onMouseLeave={e => e.currentTarget.style.color = '#888'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {q.options.length < 5 && (
                      <button 
                        onClick={() => {
                          const newOpts = [...q.options, { id: generateId(), value: `Option ${q.options.length + 1}` }];
                          handleUpdateQuestion(q.id, 'options', newOpts);
                        }}
                        className="mt-2 flex items-center gap-1.5 text-xs font-medium transition-colors"
                        style={{ color: '#0ABFBC' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >
                        <Plus className="w-4 h-4" /> Add Option
                      </button>
                    )}
                  </div>
                )}

                {q.type === 'tf' && (
                  <div className="flex gap-4">
                    {q.options.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => handleUpdateQuestion(q.id, 'correctOptionId', opt.id)}
                        className="flex-1 py-3 rounded-lg border text-sm font-medium transition-all"
                        style={{ 
                          borderColor: q.correctOptionId === opt.id ? '#0ABFBC' : '#2a2a2a',
                          backgroundColor: q.correctOptionId === opt.id ? 'rgba(10,191,188,0.1)' : 'transparent',
                          color: q.correctOptionId === opt.id ? '#0ABFBC' : '#888'
                        }}
                      >
                        {opt.value}
                      </button>
                    ))}
                  </div>
                )}

                {q.type === 'short' && (
                  <div>
                      <input 
                      type="text" 
                      value={q.correctOptionId} 
                      onChange={(e) => handleUpdateQuestion(q.id, 'correctOptionId', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                      style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
                      onFocus={e => e.currentTarget.style.borderColor = '#0ABFBC'}
                      onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                      placeholder="Type the exact correct answer here..."
                    />
                    <p className="text-xs mt-2" style={{ color: '#888' }}>Answers must match exactly (case-insensitive).</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={handleAddQuestion}
        className="w-full py-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all duration-150"
        style={{ border: '2px dashed #2a2a2a', color: '#888' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#0ABFBC'; e.currentTarget.style.color = '#0ABFBC'; e.currentTarget.style.backgroundColor = 'rgba(10,191,188,0.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <Plus className="w-5 h-5" />
        Add Next Question
      </button>

    </div>
  );
};

export default FormQuizBuilder;
