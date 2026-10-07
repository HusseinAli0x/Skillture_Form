import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, IconButton, Input, Textarea } from '../../ui';
import { Field } from '../Field';
import { moveItem } from '../listOps';
import {
  MAX_PILLARS,
  MIN_PILLARS,
  matchesTrackName,
  newPillar,
  pillarNum,
  type Pillar,
  type RowErrors,
} from './homepageModel';

interface Props {
  pillars: Pillar[];
  onChange: (next: Pillar[]) => void;
  errors: RowErrors;
}

/**
 * The cards in the homepage's "what we offer" list. Order here is the order on
 * the site. Number label and bullet points are kept (the API stores them) but
 * tucked away: the current design shows only title and description.
 */
const PillarsEditor: React.FC<Props> = ({ pillars, onChange, errors }) => {
  const update = (i: number, patch: Partial<Pillar>) => onChange(pillars.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {pillars.map((p, i) => {
          const err = errors[i];
          return (
            <li
              key={p.key}
              className={`rounded-lg border bg-bg p-4 ${err ? 'border-danger' : 'border-border'}`}
              aria-label={`Track ${i + 1}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary text-xs font-bold font-display">
                  {i + 1}
                </span>
                <p className="text-sm font-semibold text-text truncate flex-1">{p.title.trim() || 'Untitled track'}</p>
                <IconButton label={`Move track ${i + 1} up`} disabled={i === 0} onClick={() => onChange(moveItem(pillars, i, i - 1))}>
                  <ArrowUp className="w-4 h-4" />
                </IconButton>
                <IconButton
                  label={`Move track ${i + 1} down`}
                  disabled={i === pillars.length - 1}
                  onClick={() => onChange(moveItem(pillars, i, i + 1))}
                >
                  <ArrowDown className="w-4 h-4" />
                </IconButton>
                <IconButton
                  label={`Remove track ${i + 1}`}
                  tone="danger"
                  disabled={pillars.length <= MIN_PILLARS}
                  onClick={() => onChange(pillars.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </div>
              <div className="space-y-3">
                <Field
                  id={`pillar-${p.key}-title`}
                  label="Title"
                  required
                  hint={
                    matchesTrackName(p.title)
                      ? 'Matches a workshop track, so the site shows how many workshops were delivered under it.'
                      : 'Name it Technical, Career, Industry or Business to show a live workshop count beside it.'
                  }
                >
                  {c => <Input {...c} invalid={Boolean(err) && !p.title.trim()} value={p.title} onChange={e => update(i, { title: e.target.value })} />}
                </Field>
                <Field id={`pillar-${p.key}-desc`} label="Description" required>
                  {c => (
                    <Textarea
                      {...c}
                      rows={2}
                      invalid={Boolean(err) && !p.description.trim()}
                      value={p.description}
                      onChange={e => update(i, { description: e.target.value })}
                    />
                  )}
                </Field>
                <details className="group rounded-lg border border-border">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted hover:text-text list-none flex items-center justify-between">
                    Number label and bullet points
                    <span className="text-[11px] text-muted/80">not on the live site</span>
                  </summary>
                  <div className="space-y-3 border-t border-border p-3">
                    <Field id={`pillar-${p.key}-num`} label="Number label" hint={`Left blank, it is saved as ${pillarNum(p, i)}.`}>
                      {c => (
                        <Input {...c} className="sm:max-w-[8rem]" placeholder={pillarNum(p, i)} value={p.num} onChange={e => update(i, { num: e.target.value })} />
                      )}
                    </Field>
                    {p.points.map((pt, pi) => (
                      <Field key={pi} id={`pillar-${p.key}-pt-${pi}`} label={`Bullet ${pi + 1}`}>
                        {c => (
                          <Input
                            {...c}
                            value={pt}
                            onChange={e => update(i, { points: p.points.map((x, xi) => (xi === pi ? e.target.value : x)) })}
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                </details>
              </div>
              {err && (
                <p role="alert" className="mt-3 text-xs text-danger">
                  {err}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <Button variant="secondary" size="sm" disabled={pillars.length >= MAX_PILLARS} onClick={() => onChange([...pillars, newPillar()])}>
        <Plus aria-hidden="true" className="w-3.5 h-3.5" /> Add a track
      </Button>
    </div>
  );
};

export default PillarsEditor;
