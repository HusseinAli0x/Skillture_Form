import React, { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, Plus, Trash2 } from 'lucide-react';
import type { QuizQuestionType } from '../../api/types';
import { IconButton, Input, Label } from '../ui';
import { Shape } from '../game/AnswerTile';
import { answerStyle } from '../game/gameLogic';
import {
  MAX_OPTIONS,
  QUESTION_TYPE_LABELS,
  type IssueField,
  type QuestionIssue,
  type QuestionState,
} from './questionState';
import { newId } from '../../lib/id';
import { hostEn, type HostStrings } from '../../lib/hostSiteStrings';
import { fill } from './quizText';

/** Number inputs hand back '' while being cleared, which parseInt turns into NaN. */
const toNumber = (raw: string, fallback: number) => {
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const TIME_PRESETS = [10, 15, 20, 30, 60];

interface Props {
  question: QuestionState;
  index: number;
  total: number;
  onChange: (patch: Partial<QuestionState>) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onDuplicate?: () => void;
  /** Problems to show next to the offending part. Pass them once the author has tried to save. */
  issues?: QuestionIssue[];
  /** Put the cursor in the question text on mount (a question that was just added). */
  autoFocus?: boolean;
  /** Wording; English unless the public builder passes its own language. */
  text?: HostStrings['editor'];
}

/**
 * Editor for a single quiz question. Extracted from FormQuizBuilder, which was
 * a 522-line file holding page chrome, save orchestration and this editor.
 *
 * Answer rows wear the same colour and shape as the tiles players tap, so the
 * author sees what the room will see. Enter in an answer adds the next one.
 */
const QuestionEditor: React.FC<Props> = ({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  onDuplicate,
  issues = [],
  autoFocus = false,
  text: t = hostEn.editor,
}) => {
  const isCorrect = (optionId: string) => question.correctOptionId === optionId;
  const root = useRef<HTMLDivElement>(null);
  const focusIndex = useRef<number | null>(null);

  // Ids are scoped to the question so several editors on the page do not
  // collide, and so each Label actually names its control — without htmlFor
  // the visible text is decoration and the field is unnamed to a screen
  // reader.
  const fieldId = (name: string) => `q-${question.id}-${name}`;

  const issue = (field: IssueField) => issues.find(i => i.field === field)?.message;
  const problem = (field: IssueField) => {
    const message = issue(field);
    return message ? (
      <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
        {message}
      </p>
    ) : null;
  };

  const setOptionValue = (optionId: string, value: string) =>
    onChange({ options: question.options.map(o => (o.id === optionId ? { ...o, value } : o)) });

  const removeOption = (optionId: string) =>
    onChange({
      options: question.options.filter(o => o.id !== optionId),
      // Dropping the option that was marked correct must clear the mark too,
      // or the quiz saves with a correct_answer that no option matches.
      ...(isCorrect(optionId) ? { correctOptionId: '' } : {}),
    });

  const addOption = () => {
    focusIndex.current = question.options.length;
    onChange({
      options: [...question.options, { id: newId(), value: fill(t.option, { n: question.options.length + 1 }) }],
    });
  };

  // After an answer is added with Enter, the new row's input takes focus.
  useEffect(() => {
    if (focusIndex.current === null) return;
    const el = root.current?.querySelectorAll<HTMLInputElement>('[data-answer-input]')[focusIndex.current];
    focusIndex.current = null;
    el?.focus();
    el?.select();
  }, [question.options.length]);

  const setType = (type: QuizQuestionType) => {
    if (type !== question.type) onChange({ type });
  };

  return (
    <div
      ref={root}
      data-question-id={question.id}
      className={`rounded-xl border bg-panel ${issues.length ? 'border-danger-border' : 'border-border'}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-hover-overlay px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-primary px-2 font-display text-base font-extrabold text-bg">
            {index + 1}
          </span>
          <span className="sr-only">{fill(t.question, { n: index + 1 })}</span>
          <div className="flex items-center gap-1">
            <IconButton label={t.moveUp} disabled={index === 0} onClick={() => onMove('up')}>
              <ArrowUp className="h-4 w-4" />
            </IconButton>
            <IconButton label={t.moveDown} disabled={index === total - 1} onClick={() => onMove('down')}>
              <ArrowDown className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onDuplicate && (
            <IconButton label={t.duplicate} tone="primary" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
            </IconButton>
          )}
          <IconButton label={t.remove} tone="danger" disabled={total === 1} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <Label htmlFor={fieldId('text')} required>
            {t.questionText}
          </Label>
          <Input
            id={fieldId('text')}
            value={question.question}
            onChange={e => onChange({ question: e.target.value })}
            placeholder={t.questionPlaceholder}
            invalid={!!issue('text')}
            autoFocus={autoFocus}
            className="!px-3 !py-2.5 font-display !text-lg font-semibold"
          />
          {problem('text')}
        </div>

        <div role="radiogroup" aria-label={t.questionType} className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-bg p-1">
          {(Object.keys(QUESTION_TYPE_LABELS) as QuizQuestionType[]).map(type => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={question.type === type}
              onClick={() => setType(type)}
              className={`rounded-lg px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                question.type === type ? 'bg-primary text-bg' : 'text-muted hover:bg-hover-overlay-strong hover:text-text'
              }`}
            >
              {t.types[type]}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-hover-overlay p-4">
          <Label required className="mb-3">
            {t.answers}
          </Label>

          {question.type === 'mcq' && (
            <div className="space-y-2.5">
              {question.options.map((opt, optIdx) => {
                const style = answerStyle(optIdx);
                return (
                  <div key={opt.id} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onChange({ correctOptionId: opt.id })}
                      role="radio"
                      aria-checked={isCorrect(opt.id)}
                      aria-label={fill(t.markCorrect, { n: optIdx + 1 })}
                      title={t.markCorrectTitle}
                      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isCorrect(opt.id) ? 'border-text' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: style.bg, color: '#050909' }}
                    >
                      {isCorrect(opt.id) ? (
                        <Check className="h-5 w-5" strokeWidth={3.5} />
                      ) : (
                        <Shape shape={style.shape} className="h-4 w-4" />
                      )}
                    </button>
                    <Input
                      value={opt.value}
                      data-answer-input=""
                      onChange={e => setOptionValue(opt.id, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (question.options.length < MAX_OPTIONS && optIdx === question.options.length - 1) addOption();
                          else {
                            root.current?.querySelectorAll<HTMLInputElement>('[data-answer-input]')[optIdx + 1]?.focus();
                          }
                        }
                      }}
                      placeholder={fill(t.option, { n: optIdx + 1 })}
                      aria-label={fill(t.option, { n: optIdx + 1 })}
                      className={`flex-1 !px-3 !py-2 ${isCorrect(opt.id) ? '!border-primary' : ''}`}
                    />
                    {question.options.length > 2 && (
                      <IconButton label={fill(t.removeOption, { n: optIdx + 1 })} tone="danger" onClick={() => removeOption(opt.id)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                );
              })}
              {question.options.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={addOption}
                  className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> {t.addOption}
                  <span className="text-muted">{t.addOptionHint}</span>
                </button>
              )}
              {problem('options')}
            </div>
          )}

          {question.type === 'tf' && (
            <div className="flex gap-3">
              {question.options.map((opt, i) => {
                const style = answerStyle(i);
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => onChange({ correctOptionId: opt.id })}
                    aria-pressed={isCorrect(opt.id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-semibold transition-colors ${
                      isCorrect(opt.id) ? 'border-text text-ink' : 'border-border text-muted hover:border-border-strong hover:text-text'
                    }`}
                    style={isCorrect(opt.id) ? { backgroundColor: style.bg } : undefined}
                  >
                    {isCorrect(opt.id) && <Check className="h-4 w-4" strokeWidth={3.5} />}
                    {opt.value}
                  </button>
                );
              })}
            </div>
          )}

          {question.type === 'short' && (
            <div>
              <Input
                value={question.correctOptionId}
                onChange={e => onChange({ correctOptionId: e.target.value })}
                placeholder={t.shortPlaceholder}
                aria-label={t.correctAnswer}
                invalid={!!issue('answer')}
                className="!px-3 !py-2"
              />
              <p className="mt-2 text-xs text-muted">{t.shortHint}</p>
            </div>
          )}
          {problem('answer')}
        </div>

        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div>
            <Label htmlFor={fieldId('time')}>{t.time}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={fieldId('time')}
                type="number"
                min={1}
                value={question.timeLimit}
                invalid={!!issue('time')}
                onChange={e => onChange({ timeLimit: toNumber(e.target.value, 15) })}
                className="!w-24 !px-3 !py-2"
              />
              <div className="hidden gap-1 sm:flex" aria-label={t.timePresets} role="group">
                {TIME_PRESETS.map(s => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={question.timeLimit === s}
                    onClick={() => onChange({ timeLimit: s })}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      question.timeLimit === s ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted hover:border-border-strong'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {problem('time')}
          </div>
          <div>
            <Label htmlFor={fieldId('points')}>{t.points}</Label>
            <Input
              id={fieldId('points')}
              type="number"
              min={1}
              value={question.points}
              invalid={!!issue('points')}
              onChange={e => onChange({ points: toNumber(e.target.value, 1000) })}
              className="!w-28 !px-3 !py-2"
            />
            {problem('points')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
