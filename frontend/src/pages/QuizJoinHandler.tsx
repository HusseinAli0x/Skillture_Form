import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';

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

        const session = res.data;
        if (session && session.pin) {
          navigate(`/play?pin=${session.pin}`, { replace: true });
        } else {
          timeout = setTimeout(checkSession, 3000);
        }
      } catch (err: any) {
        if (!isMounted) return;

        if (err.response?.status === 404) {
          // No active session yet, keep polling
          timeout = setTimeout(checkSession, 3000);
        } else {
          setError(err.response?.data?.error || 'Failed to connect to game server');
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="bg-[#141414] border border-red-500/20 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-xl font-bold text-red-400 mb-2">Connection Error</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
      <div className="w-16 h-16 relative mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-[#2a2a2a]"></div>
        <div className="absolute inset-0 rounded-full border-4 border-[#0ABFBC] border-t-transparent animate-spin"></div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Waiting for Host...</h2>
      <p className="text-slate-400">The game hasn't started yet. We'll connect you automatically when it's ready.</p>
    </div>
  );
};

export default QuizJoinHandler;
