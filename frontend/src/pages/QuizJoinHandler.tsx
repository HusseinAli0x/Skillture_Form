import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import client from '../api/client';
import { apiErrorMessage, apiErrorStatus } from '../lib/apiError';
import { Button } from '../components/ui';
import { brandAssets } from '../components/brand';
import GameShell from '../components/game/GameShell';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/** How often to re-check whether the host has opened a session. */
const POLL_MS = 3000;

/**
 * Landing page for the shared quiz link (/quiz/:id). It waits for the host to
 * open a lobby, then forwards the player to the join screen with the PIN filled in.
 */
const QuizJoinHandler: React.FC = () => {
  useDocumentTitle('Waiting for the host');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef(true);

  const check = useCallback(async () => {
    try {
      const res = await client.get(`/api/v1/quizzes/${id}/active-session`);
      if (!alive.current) return;
      if (res.data?.pin) {
        navigate(`/play?pin=${res.data.pin}`, { replace: true });
        return;
      }
    } catch (err) {
      if (!alive.current) return;
      // 404 just means the host has not opened a lobby yet — keep waiting.
      if (apiErrorStatus(err) !== 404) {
        setError(apiErrorMessage(err, "Couldn't reach the game server."));
        return;
      }
    }
    setAttempts(n => n + 1);
    timer.current = setTimeout(check, POLL_MS);
  }, [id, navigate]);

  useEffect(() => {
    alive.current = true;
    check();
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, [check]);

  const retry = () => {
    setError(null);
    check();
  };

  return (
    <GameShell pattern="soft" title="Skillture Quiz">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 pb-12 text-center">
        <img
          src={brandAssets.hand}
          alt=""
          width={1600}
          height={1066}
          className="mb-6 h-40 w-full rounded-3xl object-cover"
          style={{ objectPosition: '12% 88%' }}
        />
        {error ? (
          <>
            <h1 className="text-3xl font-extrabold">We lost the host</h1>
            <p role="alert" className="mt-2 text-muted">
              {error}
            </p>
            <Button className="mt-6 !h-12" onClick={retry}>
              <RotateCw className="h-4 w-4" aria-hidden="true" /> Try again
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold">Waiting for the host</h1>
            <p className="mt-2 text-muted" aria-live="polite">
              The game hasn't opened yet. This page moves on by itself the moment it does.
            </p>
            <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted" role="status">
              <span aria-hidden="true" className="game-live h-2 w-2 rounded-full bg-primary" />
              Checking{attempts > 0 ? ` · ${attempts} ${attempts === 1 ? 'check' : 'checks'} so far` : '…'}
            </p>
          </>
        )}
        <Link to="/play" className="mt-8 text-sm text-primary underline-offset-4 hover:underline">
          Have a PIN? Enter it instead
        </Link>
      </div>
    </GameShell>
  );
};

export default QuizJoinHandler;
