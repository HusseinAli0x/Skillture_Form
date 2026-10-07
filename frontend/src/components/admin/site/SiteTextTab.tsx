import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, RotateCcw, Search } from 'lucide-react';
import client from '../../../api/client';
import { useSiteStore } from '../../../context/SiteStore';
import { useToastStore } from '../../../context/ToastStore';
import type { Locale } from '../../../context/LanguageStore';
import { apiErrorMessage } from '../../../lib/apiError';
import { buildTextCatalog, labelOf, type TextRow } from '../../../lib/siteContent';
import { Input, Textarea } from '../../ui';
import { LangTag } from '../Field';
import { FormBanner } from '../AdminStates';
import SaveBar from '../SaveBar';
import {
  MAX_TEXT_LEN,
  customisedCount,
  editKey,
  groupRows,
  isCustomised,
  isEditable,
  matchesQuery,
  overLimit,
  pendingChanges,
  savedValue,
  shownValue,
  type Edits,
} from './siteTextModel';

/** The server accepts this many changes per request. */
const BATCH = 500;

/** Most lines drawn at once while searching. */
const SEARCH_RENDER_LIMIT = 60;

const rowsFor = (n: number) => Math.min(6, Math.max(1, Math.ceil(n / 70)));
const lines = (n: number) => `${n} ${n === 1 ? 'line' : 'lines'}`;

interface CellProps {
  id: string;
  lang: Locale;
  row: TextRow;
  /** Names the field for screen readers: there are hundreds of identical-looking ones. */
  name: string;
  value: string;
  customised: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** One language of one string: the text, and a way back to the built-in wording. */
const TextCell: React.FC<CellProps> = ({ id, lang, row, name, value, customised, disabled, onChange }) => {
  const defaultText = row[lang];
  const changed = value !== defaultText;
  const tooLong = [...value].length > MAX_TEXT_LEN;
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label htmlFor={id} className="flex items-center gap-2 text-xs font-medium text-muted">
          <LangTag lang={lang} />
          {customised && <span className="text-primary">Customised</span>}
        </label>
        {changed && !disabled && (
          <button
            type="button"
            onClick={() => onChange(defaultText)}
            aria-label={`Use default for ${name} (${lang === 'en' ? 'English' : 'Arabic'})`}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RotateCcw aria-hidden="true" className="w-3 h-3" />
            Use default
          </button>
        )}
      </div>
      <Textarea
        id={id}
        aria-label={`${name} (${lang === 'en' ? 'English' : 'Arabic'})`}
        value={value}
        rows={rowsFor([...value].length)}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        lang={lang}
        disabled={disabled}
        invalid={tooLong}
        onChange={e => onChange(e.target.value)}
        className="!py-2 leading-relaxed"
      />
      {tooLong && (
        <p role="alert" className="mt-1 text-xs text-danger">
          Too long: keep it under {MAX_TEXT_LEN.toLocaleString()} characters.
        </p>
      )}
      {disabled && (
        <p className="mt-1 text-xs text-muted">
          Edited in the{' '}
          <Link to="/admin/homepage" className="text-primary underline underline-offset-2">
            Homepage Editor
          </Link>
          .
        </p>
      )}
    </div>
  );
};

/**
 * Every line of wording on the public site, in English and Arabic, grouped by
 * page. Change what you want and save once; text you leave alone keeps its
 * built-in wording. "Use default" puts the original back.
 */
interface Props {
  /** Lets the page raise one "leave without saving?" prompt for all tabs. */
  onDirtyChange?: (dirty: boolean) => void;
}

