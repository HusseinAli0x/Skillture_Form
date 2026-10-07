import React from 'react';
import { Check } from 'lucide-react';
import AnswerShape from './AnswerShape';
import { answerStyle } from '../../lib/game/answers';

export interface BarOption {
  key: string;
  label: string;
  /** Position in the question's options, which fixes its colour and shape. */
  index: number;
  count: number;
  correct: boolean;
}

/**
 * The vote split as vertical bars in the answer colours. The right answer keeps
 * full colour and a check; the rest dim, so the room sees at a glance who
 * guessed what.
 */
const AnswerBars: React.FC<{ options: BarOption[]; totalAnswered: number }> = ({ options, totalAnswered }) => {
  const max = Math.max(1, ...options.map(o => o.count));
  return (
    <ul className="flex items-end justify-center gap-3 sm:gap-6 w-full max-w-4xl mx-auto" style={{ minHeight: '20rem' }}>
      {options.map((o, i) => {
        const style = answerStyle(o.index);
        const pct = totalAnswered > 0 ? Math.round((o.count / totalAnswered) * 100) : 0;
        const height = o.count === 0 ? 6 : 12 + (o.count / max) * 88;
        return (
          <li key={o.key} className={`flex-1 min-w-0 flex flex-col items-center gap-2 ${o.correct ? '' : 'opacity-45'}`}>
            <span className="numeral text-3xl sm:text-4xl font-semibold">{o.count}</span>
            <span className="text-sm text-muted">{pct}%</span>
            <div className="w-full flex items-end justify-center" style={{ height: '14rem' }}>
              <div
                className={`game-grow-y w-full max-w-36 rounded-t-xl relative ${style.bg.split(' ')[0]} ${
                  o.correct ? 'ring-4 ring-white' : ''
                }`}
                style={{ height: `${height}%`, animationDelay: `${i * 0.12}s` }}
              >
                {o.correct && (
                  <span className="absolute -top-5 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white text-ink">
                    <Check className="w-6 h-6" aria-hidden="true" />
                  </span>
                )}
              </div>
            </div>
            <div className={`w-full flex items-center justify-center gap-2 rounded-xl px-2 py-3 ${style.bg.split(' ')[0]} ${style.text}`}>
              <AnswerShape shape={style.shape} className="w-5 h-5 flex-shrink-0" />
              <span className="font-semibold truncate">{o.label}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default AnswerBars;
