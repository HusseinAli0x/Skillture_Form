import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useSiteStore } from './context/SiteStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FormQuizBuilder from './pages/FormQuizBuilder';
import FormBuilder from './pages/FormBuilder';
import FormsPage from './pages/FormsPage';
import FormDetailPage from './pages/FormDetailPage';
import QuizzesPage from './pages/QuizzesPage';
import GameLobby from './pages/GameLobby';
import PlayerJoin from './pages/PlayerJoin';
import MainLayout from './components/layout/MainLayout';
import HomePage from './pages/HomePage';
import HomepageEditor from './pages/HomepageEditor';
import SiteContentAdmin from './pages/SiteContentAdmin';
import WorkshopsAdmin from './pages/WorkshopsAdmin';
import TeamAdmin from './pages/TeamAdmin';
import TeamPage from './pages/TeamPage';
import OurWorkPage from './pages/OurWorkPage';
import WorkshopDetailPage from './pages/WorkshopDetailPage';
import ContactMessagesAdmin from './pages/ContactMessagesAdmin';
import FormPreview from './pages/FormPreview';
import QuizJoinHandler from './pages/QuizJoinHandler';
import ToastContainer from './components/Toast';
import HostLiveBoard from './pages/HostLiveBoard';
import PlayerLiveBoard from './pages/PlayerLiveBoard';
import { GameBuilderPage, MyGamesPage } from './pages/HostPages';

function App() {
  // Admin-edited wording, images and contact links. Every page reads them.
  useEffect(() => {
    void useSiteStore.getState().load();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/our-work" element={<OurWorkPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/workshops/:id" element={<WorkshopDetailPage />} />
        {/* Login redirects an already-signed-in admin itself, back to where they were. */}
        <Route path="/login" element={<Login />} />
        <Route path="/preview/form/:id" element={<FormPreview />} />
        <Route path="/quiz/:id" element={<QuizJoinHandler />} />
        {/* Anyone can create and host a game; the browser's host key is the identity. */}
        <Route path="/create" element={<MyGamesPage />} />
        <Route path="/create/new" element={<GameBuilderPage />} />
        <Route path="/create/:id" element={<GameBuilderPage />} />
        <Route path="/play" element={<PlayerJoin />} />
        <Route path="/play/:sessionId" element={<PlayerLiveBoard />} />
        <Route path="/host/lobby/:sessionId" element={<GameLobby />} />
        <Route path="/host/live/:sessionId" element={<HostLiveBoard />} />

        {/* Protected Admin Routes */}
        <Route path="/admin" element={<MainLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="homepage" element={<HomepageEditor />} />
          <Route path="site" element={<SiteContentAdmin />} />
          <Route path="workshops" element={<WorkshopsAdmin />} />
          <Route path="team" element={<TeamAdmin />} />
          <Route path="messages" element={<ContactMessagesAdmin />} />
          <Route path="forms" element={<FormsPage />} />
          <Route path="forms/new" element={<FormBuilder />} />
          <Route path="forms/:id/edit" element={<FormBuilder />} />
          <Route path="forms/:id" element={<FormDetailPage />} />
          <Route path="quizzes" element={<QuizzesPage />} />
          <Route path="builder" element={<FormQuizBuilder />} />
          <Route path="builder/:id" element={<FormQuizBuilder />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
