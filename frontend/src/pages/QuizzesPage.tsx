import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Clock, Edit2, HelpCircle, Play, Plus, Search, Share2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import client from '../api/client';
import { apiErrorMessage, apiErrorStatus } from '../lib/apiError';
import { QuizStatus } from '../api/types';
import type { Quiz, QuizQuestion, QuizSession } from '../api/types';
import { localized } from '../lib/i18n';
import StatusDropdown from '../components/StatusDropdown';
import ShareModal from '../components/ShareModal';
import { useToastStore } from '../context/ToastStore';
import { quizShareUrl } from '../lib/links';
import { Pattern } from '../components/brand';
import { formatDuration } from '../components/quiz/questionState';
import { formatPin } from '../components/game/gameLogic';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  IconButton,
  Input,
  PageHeader,
  Skeleton,
  StatusChip,
} from '../components/ui';

interface QuizMeta {
  questions: number;
  seconds: number;
  /** A lobby or game that is open right now. */
  session?: QuizSession;
}

const relativeDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const QuizzesPage: React.FC = () => {
  useDocumentTitle('Quiz games');
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [meta, setMeta] = useState<Record<string, QuizMeta>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Quiz | null>(null);
  const [shareQuiz, setShareQuiz] = useState<Quiz | null>(null);
  const { addToast } = useToastStore();

  /** Question count, running time and any open session per quiz. Failures just leave a card without them. */
  const loadMeta = useCallback(async (list: Quiz[]) => {
    const entries = await Promise.all(
      list.map(async (q): Promise<[string, QuizMeta]> => {
        const [qs, session] = await Promise.all([
          client.get<QuizQuestion[]>(`/api/v1/quizzes/${q.id}/questions`).catch(() => null),
          q.status === QuizStatus.Active
            ? client
                .get<QuizSession>(`/api/v1/quizzes/${q.id}/active-session`)
                .then(r => r.data)
                .catch(() => undefined)
            : Promise.resolve(undefined),
        ]);
        const rows = qs?.data ?? [];
        return [q.id, { questions: rows.length, seconds: rows.reduce((n, r) => n + (r.time_limit_sec || 0), 0), session }];
      })
    );
    setMeta(Object.fromEntries(entries));
  }, []);

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await client.get<Quiz[]>('/api/v1/quizzes');
      const list = res.data || [];
      setQuizzes(list);
      setLoadFailed(false);
      void loadMeta(list);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [loadMeta]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleArchive = async (id: string) => {
    setActionId(id);
    try {
      await client.patch(`/api/v1/quizzes/${id}/archive`);
      await fetchQuizzes();
      addToast('success', 'Quiz archived');
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to archive'));
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setActionId(id);
    try {
      await client.delete(`/api/v1/quizzes/${id}`);
      setQuizzes(prev => prev.filter(q => q.id !== id));
      addToast('success', 'Quiz deleted');
      setPendingDelete(null);
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to delete'));
    } finally {
      setActionId(null);
    }
  };

  /** One click from a card to a lobby: activate a draft first, then open the session. */
  const handleStart = async (quiz: Quiz) => {
    setActionId(quiz.id);
    try {
      if (quiz.status === QuizStatus.Draft) {
        await client.patch(`/api/v1/quizzes/${quiz.id}/activate`);
      }
      // The host is taken from the access token server-side.
      const res = await client.post<QuizSession>(`/api/v1/quizzes/${quiz.id}/sessions`);
      navigate(`/host/lobby/${res.data.id}`);
    } catch (err) {
      const message = apiErrorMessage(err, 'Failed to start a game');
      addToast('error', apiErrorStatus(err) === 400 && /no questions/i.test(message) ? 'Add at least one question first.' : message);
      setActionId(null);
    }
  };

  const filtered = useMemo(
    () => quizzes.filter(q => localized(q.title, 'Untitled').toLowerCase().includes(search.toLowerCase())),
    [quizzes, search]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quiz Games"
        description="Write a quiz, press Start, and the room plays on their phones."
        action={
          <Button onClick={() => navigate('/admin/builder')}>
            <Plus className="h-4 w-4" /> New Quiz
          </Button>
        }
      />

      {quizzes.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="max-w-xs flex-1">
            <Input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search quizzes..."
              aria-label="Search quizzes"
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <span className="text-xs text-muted">
            {filtered.length} quiz{filtered.length !== 1 ? 'zes' : ''}
          </span>
        </div>
      )}

      {isLoading ? (
        <div role="status" aria-label="Loading quizzes" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(i => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="mt-4 h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : loadFailed ? (
        <Card>
          <ErrorState title="Could not load your quizzes" onRetry={fetchQuizzes} />
        </Card>
      ) : quizzes.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-panel px-6 py-14 sm:px-12">
          <Pattern className="text-primary opacity-[0.06]" />
          <div className="relative mx-auto max-w-xl">
            <h2 className="font-display text-3xl font-extrabold">Make your first live quiz</h2>
            <p className="mt-2 text-muted">It takes about two minutes. Here is how a game runs:</p>
            <ol className="mt-6 space-y-4">
              {[
                ['Write questions', 'Multiple choice, true / false or a typed answer, each with its own timer.'],
                ['Press Start game', 'A PIN and QR code fill the big screen. Players join from their phones.'],
                ['Run it with Space', 'Answers, votes and a moving leaderboard play out live. Space moves to the next step.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-lg font-extrabold text-ink">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-display text-lg font-bold">{t}</span>
                    <span className="text-sm text-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Button size="lg" className="mt-8" onClick={() => navigate('/admin/builder')}>
              <Plus className="h-5 w-5" /> Create your first quiz
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <p className="font-medium text-text">No quizzes match "{search}"</p>
            <button type="button" onClick={() => setSearch('')} className="mt-2 text-sm text-primary underline-offset-4 hover:underline">
              Clear the search
            </button>
          </div>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(quiz => {
            const m = meta[quiz.id];
            const description = localized(quiz.description);
            const busy = actionId === quiz.id;
            const open = m?.session;
            const empty = m !== undefined && m.questions === 0;
            const updated = relativeDate(quiz.updated_at || quiz.created_at);
            return (
              <li key={quiz.id}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 font-display text-xl font-bold leading-tight">{localized(quiz.title, 'Untitled')}</h2>
                    <StatusDropdown type="quiz" id={quiz.id} initialStatus={quiz.status} onStatusChange={fetchQuizzes} />
                  </div>
                  {description && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{description}</p>}

                  <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4" aria-hidden="true" />
                      {m ? `${m.questions} ${m.questions === 1 ? 'question' : 'questions'}` : '…'}
                    </span>
                    {m && m.seconds > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" aria-hidden="true" /> up to {formatDuration(m.seconds)}
                      </span>
                    )}
                    {updated && <span>Edited {updated}</span>}
                  </p>

                  {open && (
                    <p className="mt-3 flex items-center gap-2">
                      <StatusChip tone="live">{open.status === 'lobby' ? 'Lobby open' : 'Game in progress'}</StatusChip>
                      <span className="font-display text-sm font-bold tabular-nums text-text">PIN {formatPin(open.pin)}</span>
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-2 pt-5">
                    {quiz.status === QuizStatus.Archived ? (
                      <Button variant="secondary" className="flex-1" onClick={() => navigate(`/admin/builder/${quiz.id}`)}>
                        <Edit2 className="h-4 w-4" /> View
                      </Button>
                    ) : open ? (
                      <Button className="flex-1" onClick={() => navigate(open.status === 'lobby' ? `/host/lobby/${open.id}` : `/host/live/${open.id}`)}>
                        <Play className="h-4 w-4" fill="currentColor" /> Resume game
                      </Button>
                    ) : empty ? (
                      <Button className="flex-1" variant="subtle" onClick={() => navigate(`/admin/builder/${quiz.id}`)}>
                        <Plus className="h-4 w-4" /> Add questions
                      </Button>
                    ) : (
                      <Button className="flex-1" loading={busy} onClick={() => handleStart(quiz)}>
                        {!busy && <Play className="h-4 w-4" fill="currentColor" />} Start game
                      </Button>
                    )}
                    <IconButton label="Edit quiz" tone="primary" onClick={() => navigate(`/admin/builder/${quiz.id}`)}>
                      <Edit2 className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Share quiz" tone="primary" onClick={() => setShareQuiz(quiz)}>
                      <Share2 className="h-4 w-4" />
                    </IconButton>
                    {quiz.status === QuizStatus.Active && (
                      <IconButton label="Archive quiz" tone="danger" disabled={busy} onClick={() => handleArchive(quiz.id)}>
                        <Archive className="h-4 w-4" />
                      </IconButton>
                    )}
                    <IconButton label="Delete quiz" tone="danger" disabled={busy} onClick={() => setPendingDelete(quiz)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {shareQuiz && (
        <ShareModal
          url={quizShareUrl(shareQuiz.id)}
          title={`Share "${localized(shareQuiz.title, 'Untitled')}"`}
          description="Players scan this to join the next live session."
          onClose={() => setShareQuiz(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete quiz"
          message={`"${localized(pendingDelete.title, 'Untitled')}" and all of its questions and past sessions will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          loading={actionId === pendingDelete.id}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

export default QuizzesPage;
