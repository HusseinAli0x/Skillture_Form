import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { useAuthStore } from './context/AuthStore';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
        />

        <Route path="/join" element={<PlayerJoin />} />

        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Forms */}
          <Route path="forms" element={<FormsPage />} />
          <Route path="forms/new" element={<FormBuilder />} />
          <Route path="forms/:id" element={<FormDetailPage />} />
          <Route path="forms/:id/edit" element={<FormBuilder />} />

          {/* Quiz Game */}
          <Route path="quizzes" element={<QuizzesPage />} />
          <Route path="builder" element={<FormQuizBuilder />} />
          <Route path="quizzes/:id/edit" element={<FormQuizBuilder />} />
          <Route path="host/lobby/:id" element={<GameLobby />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
