import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import HostNote from '../components/quiz/HostNote';
import { quizErrorMessage } from '../components/quiz/quizErrors';
import { quizPaths, type QuizMode } from '../components/quiz/quizMode';
import { fill } from '../components/quiz/quizText';
import { useQuizText } from '../components/quiz/useQuizText';
import { formatPin } from '../components/game/gameLogic';
import { useLanguageStore } from '../context/LanguageStore';
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
  Tabs,
} from '../components/ui';
import type { ChipTone } from '../components/ui';

interface QuizMeta {
  questions: number;
  seconds: number;
  /** A lobby or game that is open right now. */
  session?: QuizSession;
}

/** "today", "yesterday", "3 days ago", then a calendar date; in the reader's language. */
const relativeDate = (iso: string | undefined, lang: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 30) return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(-Math.max(days, 0), 'day');
  return d.toLocaleDateString(lang === 'en' ? undefined : lang, { day: 'numeric', month: 'short', year: 'numeric' });
};

const statusTone = (status: number): ChipTone => (status === QuizStatus.Active ? 'brand' : status === QuizStatus.Archived ? 'neutral' : 'warning');

interface Props {
  /** `admin`: the dashboard list. `public`: the visitor's own games, inside the public site. */
  mode?: QuizMode;
}

const QuizzesPage: React.FC<Props> = ({ mode = 'admin' }) => {
  const isPublic = mode === 'public';
  const text = useQuizText(mode);
  const L = text.list;
  const paths = quizPaths(mode);
  const storeLocale = useLanguageStore(s => s.locale);
  // The dashboard is English-only whatever the site language was set to.
  const lang = isPublic ? storeLocale : 'en';
  useDocumentTitle(L.metaTitle);
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [meta, setMeta] = useState<Record<string, QuizMeta>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  // Admin only: the admin's own games, or the ones visitors made on the public site.
  const [source, setSource] = useState<'own' | 'site'>('own');
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
    setMeta(prev => ({ ...prev, ...Object.fromEntries(entries) }));
  }, []);

  // Which quizzes already have their details loaded; cleared on every refetch.
  const metaLoaded = useRef<Set<string>>(new Set());

  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await client.get<Quiz[]>('/api/v1/quizzes');
      const list = Array.isArray(res.data) ? res.data : [];
      metaLoaded.current.clear();
      setQuizzes(list);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleArchive = async (id: string) => {
    setActionId(id);
    try {
      await client.patch(`/api/v1/quizzes/${id}/archive`);
      await fetchQuizzes();
      addToast('success', L.archivedToast);
    } catch (err) {
      addToast('error', quizErrorMessage(err, text, L.archiveFailed));
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
      addToast('success', L.deletedToast);
      setPendingDelete(null);
    } catch (err) {
      addToast('error', quizErrorMessage(err, text, L.deleteFailed));
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
      // The host is taken from the access token (or the browser's host key) server-side.
      const res = await client.post<QuizSession>(`/api/v1/quizzes/${quiz.id}/sessions`);
      navigate(`/host/lobby/${res.data.id}`);
    } catch (err) {
      const noQuestions = apiErrorStatus(err) === 400 && /no questions/i.test(apiErrorMessage(err, ''));
      addToast('error', noQuestions ? L.needQuestions : quizErrorMessage(err, text, L.startFailed));
      setActionId(null);
    }
  };

  // On the dashboard the admin's own games and the visitors' are listed apart:
  // the public site can hold up to 30 games per browser, and each card costs
  // two requests, so only the list being looked at is loaded.
  const siteCount = useMemo(() => quizzes.filter(q => q.by_visitor).length, [quizzes]);
  const shown = useMemo(
    () => (isPublic ? quizzes : quizzes.filter(q => Boolean(q.by_visitor) === (source === 'site'))),
    [isPublic, quizzes, source]
  );

  useEffect(() => {
    const missing = shown.filter(q => !metaLoaded.current.has(q.id));
    if (missing.length === 0) return;
    missing.forEach(q => metaLoaded.current.add(q.id));
    void loadMeta(missing);
  }, [shown, loadMeta]);

  const filtered = useMemo(
    () => shown.filter(q => localized(q.title, L.untitled).toLowerCase().includes(search.toLowerCase())),
    [shown, search, L.untitled]
  );

  const newGame = () => navigate(paths.builder());
  const durationUnits = { seconds: L.seconds, minutes: L.minutes };
  // The public site's main action is black (BTN_INK); the dashboard keeps its turquoise.
  const ink = isPublic ? '!bg-ink !text-white hover:!bg-[#13302f] focus-visible:ring-offset-bg' : '';
  const iconSize = isPublic ? 'min-h-11 min-w-11' : '';

  return (
    <div className="space-y-6">
      {isPublic ? (
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-primary">{L.kicker}</p>
            <h1 className="mt-1 text-[clamp(2rem,5vw,3.25rem)] text-balance">{L.title}</h1>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted text-pretty">{L.subtitle}</p>
          </div>
          <Button size="lg" className={`shrink-0 ${ink}`} onClick={newGame}>
            <Plus className="h-5 w-5" aria-hidden="true" /> {L.create}
          </Button>
        </header>
      ) : (
        <PageHeader
          title={L.title}
          description={L.subtitle}
          action={
            <Button onClick={newGame}>
              <Plus className="h-4 w-4" /> {L.create}
            </Button>
          }
        />
      )}

      {isPublic && <HostNote />}

      {!isPublic && siteCount > 0 && (
        <Tabs
          label="Whose games"
          value={source}
          onChange={setSource}
          items={[
            { id: 'own', label: 'Our games', count: quizzes.length - siteCount },
            { id: 'site', label: 'Made on the public site', count: siteCount },
          ]}
        />
      )}

      {quizzes.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="max-w-xs flex-1">
            <Input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={L.searchPlaceholder}
              aria-label={L.searchLabel}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <span className="text-xs text-muted" aria-live="polite">
            {L.gameCount(filtered.length)}
          </span>
        </div>
      )}

      {isLoading ? (
        <div role="status" aria-label={L.loading} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          <ErrorState title={L.loadErrorTitle} message={L.loadErrorBody} retryLabel={L.retry} onRetry={fetchQuizzes} />
        </Card>
      ) : shown.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-panel px-6 py-14 sm:px-12">
          <Pattern className="text-primary opacity-[0.06]" />
          <div className="relative mx-auto max-w-xl">
            <h2 className="font-display text-3xl font-extrabold">{L.emptyTitle}</h2>
            <p className="mt-2 text-muted">{L.emptyIntro}</p>
            <ol className="mt-6 space-y-4">
              {L.steps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-lg font-extrabold text-bg">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-display text-lg font-bold">{step.title}</span>
                    <span className="text-sm text-muted">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Button size="lg" className={`mt-8 ${ink}`} onClick={newGame}>
              <Plus className="h-5 w-5" aria-hidden="true" /> {L.createFirst}
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <p className="font-medium text-text">{fill(L.noMatch, { query: search })}</p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
            >
              {L.clearSearch}
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
            const updated = relativeDate(quiz.updated_at || quiz.created_at, lang);
            const name = localized(quiz.title, L.untitled);
            return (
              <li key={quiz.id}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 break-words font-display text-xl font-bold leading-tight">{name}</h2>
                    {isPublic ? (
                      <StatusChip tone={statusTone(quiz.status)}>
                        {quiz.status === QuizStatus.Active ? text.status.ready : quiz.status === QuizStatus.Archived ? text.status.archived : text.status.draft}
                      </StatusChip>
                    ) : (
                      <StatusDropdown type="quiz" id={quiz.id} initialStatus={quiz.status} onStatusChange={fetchQuizzes} />
                    )}
                  </div>
                  {description && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{description}</p>}

                  <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4" aria-hidden="true" />
                      {m ? L.questionCount(m.questions) : '…'}
                    </span>
                    {m && m.seconds > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" aria-hidden="true" /> {fill(L.upTo, { time: formatDuration(m.seconds, durationUnits) })}
                      </span>
                    )}
                    {updated && <span>{fill(L.edited, { when: updated })}</span>}
                  </p>

                  {open && (
                    <p className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusChip tone="live">{open.status === 'lobby' ? L.lobbyOpen : L.inProgress}</StatusChip>
                      <span className="font-display text-sm font-bold tabular-nums text-text">{fill(L.pin, { pin: formatPin(open.pin) })}</span>
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                    {quiz.status === QuizStatus.Archived ? (
                      <Button variant="secondary" className="min-w-[8rem] flex-1" onClick={() => navigate(paths.builder(quiz.id))}>
                        <Edit2 className="h-4 w-4" aria-hidden="true" /> {L.view}
                      </Button>
                    ) : open ? (
                      <Button className={`min-w-[8rem] flex-1 ${ink}`} onClick={() => navigate(open.status === 'lobby' ? `/host/lobby/${open.id}` : `/host/live/${open.id}`)}>
                        <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" /> {L.resume}
                      </Button>
                    ) : empty ? (
                      <Button className="min-w-[8rem] flex-1" variant="subtle" onClick={() => navigate(paths.builder(quiz.id))}>
                        <Plus className="h-4 w-4" aria-hidden="true" /> {L.addQuestions}
                      </Button>
                    ) : (
                      <Button className={`min-w-[8rem] flex-1 ${ink}`} loading={busy} onClick={() => handleStart(quiz)}>
                        {!busy && <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />} {L.hostNow}
                      </Button>
                    )}
                    <IconButton label={L.edit} tone="primary" className={iconSize} onClick={() => navigate(paths.builder(quiz.id))}>
                      <Edit2 className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={L.share} tone="primary" className={iconSize} onClick={() => setShareQuiz(quiz)}>
                      <Share2 className="h-4 w-4" />
                    </IconButton>
                    {!isPublic && quiz.status === QuizStatus.Active && (
                      <IconButton label={L.archive} tone="danger" disabled={busy} onClick={() => handleArchive(quiz.id)}>
                        <Archive className="h-4 w-4" />
                      </IconButton>
                    )}
                    <IconButton label={L.delete} tone="danger" className={iconSize} disabled={busy} onClick={() => setPendingDelete(quiz)}>
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
          title={fill(L.shareTitle, { title: localized(shareQuiz.title, L.untitled) })}
          description={L.shareHint}
          labels={{ link: L.shareLinkLabel, copy: L.copy, copied: L.copied, close: L.close }}
          onClose={() => setShareQuiz(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={L.deleteTitle}
          message={fill(L.deleteMessage, { title: localized(pendingDelete.title, L.untitled) })}
          confirmLabel={L.deleteConfirm}
          cancelLabel={L.cancel}
          closeLabel={L.close}
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
