import { Component, type ReactNode } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider } from './store/AuthContext';
import AuthGuard from './components/AuthGuard';
import AdminGuard from './components/AdminGuard';
import NavBar from './components/NavBar';
import AdminLayout from './components/AdminLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import RescueSignupPage from './pages/RescueSignupPage';
import RescueDashboardPage from './pages/RescueDashboardPage';
import RescueDetailPage from './pages/RescueDetailPage';
import TransfersPage from './pages/TransfersPage';
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
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfileEditPage from './pages/ProfileEditPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import FeedbackWidget from './components/FeedbackWidget';
import ScrollToTop from './components/ScrollToTop';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage';
import AdminContentPage from './pages/admin/AdminContentPage';
import AdminLostReportsPage from './pages/admin/AdminLostReportsPage';
import AdminTicketsPage from './pages/admin/AdminTicketsPage';
import AdminRescuesPage from './pages/admin/AdminRescuesPage';
import AdminFeedbackPage from './pages/admin/AdminFeedbackPage';
import AdminInvitesPage from './pages/admin/AdminInvitesPage';
import AdminFAQPage from './pages/admin/AdminFAQPage';
import AdminBreedsPage from './pages/admin/AdminBreedsPage';
import AdminParksPage from './pages/admin/AdminParksPage';
import AdminAuditPage from './pages/admin/AdminAuditPage';
import NotificationsPage from './pages/NotificationsPage';
import FollowingPage from './pages/FollowingPage';
import RescuesPage from './pages/RescuesPage';
import NotFoundPage from './pages/NotFoundPage';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-500 mb-4">Try refreshing the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <>
      <ScrollToTop />
      {/* Consumer app shell (hidden on admin routes) */}
      {!isAdmin && (
        <div className="mx-auto max-w-app min-h-screen bg-white pb-20 shadow-soft-lg">
          <NavBar />
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <Routes location={location}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/signup-rescue" element={<RescueSignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
                <Route path="/profile/edit" element={<AuthGuard><ProfileEditPage /></AuthGuard>} />
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
                <Route path="/parks/:id/edit" element={<AuthGuard><ParkEditorPage /></AuthGuard>} />
                <Route path="/parks/:id" element={<AuthGuard><ParkDetailPage /></AuthGuard>} />
                <Route path="/notifications" element={<AuthGuard><NotificationsPage /></AuthGuard>} />
                <Route path="/following" element={<AuthGuard><FollowingPage /></AuthGuard>} />
                <Route path="/rescues" element={<AuthGuard><RescuesPage /></AuthGuard>} />
                <Route path="/rescues/:id" element={<AuthGuard><RescueDetailPage /></AuthGuard>} />
                <Route path="/rescue/dashboard" element={<AuthGuard><RescueDashboardPage /></AuthGuard>} />
                <Route path="/transfers" element={<AuthGuard><TransfersPage /></AuthGuard>} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
          {location.pathname === '/home' && <FeedbackWidget />}
        </div>
      )}

      {/* Admin shell (own layout, full-width) */}
      {isAdmin && (
        <Routes>
          <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="content" element={<AdminContentPage />} />
            <Route path="lost" element={<AdminLostReportsPage />} />
            <Route path="tickets" element={<AdminTicketsPage />} />
            <Route path="rescues" element={<AdminRescuesPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route path="invites" element={<AdminInvitesPage />} />
            <Route path="faq" element={<AdminFAQPage />} />
            <Route path="breeds" element={<AdminBreedsPage />} />
            <Route path="parks" element={<AdminParksPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
          </Route>
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
