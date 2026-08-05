import React, { useEffect, useState } from 'react';
import { Plus, FileText, GamepadIcon, Activity } from 'lucide-react';
import { useNavigate } from 'react-router';
import client from '../api/client';
import { FormStatus, QuizStatus } from '../api/types';
import type { Quiz, Form } from '../api/types';
import { localized } from '../lib/i18n';
import ShareModal from '../components/ShareModal';
import StatCard from '../components/dashboard/StatCard';
import GeminiPanel from '../components/dashboard/GeminiPanel';
import RecentPanel from '../components/dashboard/RecentPanel';
import { Button, PageHeader } from '../components/ui';
import { formShareUrl, quizShareUrl } from '../lib/links';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [share, setShare] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    Promise.all([
      client.get<Quiz[]>('/api/v1/quizzes').catch(() => ({ data: [] })),
      client.get<Form[]>('/api/v1/forms').catch(() => ({ data: [] })),
    ])
      .then(([qRes, fRes]) => {
        setQuizzes(qRes.data || []);
        setForms(fRes.data || []);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // status is an int16 from the API, not a string. Comparing against 'active'
  // meant these cards read 0 no matter how many were active or published.
  const activeQuizzes = quizzes.filter(q => q.status === QuizStatus.Active).length;
  const publishedForms = forms.filter(f => f.status === FormStatus.Published).length;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Overview of your forms and quiz games." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Total Forms"
          value={isLoading ? '…' : forms.length}
          onClick={() => navigate('/admin/forms')}
        />
        <StatCard
          icon={<GamepadIcon className="w-5 h-5" />}
          label="Total Quizzes"
          value={isLoading ? '…' : quizzes.length}
          onClick={() => navigate('/admin/quizzes')}
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Active Quizzes"
          value={isLoading ? '…' : activeQuizzes}
          tone="success"
        />
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Published Forms"
          value={isLoading ? '…' : publishedForms}
          tone="success"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RecentPanel
          heading="Recent Forms"
          type="form"
          icon={<FileText className="w-4 h-4" />}
          isLoading={isLoading}
          emptyLabel="No forms yet"
          createLabel="Create First Form"
          items={forms.map(f => ({
            id: f.id,
            title: localized(f.title, 'Untitled Form'),
            status: f.status,
            raw: f,
          }))}
          onViewAll={() => navigate('/admin/forms')}
          onCreate={() => navigate('/admin/forms/new')}
          // Previously navigated to /forms/:id, which is not a route — the
          // catch-all bounced the user back to the public landing page.
          onOpen={id => navigate(`/admin/forms/${id}`)}
          onEdit={id => navigate(`/admin/forms/${id}/edit`)}
          onShare={id => {
            const form = forms.find(f => f.id === id);
            setShare({
              url: formShareUrl(id),
              title: `Share "${localized(form?.title, 'Untitled Form')}"`,
            });
          }}
        />

        <RecentPanel
          heading="Recent Quizzes"
          type="quiz"
          icon={<GamepadIcon className="w-4 h-4" />}
          isLoading={isLoading}
          emptyLabel="No quizzes yet"
          createLabel="Create First Quiz"
          items={quizzes.map(q => ({
            id: q.id,
            title: localized(q.title, 'Untitled Quiz'),
            status: q.status,
            raw: q,
          }))}
          onViewAll={() => navigate('/admin/quizzes')}
          onCreate={() => navigate('/admin/builder')}
          onOpen={id => navigate(`/admin/builder/${id}`)}
          onEdit={id => navigate(`/admin/builder/${id}`)}
          onShare={id => {
            const quiz = quizzes.find(q => q.id === id);
            setShare({
              url: quizShareUrl(id),
              title: `Share "${localized(quiz?.title, 'Untitled Quiz')}"`,
            });
          }}
        />
      </div>

      <GeminiPanel />

      {!isLoading && forms.length === 0 && quizzes.length === 0 && (
        <div className="flex justify-center">
          <Button onClick={() => navigate('/admin/forms/new')}>
            <Plus className="w-4 h-4" /> Create your first form
          </Button>
        </div>
      )}

      {share && <ShareModal url={share.url} title={share.title} onClose={() => setShare(null)} />}
    </div>
  );
};

export default Dashboard;
