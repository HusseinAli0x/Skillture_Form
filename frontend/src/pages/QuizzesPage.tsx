import React, { useEffect, useState } from 'react';
import { Plus, Search, GamepadIcon, Trash2, Play, Archive, Zap, Edit2, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { apiErrorMessage } from '../lib/apiError';
import { QuizStatus } from '../api/types';
import type { Quiz } from '../api/types';
import { localized } from '../lib/i18n';
import StatusDropdown from '../components/StatusDropdown';
import ShareModal from '../components/ShareModal';
import { useToastStore } from '../context/ToastStore';
import { quizShareUrl } from '../lib/links';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  LoadingState,
  PageHeader,
} from '../components/ui';

const QuizzesPage: React.FC = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Quiz | null>(null);
  const [shareQuiz, setShareQuiz] = useState<Quiz | null>(null);
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const res = await client.get<Quiz[]>('/api/v1/quizzes');
      setQuizzes(res.data || []);
    } catch {
      setQuizzes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (id: string) => {
    setActionId(id);
    try {
      await client.patch(`/api/v1/quizzes/${id}/activate`);
      await fetchQuizzes();
      addToast('success', 'Quiz activated successfully');
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to activate'));
    } finally {
      setActionId(null);
    }
  };

  const handleArchive = async (id: string) => {
    setActionId(id);
    try {
      await client.patch(`/api/v1/quizzes/${id}/archive`);
      await fetchQuizzes();
      addToast('success', 'Quiz archived successfully');
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
      addToast('success', 'Quiz deleted successfully');
      setPendingDelete(null);
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to delete'));
    } finally {
      setActionId(null);
    }
  };

  const handleHost = async (quiz: Quiz) => {
    try {
      // The host is taken from the access token server-side; sending a
      // host_id here would be ignored.
      const res = await client.post(`/api/v1/quizzes/${quiz.id}/sessions`);
      addToast('success', 'Session hosted successfully');
      navigate(`/host/lobby/${res.data.id}`);
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Failed to host session'));
    }
  };

  const filtered = quizzes.filter(q =>
    localized(q.title, 'Untitled').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quiz Games"
        description="Manage and host your real-time quiz games."
        action={
          <Button onClick={() => navigate('/admin/builder')}>
            <Plus className="w-4 h-4" /> New Quiz
          </Button>
        }
      />

      <Card>
        <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
          <div className="flex-1 max-w-xs">
            <Input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search quizzes..."
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <span className="text-xs text-muted">
            {filtered.length} quiz{filtered.length !== 1 ? 'zes' : ''}
          </span>
        </div>

        {isLoading ? (
          <LoadingState message="Loading quizzes..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<GamepadIcon className="w-7 h-7" />}
            title={search ? 'No quizzes match' : 'No quizzes yet'}
            description={search ? 'Try a different search' : 'Create your first quiz to get started.'}
            action={
              !search && (
                <Button variant="subtle" onClick={() => navigate('/admin/builder')}>
                  <Plus className="w-4 h-4" /> Create Quiz
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-hover-overlay">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Quiz</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted hidden sm:table-cell">
                    Created
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((quiz, i) => {
                  const description = localized(quiz.description);
                  return (
                    <tr
                      key={quiz.id}
                      className={`group transition-colors hover:bg-hover-overlay ${
                        i < filtered.length - 1 ? 'border-b border-border' : ''
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-subtle border border-primary-border-soft text-primary">
                            <GamepadIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text">{localized(quiz.title, 'Untitled')}</p>
                            {description && (
                              <p className="text-xs mt-0.5 truncate max-w-xs text-muted">{description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusDropdown
                          type="quiz"
                          id={quiz.id}
                          initialStatus={quiz.status}
                          fullObject={quiz}
                          onStatusChange={fetchQuizzes}
                        />
                      </td>
                      <td className="px-5 py-4 text-sm text-muted hidden sm:table-cell">
                        {quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <IconButton
                            label="Edit quiz"
                            tone="primary"
                            onClick={() => navigate(`/admin/builder/${quiz.id}`)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </IconButton>
                          <IconButton label="Share quiz" tone="primary" onClick={() => setShareQuiz(quiz)}>
                            <Share2 className="w-4 h-4" />
                          </IconButton>

                          {quiz.status === QuizStatus.Draft && (
                            <IconButton
                              label="Activate quiz"
                              tone="primary"
                              disabled={actionId === quiz.id}
                              onClick={() => handleActivate(quiz.id)}
                            >
                              <Zap className="w-4 h-4" />
                            </IconButton>
                          )}

                          {quiz.status === QuizStatus.Active && (
                            <>
                              <IconButton label="Host session" tone="primary" onClick={() => handleHost(quiz)}>
                                <Play className="w-4 h-4" />
                              </IconButton>
                              <IconButton
                                label="Archive quiz"
                                tone="danger"
                                disabled={actionId === quiz.id}
                                onClick={() => handleArchive(quiz.id)}
                              >
                                <Archive className="w-4 h-4" />
                              </IconButton>
                            </>
                          )}

                          <IconButton
                            label="Delete quiz"
                            tone="danger"
                            disabled={actionId === quiz.id}
                            onClick={() => setPendingDelete(quiz)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
