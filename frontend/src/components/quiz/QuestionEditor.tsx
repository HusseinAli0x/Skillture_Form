import React from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { QuizQuestionType } from '../../api/types';
import { IconButton, Input, Label, Select } from '../ui';
import { MAX_OPTIONS, QUESTION_TYPE_LABELS, type QuestionState } from './questionState';
import { newId } from '../../lib/id';

/** Number inputs hand back '' while being cleared, which parseInt turns into NaN. */
const toNumber = (raw: string, fallback: number) => {
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

interface Props {
  question: QuestionState;
  index: number;
  total: number;
  onChange: (patch: Partial<QuestionState>) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
}

/**
 * Editor for a single quiz question. Extracted from FormQuizBuilder, which was
 * a 522-line file holding page chrome, save orchestration and this editor.
 */
const QuestionEditor: React.FC<Props> = ({ question, index, total, onChange, onRemove, onMove }) => {
  const isCorrect = (optionId: string) => question.correctOptionId === optionId;

  const setOptionValue = (optionId: string, value: string) =>
    onChange({ options: question.options.map(o => (o.id === optionId ? { ...o, value } : o)) });

  const removeOption = (optionId: string) =>
    onChange({
      options: question.options.filter(o => o.id !== optionId),
      // Dropping the option that was marked correct must clear the mark too,
      // or the quiz saves with a correct_answer that no option matches.
      ...(isCorrect(optionId) ? { correctOptionId: '' } : {}),
    });

  const addOption = () =>
    onChange({
      options: [...question.options, { id: newId(), value: `Option ${question.options.length + 1}` }],
    });

  return (
    <div className="rounded-xl border border-border bg-panel overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-hover-overlay">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-1">
            <button
              onClick={() => onMove('up')}
              disabled={index === 0}
              aria-label="Move question up"
              className="p-1.5 rounded-md border border-primary-border bg-primary-soft text-primary transition-colors hover:bg-primary hover:text-bg disabled:opacity-30 disabled:hover:bg-primary-soft disabled:hover:text-primary"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onMove('down')}
              disabled={index === total - 1}
              aria-label="Move question down"
              className="p-1.5 rounded-md border border-primary-border bg-primary-soft text-primary transition-colors hover:bg-primary hover:text-bg disabled:opacity-30 disabled:hover:bg-primary-soft disabled:hover:text-primary"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
          <span className="text-sm font-medium text-muted">Question {index + 1}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary-border">
            {QUESTION_TYPE_LABELS[question.type]}
          </span>
        </div>

        <IconButton label="Remove question" tone="danger" disabled={total === 1} onClick={onRemove}>
          <Trash2 className="w-4 h-4" />
        </IconButton>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Label required>Question Text</Label>
            <Input
              value={question.question}
              onChange={e => onChange({ question: e.target.value })}
              placeholder="Enter your question..."
              className="!py-2 !px-3"
            />
          </div>
          <div className="w-44">
            <Label>Type</Label>
            <div className="relative">
              <Select
                value={question.type}
                onChange={e => onChange({ type: e.target.value as QuizQuestionType })}
              >
                {(Object.keys(QUESTION_TYPE_LABELS) as QuizQuestionType[]).map(t => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted" />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-32">
            <Label>Time (sec)</Label>
            <Input
              type="number"
              min={1}
              value={question.timeLimit}
              onChange={e => onChange({ timeLimit: toNumber(e.target.value, 15) })}
              className="!py-2 !px-3"
            />
          </div>
          <div className="w-32">
            <Label>Points</Label>
            <Input
              type="number"
              min={0}
              value={question.points}
              onChange={e => onChange({ points: toNumber(e.target.value, 1000) })}
              className="!py-2 !px-3"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-hover-overlay">
          <Label required className="mb-3">
            Answers
          </Label>

          {question.type === 'mcq' && (
            <div className="space-y-3">
              {question.options.map((opt, optIdx) => (
                <div key={opt.id} className="flex items-center gap-3">
                  <button
                    onClick={() => onChange({ correctOptionId: opt.id })}
                    role="radio"
                    aria-checked={isCorrect(opt.id)}
                    aria-label={`Mark option ${optIdx + 1} correct`}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      isCorrect(opt.id) ? 'border-primary bg-primary-border' : 'border-border'
                    }`}
                  >
                    {isCorrect(opt.id) && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </button>
                  <Input
                    value={opt.value}
                    onChange={e => setOptionValue(opt.id, e.target.value)}
                    placeholder={`Option ${optIdx + 1}`}
                    aria-label={`Option ${optIdx + 1}`}
                    className={`flex-1 !py-1.5 !px-3 ${isCorrect(opt.id) ? '!border-primary text-primary' : ''}`}
                  />
                  {question.options.length > 2 && (
                    <IconButton
                      label={`Remove option ${optIdx + 1}`}
                      tone="danger"
                      onClick={() => removeOption(opt.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  )}
                </div>
              ))}
              {question.options.length < MAX_OPTIONS && (
                <button
                  onClick={addOption}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Option
                </button>
              )}
            </div>
          )}

          {question.type === 'tf' && (
            <div className="flex gap-4">
              {question.options.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => onChange({ correctOptionId: opt.id })}
                  aria-pressed={isCorrect(opt.id)}
                  className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    isCorrect(opt.id)
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border text-muted hover:border-border-strong hover:text-text'
                  }`}
                >
                  {opt.value}
                </button>
              ))}
            </div>
          )}

          {question.type === 'short' && (
            <div>
              <Input
                value={question.correctOptionId}
                onChange={e => onChange({ correctOptionId: e.target.value })}
                placeholder="Type the exact correct answer here..."
                aria-label="Correct answer"
                className="!py-2 !px-3"
              />
              <p className="text-xs mt-2 text-muted">Answers must match exactly (case-insensitive).</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
