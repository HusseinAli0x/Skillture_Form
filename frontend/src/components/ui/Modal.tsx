import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import IconButton from './IconButton';

interface Props {
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the panel. */
  maxWidth?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Overlay dialog: Escape and backdrop close it, Tab stays inside it, the page
 * behind does not scroll, and focus returns to whatever opened it.
 */
const Modal: React.FC<Props> = ({ title, onClose, children, maxWidth = 'max-w-md' }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Callers almost always pass onClose as an inline lambda, so its identity
  // changes on every render of the caller — including one triggered by a
  // keystroke in a text field this modal contains (e.g. an edit form). This
  // ref lets the effect below read the latest onClose without listing it as
  // a dependency, so the effect body (and the focus call in it) runs once on
  // mount rather than after every keystroke — which otherwise yanked focus off
  // the field being typed into and swallowed the rest of the keystrokes.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    // Stop the page behind the overlay from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // A child with autoFocus (e.g. the safe button of a confirm dialog) wins.
    if (panel && !panel.contains(document.activeElement)) panel.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        // Without this the click would bubble to the overlay and close the
        // dialog whenever the user clicked inside it.
        onClick={e => e.stopPropagation()}
        className={`w-full ${maxWidth} max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-panel shadow-2xl outline-none`}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
            <h2 id={titleId} className="font-semibold text-text text-lg">
              {title}
            </h2>
            <IconButton label="Close" onClick={onClose}>
              <X className="w-4 h-4" />
            </IconButton>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
