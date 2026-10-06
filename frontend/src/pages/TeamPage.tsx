import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Users } from 'lucide-react';
import client from '../api/client';
import { TEAM_GROUPS, type TeamMember } from '../api/publicTypes';
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
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-10 text-center">
        <p className="text-xs font-bold tracking-[.14em] uppercase text-primary mb-3">{S.kicker}</p>
        <h1
          className="font-extrabold tracking-tight text-text mb-4 text-pretty"
          style={{ fontSize: 'clamp(30px,5vw,46px)' }}
        >
          {S.title}
        </h1>
        <p className="text-base sm:text-lg leading-relaxed text-muted max-w-2xl mx-auto text-pretty">{S.subtitle}</p>
      </section>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 pb-20">
        {failed ? (
          <p role="alert" className="text-center text-muted py-16">
            {S.loadError}
          </p>
        ) : members === null ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-6 border border-dashed border-border rounded-2xl">
            <Users className="w-9 h-9 text-muted mb-4" />
            <p className="font-semibold text-text mb-1.5">{S.emptyTitle}</p>
            <p className="text-sm text-muted max-w-sm text-pretty">{S.emptyDescription}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-14">
            {TEAM_GROUPS.map(group => {
              const people = members.filter(m => m.group === group);
              if (people.length === 0) return null;
              return (
                <section key={group} aria-labelledby={`team-${group}`}>
                  <h2 id={`team-${group}`} className="text-xl font-bold text-text mb-5 flex items-center gap-3">
                    {S.groups[group]}
                    <span className="h-px flex-1 bg-border" />
                  </h2>
                  <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-5">
                    {people.map(m => (
                      <TeamCard key={m.id} member={m} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="mt-16 bg-panel border border-border rounded-2xl px-6 py-9 sm:px-10 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-text mb-2 text-pretty">{S.join.title}</h2>
          <p className="text-muted mb-6 max-w-lg mx-auto text-pretty">{S.join.body}</p>
          <Link
            to="/#contact"
            className="inline-flex items-center justify-center gap-2 min-h-11 px-6 rounded-lg bg-primary text-bg font-semibold hover:bg-primary-hover transition-colors"
          >
            {S.join.button}
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </PublicShell>
  );
};

export default TeamPage;
