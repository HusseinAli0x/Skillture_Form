import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLanguageStore } from '../../context/LanguageStore';
import { siteStrings } from '../../lib/siteStrings';

interface Props {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** Full-screen photo viewer: Esc closes, arrow keys and buttons move. */
const Lightbox: React.FC<Props> = ({ images, index, onIndexChange, onClose }) => {
  const locale = useLanguageStore(s => s.locale);
  const S = siteStrings[locale].workshop;
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = images.length;
  // Physical arrows: in RTL the "next" side is on the left.
  const rtl = locale === 'ar';

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const go = (delta: number) => onIndexChange((index + delta + count) % count);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(rtl ? -1 : 1);
      else if (e.key === 'ArrowLeft') go(rtl ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, rtl, onClose, onIndexChange]);

  const step = (delta: number) => onIndexChange((index + delta + count) % count);
  const btn =
    'absolute top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={S.photo(index + 1, count)}
      dir="ltr"
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={S.close}
        className="absolute top-4 right-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
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
