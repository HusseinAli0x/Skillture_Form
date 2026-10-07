import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Calendar, FileText, GamepadIcon, Inbox, Mail, Plus, Radio, ArrowRight } from 'lucide-react';
import { FormStatus, QuizStatus } from '../api/types';
import { localized } from '../lib/i18n';
import { timeAgo } from '../lib/relativeTime';
import { formShareUrl, quizShareUrl } from '../lib/links';
import { useMessagesStore } from '../context/MessagesStore';
import ShareModal from '../components/ShareModal';
import StatCard from '../components/dashboard/StatCard';
import GeminiPanel from '../components/dashboard/GeminiPanel';
import RecentPanel from '../components/dashboard/RecentPanel';
import { useDashboardData } from '../components/dashboard/useDashboardData';
import { Pattern } from '../components/brand';
import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  PageHeader,
  SkeletonRows,
  StatusChip,
} from '../components/ui';

const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { state, forms, quizzes, workshops, recent, live, activityLoading, reload } = useDashboardData();
  const unread = useMessagesStore(s => s.unread);
  const totalMessages = useMessagesStore(s => s.total);
  const [share, setShare] = useState<{ url: string; title: string } | null>(null);

  const loading = state === 'loading';
  // status is an int16 from the API, not a string.
  const activeQuizzes = quizzes.filter(q => q.status === QuizStatus.Active).length;
  const publishedForms = forms.filter(f => f.status === FormStatus.Published).length;
  const isBrandNew = state === 'ready' && forms.length === 0 && quizzes.length === 0;

  const header = (
    <PageHeader
      title="Overview"
      description={`${today}. What needs you next.`}
      action={
        <>
          <Button onClick={() => navigate('/admin/quizzes')}>
            <GamepadIcon className="w-4 h-4" /> Host a quiz
          </Button>
          <Button variant="secondary" onClick={() => navigate('/admin/forms/new')}>
            <Plus className="w-4 h-4" /> New form
          </Button>
          <Button variant="secondary" onClick={() => navigate('/admin/workshops')}>
            <Calendar className="w-4 h-4" /> Add workshop
          </Button>
        </>
      }
    />
  );

  if (state === 'error') {
    return (
      <div className="space-y-8">
        {header}
        <Card>
          <ErrorState
            title="Could not load your overview"
            message="The server did not answer. Your data is safe; try again in a moment."
            onRetry={reload}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Forms"
          value={forms.length}
          hint={`${publishedForms} published`}
          loading={loading}
          onClick={() => navigate('/admin/forms')}
        />
        <StatCard
          icon={<GamepadIcon className="w-5 h-5" />}
          label="Quizzes"
          value={quizzes.length}
          hint={`${activeQuizzes} active`}
          loading={loading}
          onClick={() => navigate('/admin/quizzes')}
        />
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          label="Workshops"
          value={workshops ?? '–'}
          hint={workshops === null ? 'Not available' : 'Upcoming, public'}
          loading={loading || (workshops === null && activityLoading)}
          onClick={() => navigate('/admin/workshops')}
        />
        <StatCard
          icon={<Mail className="w-5 h-5" />}
          label="Messages"
          value={totalMessages ?? '–'}
          hint={totalMessages === null ? 'Not available' : unread > 0 ? `${unread} new since your last visit` : 'Nothing new'}
          loading={loading}
          onClick={() => navigate('/admin/messages')}
        />
      </div>

      {isBrandNew ? (
        <StartHere onForm={() => navigate('/admin/forms/new')} onQuiz={() => navigate('/admin/builder')} onWorkshop={() => navigate('/admin/workshops')} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader title="Recent responses" />
              {activityLoading || loading ? (
                <SkeletonRows rows={4} label="Loading recent responses" />
              ) : recent.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Inbox className="w-6 h-6 mx-auto mb-3 text-muted" aria-hidden="true" />
                  <p className="text-sm text-text font-medium">No responses yet</p>
                  <p className="mt-1 text-sm text-muted">Publish a form and share its link; answers show up here.</p>
                </div>
              ) : (
                <ul>
                  {recent.map((r, i) => (
                    <li key={r.id} className={i < recent.length - 1 ? 'border-b border-border' : ''}>
                      <Link
                        to={`/admin/forms/${r.formId}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-hover-overlay focus:outline-none focus-visible:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      >
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary-subtle border border-primary-border-soft text-primary">
                          <FileText className="w-4 h-4" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-text truncate">{r.respondent}</span>
                          <span className="block text-xs text-muted truncate">{r.formTitle}</span>
                        </span>
                        <time dateTime={r.submittedAt} className="text-xs text-muted shrink-0">
                          {timeAgo(r.submittedAt)}
                        </time>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Live sessions" />
              {activityLoading || loading ? (
                <SkeletonRows rows={2} label="Checking live sessions" />
              ) : live.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Radio className="w-6 h-6 mx-auto mb-3 text-muted" aria-hidden="true" />
                  <p className="text-sm text-text font-medium">Nothing live right now</p>
                  <p className="mt-1 mb-4 text-sm text-muted">Start a session and players join with a PIN.</p>
                  <Button variant="subtle" size="sm" onClick={() => navigate('/admin/quizzes')}>
                    Host a quiz
                  </Button>
                </div>
              ) : (
                <ul>
                  {live.map((s, i) => (
                    <li key={s.id} className={i < live.length - 1 ? 'border-b border-border' : ''}>
                      <Link
                        to={s.status === 'lobby' ? `/host/lobby/${s.id}` : `/host/live/${s.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-hover-overlay focus:outline-none focus-visible:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-text truncate">{s.quizTitle}</span>
                          <span className="block text-xs text-muted">
                            PIN <span className="font-display tabular-nums text-text">{s.pin}</span>
                          </span>
                        </span>
                        <StatusChip tone="live">{s.status === 'lobby' ? 'In lobby' : 'Live'}</StatusChip>
                        <ArrowRight className="w-4 h-4 text-muted shrink-0 rtl:rotate-180" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentPanel
              heading="Recent forms"
              type="form"
              icon={<FileText className="w-4 h-4" />}
              isLoading={loading}
              emptyLabel="No forms yet"
              createLabel="Create first form"
              items={forms.map(f => ({
                id: f.id,
                title: localized(f.title, 'Untitled form'),
                status: f.status,
                raw: f,
              }))}
              onViewAll={() => navigate('/admin/forms')}
              onCreate={() => navigate('/admin/forms/new')}
              onOpen={id => navigate(`/admin/forms/${id}`)}
              onEdit={id => navigate(`/admin/forms/${id}/edit`)}
              onShare={id => {
                const form = forms.find(f => f.id === id);
                setShare({ url: formShareUrl(id), title: `Share "${localized(form?.title, 'Untitled form')}"` });
              }}
            />

            <RecentPanel
              heading="Recent quizzes"
              type="quiz"
              icon={<GamepadIcon className="w-4 h-4" />}
              isLoading={loading}
              emptyLabel="No quizzes yet"
              createLabel="Create first quiz"
              items={quizzes.map(q => ({
                id: q.id,
                title: localized(q.title, 'Untitled quiz'),
                status: q.status,
                raw: q,
              }))}
              onViewAll={() => navigate('/admin/quizzes')}
              onCreate={() => navigate('/admin/builder')}
              onOpen={id => navigate(`/admin/builder/${id}`)}
              onEdit={id => navigate(`/admin/builder/${id}`)}
              onShare={id => {
                const quiz = quizzes.find(q => q.id === id);
                setShare({ url: quizShareUrl(id), title: `Share "${localized(quiz?.title, 'Untitled quiz')}"` });
              }}
            />
          </div>
        </>
      )}

      <GeminiPanel />

      {share && <ShareModal url={share.url} title={share.title} onClose={() => setShare(null)} />}
    </div>
  );
};

interface StartHereProps {
  onForm: () => void;
  onQuiz: () => void;
  onWorkshop: () => void;
}

/** First-run panel for an account with no forms and no quizzes. */
const StartHere: React.FC<StartHereProps> = ({ onForm, onQuiz, onWorkshop }) => {
  const steps = [
    { n: 1, title: 'Make a form', body: 'Collect sign-ups or feedback. Share the link or QR code.', cta: 'New form', run: onForm },
    { n: 2, title: 'Build a quiz', body: 'Questions, timers and points. Host it live with a PIN.', cta: 'New quiz', run: onQuiz },
    { n: 3, title: 'Add a workshop', body: 'It appears on the public site as soon as you save.', cta: 'Add workshop', run: onWorkshop },
  ];
  return (
    <section
      aria-labelledby="start-here"
      className="relative overflow-hidden rounded-xl border border-border bg-panel p-6 sm:p-8"
    >
      <Pattern className="text-primary opacity-[0.05]" />
      <div className="relative">
        <h2 id="start-here" className="text-2xl font-bold text-text">
          Start here
        </h2>
        <p className="mt-1 text-sm text-muted">Nothing is set up yet. These three take a few minutes each.</p>
        <ol className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map(step => (
            <li key={step.n} className="rounded-lg border border-border bg-bg p-5 flex flex-col">
              <span className="font-display text-3xl font-bold text-primary leading-none">{step.n}</span>
              <h3 className="mt-3 text-lg font-semibold text-text">{step.title}</h3>
              <p className="mt-1 mb-5 text-sm text-muted flex-1">{step.body}</p>
              <Button variant={step.n === 1 ? 'primary' : 'secondary'} size="sm" onClick={step.run} className="self-start">
                {step.cta}
              </Button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default Dashboard;
