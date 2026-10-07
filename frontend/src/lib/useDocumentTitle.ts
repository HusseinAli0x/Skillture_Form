import { useEffect } from 'react';

/** Sets the browser tab title for a page, restoring the previous one on leave. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
