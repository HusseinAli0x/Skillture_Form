import { useCallback, useEffect, useState } from 'react';
import client from '../../api/client';
import { QuizStatus } from '../../api/types';
import type { Form, FormResponse, Quiz, QuizSession } from '../../api/types';
import { localized } from '../../lib/i18n';

export interface RecentResponse {
  id: string;
  formId: string;
  formTitle: string;
  respondent: string;
  submittedAt: string;
}

export interface LiveSession {
  id: string;
  quizId: string;
  quizTitle: string;
  pin: string;
  status: QuizSession['status'];
}

export type LoadState = 'loading' | 'error' | 'ready';

/** How many forms / quizzes the activity panels look into. Keeps fan-out small. */
const FORMS_TO_SCAN = 8;
const QUIZZES_TO_SCAN = 6;
export const RECENT_LIMIT = 6;

const list = <T>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

export function useDashboardData() {
  const [state, setState] = useState<LoadState>('loading');
  const [forms, setForms] = useState<Form[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [workshops, setWorkshops] = useState<number | null>(null);
  const [recent, setRecent] = useState<RecentResponse[]>([]);
  const [live, setLive] = useState<LiveSession[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    setState('loading');
    setActivityLoading(true);
    setNonce(n => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      let loadedForms: Form[];
      let loadedQuizzes: Quiz[];
      try {
        const [fRes, qRes] = await Promise.all([
          client.get<Form[]>('/api/v1/forms'),
          client.get<Quiz[]>('/api/v1/quizzes'),
        ]);
        loadedForms = list<Form>(fRes.data);
        loadedQuizzes = list<Quiz>(qRes.data);
      } catch {
        if (!cancelled) setState('error');
        return;
      }
      if (cancelled) return;
      setForms(loadedForms);
      setQuizzes(loadedQuizzes);
      setState('ready');

      // Secondary data. Each piece fails on its own without taking the page down.
      client
        .get('/api/v1/workshops')
        .then(res => !cancelled && setWorkshops(list(res.data).length))
        .catch(() => !cancelled && setWorkshops(null));

      const newestForms = [...loadedForms]
        .sort((a, b) => Date.parse(b.creat_at) - Date.parse(a.creat_at))
        .slice(0, FORMS_TO_SCAN);
      const activeQuizzes = loadedQuizzes.filter(q => q.status === QuizStatus.Active).slice(0, QUIZZES_TO_SCAN);

      const [responseBatches, sessions] = await Promise.all([
        Promise.all(
          newestForms.map(form =>
            client
              .get<FormResponse[]>(`/api/v1/forms/${form.id}/responses`)
              .then(res =>
                list<FormResponse>(res.data).map<RecentResponse>(r => ({
                  id: r.id,
                  formId: form.id,
                  formTitle: localized(form.title, 'Untitled form'),
                  respondent: localized(r.respondent as Record<string, string> | undefined, 'Anonymous'),
                  submittedAt: r.submitted_at,
                }))
              )
              .catch(() => [] as RecentResponse[])
          )
        ),
        Promise.all(
          activeQuizzes.map(quiz =>
            client
              .get<QuizSession>(`/api/v1/quizzes/${quiz.id}/active-session`)
              .then(res =>
                res.data && res.data.id
                  ? ({
                      id: res.data.id,
                      quizId: quiz.id,
                      quizTitle: localized(quiz.title, 'Untitled quiz'),
                      pin: res.data.pin,
                      status: res.data.status,
                    } satisfies LiveSession)
                  : null
              )
              // 404 simply means "nothing hosted right now".
              .catch(() => null)
          )
        ),
      ]);
      if (cancelled) return;

      setRecent(
        responseBatches
          .flat()
          .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
          .slice(0, RECENT_LIMIT)
      );
      setLive(sessions.filter((s): s is LiveSession => s !== null && s.status !== 'finished'));
      setActivityLoading(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { state, forms, quizzes, workshops, recent, live, activityLoading, reload };
}
