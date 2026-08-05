import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
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
import FormPreview from './pages/FormPreview';
import QuizJoinHandler from './pages/QuizJoinHandler';
import { useAuthStore } from './context/AuthStore';
import ToastContainer from './components/Toast';
import HostLiveBoard from './pages/HostLiveBoard';
import PlayerLiveBoard from './pages/PlayerLiveBoard';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/admin/dashboard" />} />
        <Route path="/preview/form/:id" element={<FormPreview />} />
        <Route path="/quiz/:id" element={<QuizJoinHandler />} />
        <Route path="/play" element={<PlayerJoin />} />
        <Route path="/play/:sessionId" element={<PlayerLiveBoard />} />
        <Route path="/host/lobby/:sessionId" element={<GameLobby />} />
        <Route path="/host/live/:sessionId" element={<HostLiveBoard />} />

        {/* Protected Admin Routes */}
        <Route path="/admin" element={<MainLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="homepage" element={<HomepageEditor />} />
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
