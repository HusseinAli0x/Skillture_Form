import React from 'react';
import { Users } from 'lucide-react';
import LanguageSwitcher from '../LanguageSwitcher';
import MuteButton from './MuteButton';
import { useGameLocale } from '../../lib/game/useGameLocale';
import { useLogoSrc } from '../../lib/useSiteContent';

/** Brand, player count, sound, language, and any page-specific actions. */
const HostTopBar: React.FC<{ playerCount: number; children?: React.ReactNode }> = ({ playerCount, children }) => {
  const { G } = useGameLocale();
  const logoSrc = useLogoSrc('icon');
  return (
    <header className="flex items-center justify-between gap-3 flex-wrap px-5 sm:px-8 py-4">
      <div className="flex items-center gap-2.5">
        <img src={logoSrc} alt="" className="w-8 h-8 object-contain" />
        <span className="text-xl font-semibold tracking-tight">Skillture</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full bg-white/10 font-semibold">
          <Users className="w-4 h-4" aria-hidden="true" />
          {G.common.players(playerCount)}
        </span>
        <MuteButton />
        <LanguageSwitcher />
        {children}
      </div>
    </header>
  );
};

export default HostTopBar;
