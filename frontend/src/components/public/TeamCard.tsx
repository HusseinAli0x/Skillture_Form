import React from 'react';
import type { TeamMember } from '../../api/publicTypes';
import { useLanguageStore } from '../../context/LanguageStore';
import { localized } from '../../lib/i18n';
import { siteStrings } from '../../lib/siteStrings';

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

// Flat fills for people without a photo yet. Picked by id so a person keeps
// the same colour; each pair is text-on-fill with strong contrast.
const FALLBACKS = [
  'bg-brand text-ink',
  'bg-mark text-ink',
  'bg-ink text-white',
  'bg-panel-3 text-ink',
];
const fallbackFor = (id: string) => FALLBACKS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % FALLBACKS.length];

/** Portrait first: the photo is the content, the text sits quietly under it. */
const TeamCard: React.FC<{ member: TeamMember }> = ({ member }) => {
  const locale = useLanguageStore(s => s.locale);
  const S = siteStrings[locale];
  const name = localized(member.name, '', locale);
  const bio = localized(member.bio, '', locale);

  return (
    <article>
      <div className="aspect-[4/5] overflow-hidden rounded-md bg-panel-2">
        {member.photo_path ? (
          <img src={member.photo_path} alt={name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className={`w-full h-full flex items-center justify-center text-6xl font-semibold ${fallbackFor(member.id)}`}
          >
            {initialsOf(name)}
          </div>
        )}
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-tight">{name}</h3>
      <p className="mt-1 text-sm text-muted">{localized(member.role, '', locale)}</p>
      {bio && <p className="mt-3 text-sm leading-relaxed line-clamp-4 text-pretty">{bio}</p>}
      {member.linkedin_url && (
        <a
          href={member.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={S.team.linkedin(name)}
          className="mt-3 inline-flex items-center min-h-11 text-sm font-medium underline underline-offset-4 decoration-1 hover:text-primary transition-colors"
        >
          LinkedIn
        </a>
      )}
    </article>
  );
};

export default TeamCard;
