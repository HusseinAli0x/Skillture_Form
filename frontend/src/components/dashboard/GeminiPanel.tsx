import React, { useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import client from '../../api/client';
import { Button } from '../ui';

/**
 * AI activity report.
 *
 * The backend exposes a single endpoint that summarises database counts; it
 * takes no prompt. This panel used to render a free-text input and POST to
 * `/api/v1/ai/generate`, a route that has never existed, so it always showed
 * "Error generating response."
 */
const GeminiPanel: React.FC = () => {
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setReport('');
    setError('');
    try {
      const res = await client.get('/api/v1/admin/ai-report');
      setReport(res.data.report || 'No report generated.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate report.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-panel p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-500/20 border border-indigo-500/30">
          <Bot className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text flex items-center gap-2">
            AI Assistant
            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-indigo-500/20 text-indigo-300">
              Beta
            </span>
          </h2>
          <p className="text-xs text-muted">Powered by Google Gemini 2.5 Flash</p>
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        <div className="flex items-center gap-4">
          <p className="flex-1 text-sm text-muted">
            Generate an activity summary across your forms, responses, quizzes and sessions.
          </p>
          <Button
            onClick={handleGenerate}
            loading={isLoading}
            className="!bg-indigo-500 hover:!bg-indigo-600 !text-white shrink-0"
          >
            {!isLoading && <Send className="w-4 h-4" />}
            {isLoading ? 'Generating…' : 'Generate report'}
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-xl text-sm bg-danger-soft border border-danger-border text-danger">{error}</div>
        )}

        {report && (
          <div className="p-4 rounded-xl bg-bg border border-border">
            <div className="prose prose-invert prose-sm max-w-none text-muted whitespace-pre-wrap">{report}</div>
          </div>
        )}

        {!report && !error && !isLoading && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Sparkles className="w-3.5 h-3.5" />
            Requires GEMINI_API_KEY to be configured on the server.
          </p>
        )}
      </div>
    </div>
  );
};

export default GeminiPanel;
