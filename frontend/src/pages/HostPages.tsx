import React from 'react';
import PublicShell from '../components/public/PublicShell';
import { WRAP } from '../components/public/layout';
import FormQuizBuilder from './FormQuizBuilder';
import QuizzesPage from './QuizzesPage';

/**
 * Hosting a game without an account: the same list and builder the dashboard
 * uses, in `public` mode and inside the public site's frame. The dashboard
 * keeps MainLayout; nothing here needs a sign-in.
 */
const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PublicShell>
    <div className={`${WRAP} py-10 sm:py-14`}>{children}</div>
  </PublicShell>
);

/** /create: the games created in this browser. */
export const MyGamesPage: React.FC = () => (
  <Frame>
    <QuizzesPage mode="public" />
  </Frame>
);

/** /create/new and /create/:id. */
export const GameBuilderPage: React.FC = () => (
  <Frame>
    <FormQuizBuilder mode="public" />
  </Frame>
);
