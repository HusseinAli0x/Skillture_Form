import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import client from '../api/client';
import { TEAM_GROUPS, type TeamMember } from '../api/publicTypes';
import { BTN_INK, H1, H2, WRAP } from '../components/public/layout';
import PublicShell from '../components/public/PublicShell';
import TeamCard from '../components/public/TeamCard';
import { Spinner } from '../components/ui';
import { useLanguageStore } from '../context/LanguageStore';
import { siteStrings } from '../lib/siteStrings';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const TeamPage: React.FC = () => {
  const locale = useLanguageStore(s => s.locale);
  const S = siteStrings[locale].team;
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [failed, setFailed] = useState(false);

  useDocumentTitle(S.metaTitle);

  useEffect(() => {
    client
      .get<TeamMember[]>('/api/v1/team')
      .then(res => setMembers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setFailed(true));
  }, []);

  return (
    <PublicShell>
      <section className={`${WRAP} pt-14 sm:pt-20 pb-12 sm:pb-16`}>
        <h1 className={`${H1} max-w-3xl`}>{S.title}</h1>
        <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed text-pretty">{S.subtitle}</p>
      </section>

      <div className={`${WRAP} pb-20`}>
        {failed ? (
          <p role="alert" className="text-muted py-12">
            {S.loadError}
          </p>
        ) : members === null ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : members.length === 0 ? (
          <div className="border-t border-border py-12">
            <p className="font-semibold">{S.emptyTitle}</p>
            <p className="mt-1 text-muted max-w-md">{S.emptyDescription}</p>
          </div>
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
                <section key={group} aria-labelledby={`team-${group}`} className="border-t border-ink pt-5">
                  <h2 id={`team-${group}`} className="text-xl font-semibold mb-8">
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

      <section className="bg-brand text-ink">
        <div className={`${WRAP} py-14 sm:py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-8`}>
          <div className="max-w-2xl">
            <h2 className={H2}>{S.join.title}</h2>
            <p className="mt-3 text-lg">{S.join.body}</p>
          </div>
          <Link to="/#contact" className={`${BTN_INK} shrink-0`}>
            {S.join.button}
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
};

export default TeamPage;
