import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import AuthGuard from './components/AuthGuard';
import AdminGuard from './components/AdminGuard';
import NavBar from './components/NavBar';
import AdminLayout from './components/AdminLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import HomePage from './pages/HomePage';
import SwipePage from './pages/SwipePage';
import MyDogsPage from './pages/MyDogsPage';
import DogEditorPage from './pages/DogEditorPage';
import DogDetailPage from './pages/DogDetailPage';
import RankingsPage from './pages/RankingsPage';
import LostDogsPage from './pages/LostDogsPage';
import ReportMissingPage from './pages/ReportMissingPage';
import ReportFoundPage from './pages/ReportFoundPage';
import LostReportDetailPage from './pages/LostReportDetailPage';
import UserProfilePage from './pages/UserProfilePage';
import ParksPage from './pages/ParksPage';
import ParkDetailPage from './pages/ParkDetailPage';
import ParkEditorPage from './pages/ParkEditorPage';
import FeedbackWidget from './components/FeedbackWidget';
import ScrollToTop from './components/ScrollToTop';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminTicketsPage from './pages/admin/AdminTicketsPage';
import AdminRescuesPage from './pages/admin/AdminRescuesPage';
import AdminFeedbackPage from './pages/admin/AdminFeedbackPage';
import AdminInvitesPage from './pages/admin/AdminInvitesPage';
import AdminFAQPage from './pages/admin/AdminFAQPage';
import NotFoundPage from './pages/NotFoundPage';

function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <>
      <ScrollToTop />
      {/* Consumer app shell (hidden on admin routes) */}
      {!isAdmin && (
        <div className="mx-auto max-w-app min-h-screen bg-white pb-16">
          <NavBar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/home" element={<AuthGuard><HomePage /></AuthGuard>} />
            <Route path="/swipe" element={<AuthGuard><SwipePage /></AuthGuard>} />
            <Route path="/dogs" element={<AuthGuard><MyDogsPage /></AuthGuard>} />
            <Route path="/dogs/new" element={<AuthGuard><DogEditorPage /></AuthGuard>} />
            <Route path="/dogs/:id" element={<AuthGuard><DogDetailPage /></AuthGuard>} />
            <Route path="/dogs/:id/edit" element={<AuthGuard><DogEditorPage /></AuthGuard>} />
            <Route path="/rankings" element={<AuthGuard><RankingsPage /></AuthGuard>} />
            <Route path="/lost" element={<AuthGuard><LostDogsPage /></AuthGuard>} />
            <Route path="/lost/report-missing" element={<AuthGuard><ReportMissingPage /></AuthGuard>} />
            <Route path="/lost/report-found" element={<AuthGuard><ReportFoundPage /></AuthGuard>} />
            <Route path="/lost/:id" element={<AuthGuard><LostReportDetailPage /></AuthGuard>} />
            <Route path="/users/:id" element={<AuthGuard><UserProfilePage /></AuthGuard>} />
            <Route path="/parks" element={<AuthGuard><ParksPage /></AuthGuard>} />
            <Route path="/parks/new" element={<AuthGuard><ParkEditorPage /></AuthGuard>} />
            <Route path="/parks/:id" element={<AuthGuard><ParkDetailPage /></AuthGuard>} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <FeedbackWidget />
        </div>
      )}

      {/* Admin shell (own layout, full-width) */}
      {isAdmin && (
        <Routes>
          <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="tickets" element={<AdminTicketsPage />} />
            <Route path="rescues" element={<AdminRescuesPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route path="invites" element={<AdminInvitesPage />} />
            <Route path="faq" element={<AdminFAQPage />} />
          </Route>
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
