import React, { useRef } from 'react';
import { nextTabIndex } from './uiLogic';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  /** Optional count shown after the label. */
  count?: number;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab group. */
  label: string;
  className?: string;
}

/**
 * Filter tabs (not page navigation). Roving tabindex: one stop in the tab
 * order, arrow keys move between tabs and select on focus.
 */
function Tabs<T extends string>({ items, value, onChange, label, className = '' }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const next = nextTabIndex(e.key, index, items.length);
    if (next === null) return;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={`flex gap-1 overflow-x-auto max-w-full [scrollbar-width:none] ${className}`}>
      {items.map((item, i) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={el => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={e => onKeyDown(e, i)}
            className={[
              'inline-flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              selected
                ? 'bg-primary-soft text-primary border-primary-border'
                : 'text-muted border-transparent hover:text-text hover:bg-hover-overlay-strong',
            ].join(' ')}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={`text-xs tabular-nums ${selected ? 'text-primary' : 'text-muted'}`}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
