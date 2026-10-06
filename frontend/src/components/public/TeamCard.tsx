import React from 'react';
import type { TeamMember } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';
import { localized } from '../../lib/i18n';
import { siteStrings } from '../../lib/siteStrings';
import LinkedInIcon from './LinkedInIcon';

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

/** Photo (or initials fallback) in a rounded square. */
export const Avatar: React.FC<{ member: TeamMember; className?: string }> = ({ member, className = '' }) => {
  const locale = useLanguageStore(s => s.locale);
  const name = localized(member.name, '', locale);
  return member.photo_path ? (
    <img src={member.photo_path} alt={name} loading="lazy" className={`object-cover ${className}`} />
  ) : (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center bg-primary-soft text-primary font-bold border border-primary-border ${className}`}
    >
      {initialsOf(name)}
    </div>
  );
};

const TeamCard: React.FC<{ member: TeamMember }> = ({ member }) => {
  const locale = useLanguageStore(s => s.locale);
  const S = siteStrings[locale];
  const name = localized(member.name, '', locale);
  const bio = localized(member.bio, '', locale);

  return (
    <article className="bg-panel border border-border rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-primary-border hover:shadow-lg">
      <Avatar member={member} className="w-full aspect-square text-5xl rounded-none" />
      <div className="p-5 flex flex-col gap-1.5 flex-1">
        <h3 className="text-lg font-bold text-text leading-tight">{name}</h3>
        <p className="text-sm font-semibold text-primary">{localized(member.role, '', locale)}</p>
        {bio && <p className="text-sm leading-relaxed text-muted mt-1.5 line-clamp-4 text-pretty">{bio}</p>}
        {member.linkedin_url && (
          <a
            href={member.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={S.team.linkedin(name)}
            className="mt-auto pt-3 inline-flex items-center justify-center w-11 h-11 -ms-3 rounded-lg text-muted hover:text-primary transition-colors"
          >
            <LinkedInIcon className="w-5 h-5" />
          </a>
        )}
      </div>
    </article>
  );
};

export default TeamCard;
