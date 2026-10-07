import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLanguageStore } from '../../context/LanguageStore';
import { useSiteStrings } from '../../lib/useSiteContent';

interface Props {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** Full-screen photo viewer: Esc closes, arrow keys and buttons move. */
const Lightbox: React.FC<Props> = ({ images, index, onIndexChange, onClose }) => {
  const locale = useLanguageStore(s => s.locale);
  const S = useSiteStrings().workshop;
  const closeRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const count = images.length;
  // Physical arrows: in RTL the "next" side is on the left.
  const rtl = locale === 'ar';

  useEffect(() => {
    // Remember what opened the viewer so focus goes back there on close.
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const go = (delta: number) => onIndexChange((index + delta + count) % count);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Tab') {
        // Keep Tab inside the dialog.
        const items = rootRef.current?.querySelectorAll<HTMLElement>('button');
        if (!items?.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === 'ArrowRight') go(rtl ? -1 : 1);
      else if (e.key === 'ArrowLeft') go(rtl ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, rtl, onClose, onIndexChange]);

  const step = (delta: number) => onIndexChange((index + delta + count) % count);
  const btn =
    'absolute top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand';

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={S.photo(index + 1, count)}
      dir="ltr"
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
      onTouchStart={e => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={e => {
        // A horizontal swipe moves between photos on phones.
        if (touchX.current === null || count < 2) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={S.close}
        className="absolute top-4 right-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={images[index]}
        alt={S.photo(index + 1, count)}
        className="max-h-[85dvh] max-w-full object-contain rounded-lg"
        onClick={e => e.stopPropagation()}
      />
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              step(rtl ? 1 : -1);
            }}
            aria-label={rtl ? S.next : S.prev}
            className={`${btn} left-3`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              step(rtl ? -1 : 1);
            }}
            aria-label={rtl ? S.prev : S.next}
            className={`${btn} right-3`}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <p className="absolute bottom-4 inset-x-0 text-center text-sm text-white/80" aria-live="polite">
            {index + 1} / {count}
          </p>
        </>
      )}
    </div>
  );
};

export default Lightbox;
