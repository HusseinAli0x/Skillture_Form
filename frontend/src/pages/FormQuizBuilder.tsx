import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Play, Plus, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import client from '../api/client';
import { apiErrorMessage } from '../lib/apiError';
import { QuizStatus } from '../api/types';
import type { Quiz, QuizQuestion } from '../api/types';
import { localized, toLocalized } from '../lib/i18n';
import { useToastStore } from '../context/ToastStore';
import StatusDropdown from '../components/StatusDropdown';
import QuestionEditor from '../components/quiz/QuestionEditor';
import {
  duplicateQuestion,
  emptyQuestion,
  formatDuration,
  quizSnapshot,
  readQuestion,
  serializeQuestion,
  summarizeQuiz,
  trueFalseOptions,
  validateQuestion,
  type QuestionState,
} from '../components/quiz/questionState';
import { Button, Card, ConfirmDialog, IconButton, Input, Label, LoadingState, Textarea } from '../components/ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const FormQuizBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const { addToast } = useToastStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionState[]>(() => [emptyQuestion()]);
  const [status, setStatus] = useState<QuizStatus>(QuizStatus.Draft);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  /** Snapshot of what is on the server; the page is "unsaved" whenever the form differs from it. */
  const [baseline, setBaseline] = useState<string | null>(null);

  useDocumentTitle(isEditMode ? 'Edit quiz' : 'New quiz');

  const applyLoaded = useCallback((quiz: Quiz, list: QuizQuestion[]) => {
    const t = localized(quiz.title);
    const d = localized(quiz.description);
    const qs = list
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(readQuestion);
    const next = qs.length > 0 ? qs : [emptyQuestion()];
    setTitle(t);
    setDescription(d);
    setStatus((quiz.status ?? QuizStatus.Draft) as QuizStatus);
    setQuestions(next);
    setBaseline(quizSnapshot(t, d, next));
  }, []);

  const loadQuiz = useCallback(
    async (quizId: string) => {
      try {
        const [qRes, qqRes] = await Promise.all([
          client.get<Quiz>(`/api/v1/quizzes/${quizId}`),
          client.get<QuizQuestion[]>(`/api/v1/quizzes/${quizId}/questions`),
        ]);
        applyLoaded(qRes.data, qqRes.data || []);
        return true;
      } catch {
        addToast('error', 'Failed to load quiz.');
        return false;
      }
    },
    [applyLoaded, addToast]
  );

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    loadQuiz(id).finally(() => setIsLoading(false));
  }, [id, loadQuiz]);

  const snapshot = useMemo(() => quizSnapshot(title, description, questions), [title, description, questions]);
  // A quiz that was never saved is only "unsaved" once the author has typed something.
  const dirty =
    baseline === null
      ? title !== '' || description !== '' || questions.length > 1 || questions.some(q => q.question !== '')
      : snapshot !== baseline;

  // The browser's own prompt, for closing the tab or reloading with edits pending.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const issues = useMemo(() => questions.map(q => validateQuestion(q)), [questions]);
  const titleMissing = !title.trim();
  const problemCount = issues.reduce((n, list) => n + list.length, 0) + (titleMissing ? 1 : 0);
  const summary = useMemo(() => summarizeQuiz(questions), [questions]);

  const addQuestion = useCallback(() => {
    const q = emptyQuestion();
    setQuestions(prev => [...prev, q]);
    setFocusId(q.id);
  }, []);

  // Removal needs no bookkeeping: the save sends the complete desired list,
  // and the server deletes whatever is missing from it.
  const removeQuestion = (questionId: string) => setQuestions(prev => prev.filter(q => q.id !== questionId));

  const duplicate = (index: number) => {
    const copy = duplicateQuestion(questions[index]);
    setQuestions(prev => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]);
    setFocusId(copy.id);
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
          updated.options = patch.type === 'tf' ? trueFalseOptions() : patch.type === 'short' ? [] : emptyQuestion().options;
          updated.correctOptionId = '';
        }
        return updated;
      })
    );
  };

  // Bring a question that was just added into view.
  useEffect(() => {
    if (!focusId) return;
    document.querySelector(`[data-question-id="${focusId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusId]);

  const jumpTo = (questionId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-question-id="${questionId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
  };

  /** Validates, writes the quiz and its questions, and reloads so every row carries its server id. */
  const save = useCallback(async (): Promise<string | null> => {
    if (problemCount > 0) {
      setShowIssues(true);
      const firstBad = issues.findIndex(list => list.length > 0);
      if (titleMissing) document.getElementById('quiz-title')?.focus();
      else if (firstBad >= 0) jumpTo(questions[firstBad].id);
      addToast('error', 'Fix the highlighted items, then save again.');
      return null;
    }

    setIsSaving(true);
    try {
      let quizId = id;
      const quizPayload = { title: toLocalized(title.trim()), description: toLocalized(description) };

      if (isEditMode) {
        await client.put(`/api/v1/quizzes/${id}`, quizPayload);
      } else {
        const quizRes = await client.post('/api/v1/quizzes', quizPayload);
        quizId = quizRes.data.id;
      }

      // One transactional replace, not a request per question plus one per
      // deletion. The old loop had no rollback: a failure part-way through
      // left the quiz half-written, with the deletions already applied.
      await client.put(`/api/v1/quizzes/${quizId}/questions`, { questions: questions.map(serializeQuestion) });

      await loadQuiz(quizId as string);
      setShowIssues(false);
      addToast('success', isEditMode ? 'Quiz saved.' : 'Quiz created.');
      if (!isEditMode) navigate(`/admin/builder/${quizId}`, { replace: true });
      return quizId as string;
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to save quiz. Your edits are still here.'));
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [problemCount, issues, titleMissing, questions, id, isEditMode, title, description, loadQuiz, navigate, addToast]);

  /** Save (if needed), activate a draft, open a lobby and go to it. */
  const startGame = async () => {
    setIsStarting(true);
    try {
      let quizId = id;
      if (dirty || !isEditMode) {
        quizId = (await save()) ?? undefined;
        if (!quizId) return;
      }
      if (status !== QuizStatus.Active) {
        await client.patch(`/api/v1/quizzes/${quizId}/activate`);
        setStatus(QuizStatus.Active);
      }
      const res = await client.post(`/api/v1/quizzes/${quizId}/sessions`);
      navigate(`/host/lobby/${res.data.id}`);
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Could not start a game.'));
    } finally {
      setIsStarting(false);
    }
  };

  // Ctrl/Cmd+S saves; Ctrl/Cmd+Enter adds a question.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        addQuestion();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addQuestion]);

  const goBack = () => (dirty ? setConfirmLeave(true) : navigate('/admin/quizzes'));

  if (isLoading) return <LoadingState message="Loading quiz…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-border bg-bg px-4 py-3 sm:mx-0 sm:px-4">
        <IconButton label="Back to quizzes" onClick={goBack} className="border border-border !p-2 hover:border-border-strong">
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight text-text">{title.trim() || (isEditMode ? 'Edit Quiz' : 'New Quiz')}</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted" role="status" aria-live="polite">
            {dirty ? (
              <>
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" />
                <span className="text-warning">Unsaved changes</span>
              </>
            ) : baseline !== null ? (
              <>
                <Check className="h-3 w-3 text-primary" aria-hidden="true" /> All changes saved
              </>
            ) : (
              'Not saved yet'
            )}
          </p>
        </div>
        {isEditMode && (
          <Button variant="secondary" onClick={startGame} loading={isStarting} disabled={isSaving}>
            {!isStarting && <Play className="h-4 w-4" aria-hidden="true" />} Start game
          </Button>
        )}
        <Button onClick={() => save()} loading={isSaving} disabled={isStarting} aria-keyshortcuts="Control+S Meta+S">
          {!isSaving && <Save className="h-4 w-4" aria-hidden="true" />}
          {isSaving ? 'Saving…' : 'Save Quiz'}
        </Button>
      </div>

      {showIssues && problemCount > 0 && (
        <div role="alert" className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
          <p className="font-semibold">
            {problemCount} {problemCount === 1 ? 'thing needs' : 'things need'} fixing before this can be saved:
          </p>
          <ul className="mt-1 list-inside list-disc">
            {titleMissing && <li>Give the quiz a title.</li>}
            {questions.map((q, i) =>
              issues[i].length > 0 ? (
                <li key={q.id}>
                  <button type="button" onClick={() => jumpTo(q.id)} className="underline underline-offset-2">
                    Question {i + 1}
                  </button>
                  : {issues[i].map(x => x.message).join(' ')}
                </li>
              ) : null
            )}
          </ul>
        </div>
      )}

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Quiz Settings</h2>
          {isEditMode && <StatusDropdown type="quiz" id={id!} initialStatus={status} onStatusChange={setStatus} />}
        </div>

        <div>
          <Label htmlFor="quiz-title" required>
            Title
          </Label>
          <Input
            id="quiz-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Intro to Golang"
            invalid={showIssues && titleMissing}
            autoFocus={!isEditMode}
            className="!py-2.5 font-display !text-lg font-semibold"
          />
          {showIssues && titleMissing && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
              Give the quiz a title players will recognise.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="quiz-description">Description</Label>
          <Textarea
            id="quiz-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="A short description of this quiz..."
            className="resize-none !py-2.5"
          />
        </div>
      </Card>

      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold">Questions</h2>
        <p className="text-sm text-muted">
          {summary.count} {summary.count === 1 ? 'question' : 'questions'} · {summary.points.toLocaleString()} pts · up to{' '}
          {formatDuration(summary.seconds)}
        </p>
      </div>

      <div className="space-y-4">
        {questions.map((question, idx) => (
          <QuestionEditor
            key={question.id}
            question={question}
            index={idx}
            total={questions.length}
            issues={showIssues ? issues[idx] : []}
            autoFocus={question.id === focusId}
            onChange={patch => updateQuestion(question.id, patch)}
            onRemove={() => removeQuestion(question.id)}
            onMove={direction => moveQuestion(idx, direction)}
            onDuplicate={() => duplicate(idx)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted transition-colors hover:border-primary hover:bg-primary-subtle hover:text-primary"
      >
        <Plus className="h-5 w-5" aria-hidden="true" /> Add Next Question
        <kbd className="ms-1 hidden rounded border border-border-strong px-1.5 py-0.5 font-sans text-xs sm:inline">Ctrl + Enter</kbd>
      </button>

      {confirmLeave && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have changes that have not been saved. They will be lost."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          destructive
          onConfirm={() => navigate('/admin/quizzes')}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </div>
  );
};

export default FormQuizBuilder;
