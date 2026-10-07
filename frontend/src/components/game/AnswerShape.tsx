import React from 'react';
import type { AnswerShapeName } from '../../lib/game/answers';

/** The four answer shapes as crisp SVG, filled with the current text colour. */
const AnswerShape: React.FC<{ shape: AnswerShapeName; className?: string }> = ({ shape, className = 'w-8 h-8' }) => {
  const common = { className, fill: 'currentColor', 'aria-hidden': true, viewBox: '0 0 24 24' } as const;
  switch (shape) {
    case 'triangle':
      return (
        <svg {...common}>
          <path d="M12 3 22 21H2z" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...common}>
          <path d="M12 1 23 12 12 23 1 12z" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      );
  }
};

export default AnswerShape;
