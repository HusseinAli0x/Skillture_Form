import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import client from '../api/client';
import { TEAM_GROUPS, type TeamMember } from '../api/publicTypes';
import { Pattern, brandAssets } from '../components/brand';
import { BTN_INK, H1, H2, WRAP } from '../components/public/layout';
import { EmptyBlock, LoadError, PeopleSkeleton } from '../components/public/PageState';
import PublicShell from '../components/public/PublicShell';
import TeamCard from '../components/public/TeamCard';
import { useLanguageStore } from '../context/LanguageStore';
import { siteStrings } from '../lib/siteStrings';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const TeamPage: React.FC = () => {
  const locale = useLanguageStore(s => s.locale);
  const S = siteStrings[locale].team;
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [failed, setFailed] = useState(false);

  useDocumentTitle(S.metaTitle);

  const load = useCallback(() => {
    setFailed(false);
    setMembers(null);
    let cancelled = false;
    client
      .get<TeamMember[]>('/api/v1/team')
      .then(res => !cancelled && setMembers(Array.isArray(res.data) ? res.data : []))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  return (
    <PublicShell>
      <section className={`${WRAP} pt-12 sm:pt-16 pb-12 sm:pb-16`}>
        <h1 className={`${H1} max-w-3xl`}>{S.title}</h1>
        <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed text-pretty">{S.subtitle}</p>
      </section>

      <div className={`${WRAP} pb-20`}>
        {failed ? (
          <LoadError message={S.loadError} onRetry={load} />
        ) : members === null ? (
          <PeopleSkeleton />
        ) : members.length === 0 ? (
          <EmptyBlock
            title={S.emptyTitle}
            body={S.emptyDescription}
            action={
              <Link to="/#contact" className={BTN_INK}>
                {S.join.button}
                <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-16">
            {TEAM_GROUPS.map(group => {
              const people = members.filter(m => m.group === group);
              if (people.length === 0) return null;
              // Leadership gets larger portraits; everyone else is a denser grid.
              const grid =
                group === 'leadership'
                  ? 'grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10'
                  : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-9';
              return (
                <section key={group} aria-labelledby={`team-${group}`} className="border-t-4 border-brand pt-5">
                  <h2 id={`team-${group}`} className="text-2xl mb-8">
                    {S.groups[group]}
                  </h2>
                  <div className={`grid ${grid}`}>
                    {people.map(m => (
                      <TeamCard key={m.id} member={m} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <section className="on-brand relative overflow-hidden">
        <Pattern className="text-ink opacity-[0.045]" />
        <div className={`${WRAP} relative py-14 sm:py-16 grid md:grid-cols-[1.1fr_1fr] gap-10 md:gap-14 items-center`}>
          <div>
            <h2 className={H2}>{S.join.title}</h2>
            <p className="mt-3 text-lg max-w-xl">{S.join.body}</p>
            <Link to="/#contact" className={`${BTN_INK} mt-8`}>
              {S.join.button}
              <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
          <img
            src={brandAssets.stationery}
            alt={S.stationeryAlt}
            width={1665}
            height={937}
            loading="lazy"
            className="w-full aspect-[16/10] object-cover rounded-2xl"
          />
        </div>
      </section>
    </PublicShell>
  );
};

export default TeamPage;
