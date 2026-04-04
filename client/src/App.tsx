import { Routes, Route } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import SubscribePage from './pages/SubscribePage';
import ScoresPage from './pages/ScoresPage';
import CharitiesPage from './pages/CharitiesPage';
import DrawsPage from './pages/DrawsPage';
import AdminPage from './pages/AdminPage';
import { useAuthStore } from './store/auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  return isAuthenticated && user?.role === 'admin' ? <>{children}</> : <Navigate to="/dashboard" />;
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/charities" element={<CharitiesPage />} />
        <Route path="/draws" element={<DrawsPage />} />
        <Route 
          path="/scores" 
          element={
            <ProtectedRoute>
              <ScoresPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          } 
        />
      </Routes>
    </Layout>
  );
}

export default App;
