import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import PublicLayout from './layouts/PublicLayout'
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import CreateForm from './pages/admin/CreateForm'
import FormBuilder from './pages/admin/FormBuilder'
import PublicForm from './pages/public/PublicForm'
import ResponseViewer from './pages/admin/ResponseViewer'

const NotFound = () => <div style={{ padding: '2rem', textAlign: 'center' }}>404 Not Found</div>

import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public Routes */}
                    <Route element={<PublicLayout />}>
                        <Route path="/forms/:id" element={<PublicForm />} />
                    </Route>

                    {/* Admin Routes */}
                    <Route path="/admin/login" element={<Login />} />

                    <Route element={
                        <ProtectedRoute>
                            <AdminLayout />
                        </ProtectedRoute>
                    }>
                        <Route path="/admin/dashboard" element={<Dashboard />} />
                        <Route path="/admin/create-form" element={<CreateForm />} />
                        <Route path="/admin/forms/:id/edit" element={<FormBuilder />} />
                        <Route path="/admin/forms/:id/responses" element={<ResponseViewer />} />
                        {/* Redirect /admin to dashboard */}
                        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                    </Route>

                    {/* Redirect root to admin login for now */}
                    <Route path="/" element={<Navigate to="/admin/login" replace />} />

                    <Route path="*" element={<NotFound />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}

export default App
