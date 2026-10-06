import React from 'react';
import { Check, X } from 'lucide-react';
import { answerStyle, type ShapeName } from './gameLogic';
import './game.css';

export const Shape: React.FC<{ shape: ShapeName; className?: string }> = ({ shape, className = 'h-7 w-7' }) => {
  const common = { fill: 'currentColor', className, 'aria-hidden': true as const, viewBox: '0 0 24 24' };
  switch (shape) {
    case 'triangle':
      return (
        <svg {...common}>
          <path d="M12 3 22 21H2z" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.5" />
        </svg>
      );
    case 'square':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="1.5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...common}>
          <path d="M12 1.5 22.5 12 12 22.5 1.5 12z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 8.6l7.1-.6z" />
        </svg>
      );
  }
};

interface Props {
  index: number;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** This is the option the player picked. */
  selected?: boolean;
  /** Reveal state: `correct` shows a check, `wrong` dims and crosses, undefined is neutral. */
  reveal?: 'correct' | 'wrong';
  /** Host projection: not a button, larger type. */
  display?: boolean;
}

const AnswerTile: React.FC<Props> = ({ index, label, onClick, disabled, selected, reveal, display = false }) => {
  const s = answerStyle(index);
  const dimmed = reveal === 'wrong' || (disabled && !selected && !reveal);
  const cls = [
    'game-motion relative flex w-full items-center gap-4 text-start font-display font-bold text-ink transition-[transform,opacity,box-shadow]',
    display ? 'min-h-24 rounded-2xl px-6 py-4 text-3xl' : 'min-h-[5.25rem] rounded-2xl px-5 py-4 text-xl',
    !display && !disabled ? 'active:scale-[0.97]' : '',
    dimmed ? 'opacity-35' : '',
    selected ? 'ring-4 ring-white ring-offset-2 ring-offset-bg' : '',
    reveal === 'correct' ? 'game-pop ring-4 ring-white ring-offset-2 ring-offset-bg' : '',
  ].join(' ');
  const inner = (
    <>
      <Shape shape={s.shape} className={display ? 'h-10 w-10 shrink-0' : 'h-7 w-7 shrink-0'} />
      <span className="min-w-0 flex-1 break-words leading-tight">{label}</span>
      {reveal === 'correct' && <Check className="h-8 w-8 shrink-0" aria-label="Correct answer" strokeWidth={3.5} />}
      {reveal === 'wrong' && selected && <X className="h-7 w-7 shrink-0" aria-label="Your answer" strokeWidth={3.5} />}
    </>
  );

  if (display) {
    return (
      <div className={cls} style={{ backgroundColor: s.bg }}>
        {inner}
      </div>
    );
  }
  return (
    <button type="button" className={cls} style={{ backgroundColor: s.bg }} onClick={onClick} disabled={disabled} aria-pressed={selected}>
      {inner}
    </button>
  );
};

export default AnswerTile;
