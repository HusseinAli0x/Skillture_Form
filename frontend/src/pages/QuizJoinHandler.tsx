import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import client from '../api/client';
import { apiErrorMessage, apiErrorStatus } from '../lib/apiError';
import { Card, Spinner } from '../components/ui';

/** How often to re-check whether the host has opened a session. */
const POLL_MS = 3000;

const QuizJoinHandler: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let isMounted = true;

    const checkSession = async () => {
      try {
        const res = await client.get(`/api/v1/quizzes/${id}/active-session`);
        if (!isMounted) return;

        if (res.data?.pin) {
          navigate(`/play?pin=${res.data.pin}`, { replace: true });
        } else {
          timeout = setTimeout(checkSession, POLL_MS);
        }
      } catch (err) {
        if (!isMounted) return;

        // 404 means the host has not started yet — keep waiting.
        if (apiErrorStatus(err) === 404) {
          timeout = setTimeout(checkSession, POLL_MS);
        } else {
          setError(apiErrorMessage(err, 'Failed to connect to game server'));
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [id, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Card className="border-danger-border p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-xl font-bold text-danger mb-2">Connection Error</h2>
          <p className="text-muted">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <Spinner size="w-16 h-16" className="border-4 mb-6" />
      <h2 className="text-2xl font-bold text-text mb-2">Waiting for Host…</h2>
      <p className="text-muted text-center">
        The game hasn't started yet. We'll connect you automatically when it's ready.
      </p>
    </div>
  );
};

export default QuizJoinHandler;
