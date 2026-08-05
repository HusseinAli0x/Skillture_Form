import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import { QuizStatus } from '../api/types';
import type { Quiz } from '../api/types';
import { localized, toLocalized } from '../lib/i18n';
import { useToastStore } from '../context/ToastStore';
import StatusDropdown from '../components/StatusDropdown';
import QuestionEditor from '../components/quiz/QuestionEditor';
import {
  emptyQuestion,
  trueFalseOptions,
  type OptionState,
  type QuestionState,
} from '../components/quiz/questionState';
import { Button, Card, IconButton, Input, Label, Textarea } from '../components/ui';

/**
 * The correct answer is stored as `correct_answer: {value: "<option text>"}`,
 * so on load it is matched back to an option by text.
 */
const readOptions = (raw: unknown): OptionState[] => {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw as Record<string, { value?: string; en?: string }>).map(([id, opt]) => ({
    id,
    value: opt?.value || opt?.en || '',
  }));
};

const FormQuizBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const { addToast } = useToastStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionState[]>([emptyQuestion()]);
  const [status, setStatus] = useState<QuizStatus>(QuizStatus.Draft);
  const [fullObject, setFullObject] = useState<Quiz | null>(null);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const loadQuiz = useCallback(async () => {
    if (!isEditMode) return;
    try {
      const [qRes, qqRes] = await Promise.all([
        client.get(`/api/v1/quizzes/${id}`),
        client.get(`/api/v1/quizzes/${id}/questions`),
      ]);

      setTitle(localized(qRes.data.title));
      setDescription(localized(qRes.data.description));
      setStatus((qRes.data.status ?? QuizStatus.Draft) as QuizStatus);
      setFullObject(qRes.data);

      const fetched: QuestionState[] = (qqRes.data || [])
        .slice()
        .sort((a: any, b: any) => a.position - b.position)
        .map((q: any) => {
          const answer = q.correct_answer?.value || q.correct_answer?.en || '';
          const options = readOptions(q.options);

          return {
            id: q.id,
            question: localized(q.question),
            type: q.type,
            options: options.length > 0 ? options : trueFalseOptions(),
            correctOptionId:
              q.type === 'short' ? answer : (options.find(o => o.value === answer)?.id ?? ''),
            timeLimit: q.time_limit_sec || 15,
            points: q.points || 1000,
            isNew: false,
          };
        });

      if (fetched.length > 0) setQuestions(fetched);
    } catch {
      addToast('error', 'Failed to load quiz.');
    }
  }, [id, isEditMode, addToast]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const addQuestion = () => setQuestions(prev => [...prev, emptyQuestion()]);

  const removeQuestion = (questionId: string) => {
    const question = questions.find(q => q.id === questionId);
    if (question && !question.isNew) setDeletedQuestionIds(prev => [...prev, questionId]);
    setQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= questions.length) return;
    const next = [...questions];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setQuestions(next);
  };

  const updateQuestion = (questionId: string, patch: Partial<QuestionState>) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== questionId) return q;
        const updated = { ...q, ...patch };
        // A type change invalidates whatever answers the old type carried.
        if (patch.type && patch.type !== q.type) {
          updated.options = patch.type === 'tf' ? trueFalseOptions() : patch.type === 'short' ? [] : q.options;
          updated.correctOptionId = '';
        }
        return updated;
      })
    );
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Quiz title is required.';
    for (const q of questions) {
      if (!q.question.trim()) return 'All questions must have text.';
      if (q.type === 'short' && !q.correctOptionId.trim()) {
        return `"${q.question}" needs an expected answer.`;
      }
      if (q.type !== 'short' && !q.correctOptionId) {
        return `Select the correct answer for "${q.question}".`;
      }
      if (q.type === 'mcq' && q.options.some(o => !o.value.trim())) {
        return `"${q.question}" has an empty option.`;
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
      let quizId = id;

      const quizPayload = {
        title: toLocalized(title),
        description: toLocalized(description),
      };

      if (isEditMode) {
        await client.put(`/api/v1/quizzes/${id}`, quizPayload);
      } else {
        const quizRes = await client.post('/api/v1/quizzes', quizPayload);
        quizId = quizRes.data.id;
      }

      for (const delId of deletedQuestionIds) {
        await client.delete(`/api/v1/quizzes/${quizId}/questions/${delId}`);
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];

        const correctValue =
          q.type === 'short'
            ? q.correctOptionId
            : (q.options.find(o => o.id === q.correctOptionId)?.value ?? '');

        // The option id doubles as the map key so the correct answer survives a
        // reload — see readOptions above.
        const optionsMap: Record<string, { value: string }> = {};
        if (q.type !== 'short') {
          q.options.forEach(opt => {
            optionsMap[opt.id] = { value: opt.value };
          });
        }

        const payload = {
          question: toLocalized(q.question),
          type: q.type,
          position: i + 1,
          time_limit_sec: q.timeLimit,
          points: q.points,
          options: optionsMap,
          correct_answer: { value: correctValue },
        };

        if (q.isNew) {
          await client.post(`/api/v1/quizzes/${quizId}/questions`, payload);
        } else {
          await client.put(`/api/v1/quizzes/${quizId}/questions/${q.id}`, payload);
        }
      }

      addToast('success', `Quiz ${isEditMode ? 'updated' : 'created'} successfully!`);
      navigate('/admin/quizzes');
    } catch (err: any) {
      addToast('error', err.response?.data?.error || 'Failed to save quiz.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-4">
        <IconButton
          label="Back to quizzes"
          onClick={() => navigate('/admin/quizzes')}
          className="border border-border hover:border-border-strong !p-2"
        >
          <ArrowLeft className="w-4 h-4" />
        </IconButton>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-text">{isEditMode ? 'Edit Quiz' : 'New Quiz'}</h1>
          <p className="text-sm mt-0.5 text-muted">
            {isEditMode
              ? 'Update your quiz details and questions.'
              : 'Design your quiz, add questions, and set answers.'}
          </p>
        </div>
        <Button onClick={handleSave} loading={isSaving}>
          {!isSaving && <Save className="w-4 h-4" />}
          {isSaving ? 'Saving…' : 'Save Quiz'}
        </Button>
      </div>

      {error && (
        <div role="alert" className="px-4 py-3 rounded-lg text-sm border bg-danger-soft border-danger-border text-danger">
          {error}
        </div>
      )}

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Quiz Settings</h2>
          {isEditMode && fullObject && (
            <StatusDropdown
              type="quiz"
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
            placeholder="e.g. Intro to Golang"
            className="!py-2.5 font-medium"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="A short description of this quiz..."
            className="!py-2.5 resize-none"
          />
        </div>
      </Card>

      <div className="space-y-4">
        {questions.map((question, idx) => (
          <QuestionEditor
            key={question.id}
            question={question}
            index={idx}
            total={questions.length}
            onChange={patch => updateQuestion(question.id, patch)}
            onRemove={() => removeQuestion(question.id)}
            onMove={direction => moveQuestion(idx, direction)}
          />
        ))}
      </div>

      <button
        onClick={addQuestion}
        className="w-full py-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border-2 border-dashed border-border text-muted transition-colors hover:border-primary hover:text-primary hover:bg-primary-subtle"
      >
        <Plus className="w-5 h-5" /> Add Next Question
      </button>
    </div>
  );
};

export default FormQuizBuilder;
