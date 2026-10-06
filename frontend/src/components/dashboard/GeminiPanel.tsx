import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import client from '../../api/client';
import { Button, Card, CardHeader } from '../ui';

/**
 * Optional AI activity summary.
 *
 * It only runs when asked: the backend needs GEMINI_API_KEY, which most
 * installs (and every dev machine) do not have. Any failure is therefore read as
 * "not available here" in one plain line, never a red error — nothing else on
 * the dashboard depends on it.
 */
const GeminiPanel: React.FC = () => {
  const [report, setReport] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setReport('');
    setUnavailable(false);
    try {
      const res = await client.get<{ report?: string }>('/api/v1/admin/ai-report');
      const text = (res.data.report ?? '').trim();
      if (text) setReport(text);
      else setUnavailable(true);
    } catch {
      setUnavailable(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Activity summary"
        action={
          <Button variant="subtle" size="sm" onClick={handleGenerate} loading={isLoading}>
            {!isLoading && <Sparkles className="w-3.5 h-3.5" />}
            {isLoading ? 'Writing…' : report ? 'Refresh' : 'Write summary'}
          </Button>
        }
      />
      <div className="px-5 py-4 text-sm">
        {report ? (
          <p className="text-text whitespace-pre-wrap leading-relaxed">{report}</p>
        ) : unavailable ? (
          <p className="text-muted" role="status">
            AI summaries are switched off on this server (no Gemini key is set). Everything else works as normal.
          </p>
        ) : (
          <p className="text-muted">
            An AI-written recap of your forms, responses and quiz sessions. It uses Google Gemini and only runs when
            you ask.
          </p>
        )}
      </div>
    </Card>
  );
};

export default GeminiPanel;
