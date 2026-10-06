import React from 'react';
import { Logo, Pattern } from '../brand';
import type { SocketStatus } from '../../api/ws';
import './game.css';

/** Coral is for LIVE and wrong answers — this is the one place a screen says "live". */
export const LiveBadge: React.FC<{ label?: string }> = ({ label = 'Live' }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-danger-border bg-danger-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-danger">
    <span aria-hidden="true" className="game-live h-2 w-2 rounded-full bg-danger" />
    {label}
  </span>
);

/** Connection state as a small chip; never hidden while the link is down. */
export const ConnectionChip: React.FC<{ status: SocketStatus; className?: string }> = ({ status, className = '' }) => {
  const ok = status === 'open';
  const text = ok ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Reconnecting…';
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        ok ? 'border-primary-border-soft text-muted' : 'border-warning-border bg-warning-soft text-warning'
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${ok ? 'bg-primary' : 'game-live bg-warning'}`}
      />
      {text}
    </span>
  );
};

interface Props {
  children: React.ReactNode;
  /** Right side of the top bar. */
  right?: React.ReactNode;
  /** Text next to the logo, e.g. the quiz name. */
  title?: string;
  /** Pattern strength; the join screens show it, the question screens barely. */
  pattern?: 'off' | 'faint' | 'soft';
  /** Pass the socket status to get the "reconnecting" banner on a dropped link. */
  status?: SocketStatus;
  className?: string;
  /** Skip the top bar (the screen draws its own header). */
  bare?: boolean;
}

/** The black canvas every game screen sits on. */
const GameShell: React.FC<Props> = ({ children, right, title, pattern = 'faint', status, className = '', bare = false }) => {
  const dropped = status === 'reconnecting';
  return (
    <div className={`game-screen relative flex flex-col overflow-hidden bg-bg text-text ${className}`}>
      {pattern !== 'off' && (
        <Pattern className={`text-white ${pattern === 'soft' ? 'opacity-[0.06]' : 'opacity-[0.03]'}`} />
      )}
      {dropped && (
        <div
          role="status"
          className="relative z-20 border-b border-warning-border bg-warning-soft px-4 py-2 text-center text-sm font-medium text-warning"
        >
          Connection lost. Reconnecting — your place is saved.
        </div>
      )}
      {!bare && (
        <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo variant="icon" decorative className="h-7 text-primary" />
            <span className="truncate font-display text-lg font-bold tracking-wide">{title ?? 'Skillture'}</span>
          </div>
          {right}
        </header>
      )}
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
};

export default GameShell;
