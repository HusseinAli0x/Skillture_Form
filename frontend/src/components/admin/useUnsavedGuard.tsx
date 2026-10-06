import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmDialog } from '../ui';

/**
 * Stops an admin losing edits by navigating away.
 *
 * The app mounts a plain <BrowserRouter>, which has no navigation blocker, so
 * two cases are covered by hand: closing/reloading the tab (the browser's own
 * beforeunload prompt) and clicking any in-app link (intercepted, then a
 * confirm dialog). Browser Back is not interceptable here.
 *
 * Render the returned `guard` anywhere in the page.
 */
export function useUnsavedGuard(dirty: boolean): { guard: React.ReactNode } {
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required by some browsers to show the prompt.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const next = url.pathname + url.search + url.hash;
      if (next === window.location.pathname + window.location.search + window.location.hash) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(next);
    };
    // Capture phase, so this runs before React Router's own <Link> handler.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty]);

  const guard = pending ? (
    <ConfirmDialog
      title="Leave without saving?"
      message="You have unsaved changes on this page. If you leave now they will be lost."
      confirmLabel="Leave and discard"
      cancelLabel="Keep editing"
      destructive
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const to = pending;
        setPending(null);
        navigate(to);
      }}
    />
  ) : null;

  return { guard };
}