const SiteTextTab: React.FC<Props> = ({ onDirtyChange }) => {
  const rows = useMemo(buildTextCatalog, []);
  const saved = useSiteStore(s => s.text);
  const addToast = useToastStore(s => s.addToast);

  const [edits, setEdits] = useState<Edits>({});
  const [query, setQuery] = useState('');
  const [onlyCustomised, setOnlyCustomised] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changes = useMemo(() => pendingChanges(rows, saved, edits), [rows, saved, edits]);
  const tooLong = useMemo(() => overLimit(edits), [edits]);
  const dirty = changes.length > 0;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // Filtering and rendering hundreds of fields on every keystroke would make
  // typing in the search box stutter; React catches up between keystrokes.
  const deferredQuery = useDeferredValue(query);

  const visible = useMemo(
    () =>
      rows.filter(
        r =>
          matchesQuery(r, deferredQuery, saved, edits) &&
          (!onlyCustomised || isCustomised(r, 'en', saved) || isCustomised(r, 'ar', saved)),
      ),
    [rows, deferredQuery, onlyCustomised, saved, edits],
  );
  const sections = useMemo(() => groupRows(visible), [visible]);
  const searching = deferredQuery.trim() !== '' || onlyCustomised;

  // A broad search ("a") can match everything. Show the first matches and say
  // so, rather than building a thousand text fields.
  let budget = SEARCH_RENDER_LIMIT;

  const setCell = useCallback((row: TextRow, lang: Locale, value: string) => {
    setEdits(prev => ({ ...prev, [editKey(row.key, lang)]: value }));
  }, []);

  const toggle = (title: string) =>
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  const save = async () => {
    if (saving || !dirty || tooLong.length > 0) return;
    setSaving(true);
    setError(null);
    try {
      for (let i = 0; i < changes.length; i += BATCH) {
        await client.put('/api/v1/admin/site/text', { changes: changes.slice(i, i + BATCH) });
      }
      useSiteStore.getState().patchText(changes);
      // Clear only what was saved: anything typed while the save was running stays.
      const saved = new Set(changes.map(c => editKey(c.key, c.locale)));
      setEdits(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => !saved.has(k))));
      void useSiteStore.getState().load();
      addToast('success', 'Wording saved. It is live now.');
    } catch (err) {
      const message = apiErrorMessage(err, 'The wording could not be saved.');
      setError(message);
      addToast('error', `${message} Your edits are still here.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted leading-relaxed">
        Every line of wording on the public site, in English and Arabic. Open a section, change what you want and save —
        anything you do not touch keeps its original wording, and <strong className="text-text font-semibold">Use default</strong>{' '}
        brings the original back. Workshop titles, descriptions, team members and the English homepage text are edited on
        their own pages.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[14rem] max-w-md">
          <Input
            type="search"
            aria-label="Search the site wording"
            placeholder="Search wording, in either language…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            icon={<Search aria-hidden="true" className="w-4 h-4" />}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm min-h-11 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyCustomised}
            onChange={e => setOnlyCustomised(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-primary)]"
          />
          Only customised
        </label>
        <p className="text-sm text-muted ms-auto" aria-live="polite">
          {visible.length} of {lines(rows.length)}
        </p>
      </div>

      <FormBanner message={error} />

      {sections.length === 0 ? (
        <p className="rounded-xl border border-border bg-panel px-5 py-10 text-center text-muted">
          {onlyCustomised && !query.trim()
            ? 'Nothing has been customised yet. Everything uses its original wording.'
            : 'No wording matches your search.'}
        </p>
      ) : (
        <div className="space-y-3">
          {sections.map(section => {
            const expanded = searching || open.has(section.title);
            const custom = customisedCount(section.rows, saved);
            const panelId = `site-text-${section.title.replace(/\W+/g, '-')}`;
            const drawn = searching ? section.rows.slice(0, Math.max(0, budget)) : section.rows;
            budget -= drawn.length;
            return (
              <section key={section.title} className="rounded-xl border border-border bg-panel">
                <h3>
                  <button
                    type="button"
                    onClick={() => toggle(section.title)}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="font-semibold">{section.title}</span>
                    <span className="flex items-center gap-3 text-sm text-muted">
                      {custom > 0 && <span className="text-primary">{custom} customised</span>}
                      <span>{lines(section.rows.length)}</span>
                      <ChevronDown aria-hidden="true" className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                </h3>
                {expanded && (
                  <div id={panelId} className="divide-y divide-border border-t border-border">
                    {drawn.map(row => (
                      <div key={row.key} className="px-5 py-5">
                        <p className="text-sm font-medium">{labelOf(row.key)}</p>
                        <p className="mb-3 text-[11px] text-muted font-mono" dir="ltr">
                          {row.key}
                        </p>
                        <div className="grid gap-4 md:grid-cols-2">
                          {(['en', 'ar'] as const).map(lang => (
                            <TextCell
                              key={lang}
                              id={`${panelId}-${row.key}-${lang}`}
                              lang={lang}
                              row={row}
                              name={labelOf(row.key)}
                              value={shownValue(row, lang, saved, edits)}
                              customised={isCustomised(row, lang, saved) && savedValue(row, lang, saved) !== row[lang]}
                              disabled={!isEditable(row, lang)}
                              onChange={v => setCell(row, lang, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {searching && visible.length > SEARCH_RENDER_LIMIT && (
        <p className="text-sm text-muted" role="status">
          Showing the first {SEARCH_RENDER_LIMIT} of {visible.length} matching lines. Search for something more specific to see
          the rest.
        </p>
      )}

      <SaveBar
        dirty={dirty}
        saving={saving}
        problems={tooLong.length}
        onSave={save}
        onDiscard={() => {
          setEdits({});
          setError(null);
        }}
        saveLabel={dirty ? `Save ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}` : 'Save changes'}
      />
    </div>
  );
};

export default SiteTextTab;
