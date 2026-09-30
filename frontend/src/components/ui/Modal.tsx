import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import IconButton from './IconButton';

interface Props {
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the panel. */
  maxWidth?: string;
}

/**
 * Overlay dialog.
 *
 * There were three hand-rolled copies of this markup (Dashboard, QuizzesPage,
 * ShareModal), none of which handled Escape, focus, or scroll locking.
 */
const Modal: React.FC<Props> = ({ title, onClose, children, maxWidth = 'max-w-md' }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Callers almost always pass onClose as an inline lambda, so its identity
  // changes on every render of the caller — including one triggered by a
  // keystroke in a text field this modal contains (e.g. an edit form). This
  // ref lets the effect below read the latest onClose without listing it as
  // a dependency, so the effect body (and the panelRef.current.focus() call
  // in it) runs once on mount rather than after every keystroke — which
  // otherwise yanked focus off the field being typed into and swallowed the
  // rest of the keystrokes.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);

    // Stop the page behind the overlay from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // Deliberately mount-only — see onCloseRef above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        // Without this the click would bubble to the overlay and close the
        // dialog whenever the user clicked inside it.
        onClick={e => e.stopPropagation()}
        className={`w-full ${maxWidth} rounded-2xl border border-border bg-panel shadow-2xl outline-none`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-text">{title}</h2>
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
