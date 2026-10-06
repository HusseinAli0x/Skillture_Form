import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import client from '../api/client';
import { FormStatusLabels, QuizStatusLabels } from '../api/types';
import { useToastStore } from '../context/ToastStore';
import { apiErrorMessage } from '../lib/apiError';

export type StatusValue = 0 | 1 | 2;

interface Props {
  type: 'form' | 'quiz';
  id: string;
  initialStatus: StatusValue;
  onStatusChange?: (newStatus: StatusValue) => void;
}

// Draft is amber (needs action), live-to-the-audience is turquoise, finished is
// neutral. Coral is kept for destructive actions and LIVE sessions.
const tones: Record<StatusValue, { trigger: string; dot: string; text: string }> = {
  0: { trigger: 'bg-warning-soft border-warning-border text-warning', dot: 'bg-warning', text: 'text-warning' },
  1: { trigger: 'bg-primary-soft border-primary-border text-primary', dot: 'bg-primary', text: 'text-primary' },
  2: { trigger: 'bg-panel-3 border-border-strong text-muted', dot: 'bg-muted', text: 'text-muted' },
};

// Value 2 is "closed" for a form and "archived" for a quiz; a single shared
// label list showed forms as "Archived", which is not a form state at all.
const labels: Record<Props['type'], Record<StatusValue, string>> = {
  form: FormStatusLabels,
  quiz: QuizStatusLabels,
};

/** What the dropdown tells the user once a transition has gone through. */
const SUCCESS: Record<Props['type'], Partial<Record<StatusValue, string>>> = {
  form: { 1: 'Form published', 2: 'Form closed' },
  quiz: { 1: 'Quiz activated', 2: 'Quiz archived' },
};

/**
 * The endpoint that moves an entity into each state.
 *
 * Draft is absent on purpose: it is the initial state and neither state
 * machine has a path back to it. The dropdown used to offer it and force it
 * through an untyped PUT, which is exactly the bypass D4 describes. To stop a
 * published form taking responses, close it.
 */
const TRANSITIONS: Record<Props['type'], Partial<Record<StatusValue, string>>> = {
  form: { 1: 'publish', 2: 'close' },
  quiz: { 1: 'activate', 2: 'archive' },
};

/** States a user can move an entity *into*, in menu order. */
const STATUSES: StatusValue[] = [1, 2];

const StatusDropdown: React.FC<Props> = ({ type, id, initialStatus, onStatusChange }) => {
  const [status, setStatus] = useState<StatusValue>(initialStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { addToast } = useToastStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Re-sync when the parent refetches. State seeded once from a prop went stale
  // as soon as the list reloaded, so the badge could disagree with the server.
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  // The menu had no dismissal path other than picking an option: clicking
  // elsewhere, or opening a second dropdown, left it hanging open.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const handleUpdate = async (newStatus: StatusValue) => {
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      // Every transition goes through its own endpoint. This used to PUT the
      // whole object with a `status` field, which writes the column directly
      // and bypasses the state machine the use cases enforce — the form
      // routes did not even exist until D4.
      const path = type === 'quiz' ? 'quizzes' : 'forms';
      await client.patch(`/api/v1/${path}/${id}/${TRANSITIONS[type][newStatus]}`);

      setStatus(newStatus);
      onStatusChange?.(newStatus);
      addToast('success', SUCCESS[type][newStatus] ?? 'Status updated');
    } catch (err) {
      addToast('error', apiErrorMessage(err, 'Could not change the status. Try again.'));
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const tone = tones[status] ?? tones[0];
  const label = labels[type][status] ?? labels[type][0];

  return (
    <div ref={rootRef} className="relative inline-block text-start" onClick={e => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(open => !open)}
        disabled={isUpdating}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Status: ${label}. Change status`}
        className={`inline-flex items-center gap-1.5 ps-2.5 pe-2 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-70 ${tone.trigger}`}
      >
        <span className={`inline-flex rounded-full h-1.5 w-1.5 ${tone.dot}`} aria-hidden="true" />
        {label}
        <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute start-0 mt-2 w-44 rounded-xl border border-border bg-panel shadow-2xl overflow-hidden z-50 py-1"
        >
          {STATUSES.map(value => (
            <button
              key={value}
              type="button"
              role="menuitem"
              autoFocus={value === STATUSES[0]}
              onClick={() => handleUpdate(value)}
              className={`w-full text-start px-4 min-h-10 text-sm transition-colors flex items-center gap-2 hover:bg-hover-overlay-strong focus:outline-none focus-visible:bg-hover-overlay-strong ${
                status === value ? tones[value].text : 'text-text'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${tones[value].dot}`} aria-hidden="true" />
              {labels[type][value]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatusDropdown;
