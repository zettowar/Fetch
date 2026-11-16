import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from './store/AuthContext';
import { ThemeProvider } from './store/ThemeContext';
import AuthGuard from './components/AuthGuard';
import AdminGuard from './components/AdminGuard';
import AdminLayout from './components/AdminLayout';
import AppShell from './components/AppShell';
import ScrollToTop from './components/ScrollToTop';
import ImpersonationBanner from './components/ImpersonationBanner';
import MaintenanceBanner from './components/MaintenanceBanner';
import FlagGate from './components/FlagGate';

// Marketing website (web-first, unauthenticated front door)
import MarketingLayout from './marketing/MarketingLayout';
import MarketingHome from './marketing/MarketingHome';
import PublicPetPage from './marketing/PublicPetPage';
import TagLandingPage from './marketing/TagLandingPage';
import AuthLayout from './marketing/AuthLayout';

// Auth screens
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// Authenticated app pages
import HomePage from './pages/HomePage';
import SwipePage from './pages/SwipePage';
import MyPetsPage from './pages/MyPetsPage';
import PetDetailPage from './pages/PetDetailPage';
import RankingsPage from './pages/RankingsPage';

// Admin pages

import NotFoundPage from './pages/NotFoundPage';

// Route-level code splitting. The admin panel and every map-bearing page are
// pulled out of the main bundle: maplibre-gl alone is ~1 MB, and an
// unauthenticated visitor reading the marketing site was downloading it (plus
// the whole admin tree) before anything rendered.
//
// The same goes for everything that isn't a front door. What stays in the main
// bundle is what a first visit can land on and must paint at once: the
// marketing home, the public pet page and the QR-tag page (a stranger holding
// a lost pet, possibly on one bar of signal), log in and sign up, and the
// app's core loop — Home, Swipe, a pet, My pets, Rankings. The legal pages,
// the editor, the shop, donations, account settings and the rest load when
// asked for; the commonly used ones are warmed once the shell is idle (below).
// That took the main bundle from 896 kB to 700 kB.
const AboutPage = lazy(() => import('./marketing/AboutPage'));
const MissionPage = lazy(() => import('./marketing/MissionPage'));
const NewsPage = lazy(() => import('./marketing/NewsPage'));
const PrivacyPage = lazy(() => import('./marketing/PrivacyPage'));
const TermsPage = lazy(() => import('./marketing/TermsPage'));
const PublicRescuePage = lazy(() => import('./marketing/PublicRescuePage'));
const RescueSignupPage = lazy(() => import('./pages/RescueSignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ConfirmEmailChangePage = lazy(() => import('./pages/ConfirmEmailChangePage'));
const OAuthCallbackPage = lazy(() => import('./pages/OAuthCallbackPage'));
const LikedPetsPage = lazy(() => import('./pages/LikedPetsPage'));
const RescueDashboardPage = lazy(() => import('./pages/RescueDashboardPage'));
const TransfersPage = lazy(() => import('./pages/TransfersPage'));
const PetEditorPage = lazy(() => import('./pages/PetEditorPage'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const ProfileEditPage = lazy(() => import('./pages/ProfileEditPage'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const FollowingPage = lazy(() => import('./pages/FollowingPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const RescuesHubPage = lazy(() => import('./pages/RescuesHubPage'));
const RescuesPage = lazy(() => import('./pages/RescuesPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const DonatePage = lazy(() => import('./pages/DonatePage'));
const DonateReturnPage = lazy(() => import('./pages/DonateReturnPage'));
const DonationHistoryPage = lazy(() => import('./pages/DonationHistoryPage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const ShopProductPage = lazy(() => import('./pages/ShopProductPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const TicketThreadPage = lazy(() => import('./pages/TicketThreadPage'));
const UnsubscribePage = lazy(() => import('./marketing/UnsubscribePage'));
const PostsPage = lazy(() => import('./pages/PostsPage'));
const PostDetailPage = lazy(() => import('./pages/PostDetailPage'));
const AdminAnnouncementsPage = lazy(() => import('./pages/admin/AdminAnnouncementsPage'));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage'));
const AdminBreedsPage = lazy(() => import('./pages/admin/AdminBreedsPage'));
const AdminContentPage = lazy(() => import('./pages/admin/AdminContentPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminDonationsPage = lazy(() => import('./pages/admin/AdminDonationsPage'));
const AdminFAQPage = lazy(() => import('./pages/admin/AdminFAQPage'));
const AdminFeedbackPage = lazy(() => import('./pages/admin/AdminFeedbackPage'));
const AdminInquiriesPage = lazy(() => import('./pages/admin/AdminInquiriesPage'));
const AdminInvitesPage = lazy(() => import('./pages/admin/AdminInvitesPage'));
const AdminLostReportsPage = lazy(() => import('./pages/admin/AdminLostReportsPage'));
const AdminNewsPage = lazy(() => import('./pages/admin/AdminNewsPage'));
const AdminParksPage = lazy(() => import('./pages/admin/AdminParksPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));
const AdminRescuesPage = lazy(() => import('./pages/admin/AdminRescuesPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminSystemPage = lazy(() => import('./pages/admin/AdminSystemPage'));
const AdminTagsPage = lazy(() => import('./pages/admin/AdminTagsPage'));
const AdminTicketsPage = lazy(() => import('./pages/admin/AdminTicketsPage'));
const AdminTraitsPage = lazy(() => import('./pages/admin/AdminTraitsPage'));
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminVetsPage = lazy(() => import('./pages/admin/AdminVetsPage'));
const LostPetsPage = lazy(() => import('./pages/LostPetsPage'));
const LostReportDetailPage = lazy(() => import('./pages/LostReportDetailPage'));
const ParkDetailPage = lazy(() => import('./pages/ParkDetailPage'));
const ParkEditorPage = lazy(() => import('./pages/ParkEditorPage'));
const ParksPage = lazy(() => import('./pages/ParksPage'));
const ReportFoundPage = lazy(() => import('./pages/ReportFoundPage'));
const ReportMissingPage = lazy(() => import('./pages/ReportMissingPage'));
const RescueDetailPage = lazy(() => import('./pages/RescueDetailPage'));
const RescuesMapPage = lazy(() => import('./pages/RescuesMapPage'));
const VetDetailPage = lazy(() => import('./pages/VetDetailPage'));
const VetsPage = lazy(() => import('./pages/VetsPage'));

// Fetched once the app shell has gone quiet, so the first tap on these doesn't
// wait on the network. `lazy()` and these calls share the module cache.
const WARM_WHEN_IDLE = [
  () => import('./pages/RescuesHubPage'),
  () => import('./pages/NotificationsPage'),
  () => import('./pages/UserProfilePage'),
  () => import('./pages/FollowingPage'),
  () => import('./pages/LikedPetsPage'),
  () => import('./pages/PetEditorPage'),
];

function WarmAppRoutes() {
  useEffect(() => {
    // Not on a metered or data-saving connection: this is a nicety.
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const run = () => WARM_WHEN_IDLE.forEach((load) => void load().catch(() => undefined));
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 2000);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

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
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-biscuit dark:bg-night text-navy dark:text-biscuit">
          <h1 className="font-plain text-2xl mb-2">Something went wrong</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">It's us, not you. Try refreshing the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Shown while a lazily-loaded route chunk is fetched. Deliberately quiet —
 *  on a warm cache these resolve in a frame and a spinner would only flash. */
function RouteFallback() {
  return <div className="min-h-[50vh]" aria-busy="true" aria-live="polite" />;
}

function AppContent() {
  return (
    <>
      <ScrollToTop />
      <ImpersonationBanner />
      <MaintenanceBanner />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* ── Marketing website — web-first, for everyone (logged out) ── */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<MarketingHome />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/mission" element={<MissionPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/unsubscribe/:token" element={<UnsubscribePage />} />
          {/* Public read-only share pages — no session required. */}
          <Route path="/pets/:petId" element={<PublicPetPage />} />
          <Route path="/rescue/:slug" element={<PublicRescuePage />} />
          {/* QR tag scan destination — resolves to the linked pet, or a claim prompt. */}
          <Route path="/t/:code" element={<TagLandingPage />} />
          {/* Unknown public URL — 404 inside the site chrome. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* ── Auth — centered, responsive ── */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/signup-rescue" element={<RescueSignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
          {/* SSO handoff landing — exchanges the one-time code for a session. */}
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        </Route>

        {/* ── Authenticated web app — mobile-portrait shell, session required ── */}
        <Route
          path="/app"
          element={
            <AuthGuard>
              <WarmAppRoutes />
              <AppShell />
            </AuthGuard>
          }
        >
          {/* Bare /app has no page of its own — without this it rendered the
              shell (top bar + tab bar) around nothing. HomePage forwards
              rescue accounts on to their dashboard. */}
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="profile/edit" element={<ProfileEditPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="swipe" element={<SwipePage />} />
          <Route path="pets" element={<MyPetsPage />} />
          <Route path="pets/new" element={<PetEditorPage />} />
          <Route path="pets/:id" element={<PetDetailPage />} />
          <Route path="pets/:id/edit" element={<PetEditorPage />} />
          <Route path="rankings" element={<RankingsPage />} />
          <Route path="lost" element={<LostPetsPage />} />
          <Route path="lost/report-missing" element={<ReportMissingPage />} />
          <Route path="lost/report-found" element={<ReportFoundPage />} />
          <Route path="lost/:id" element={<LostReportDetailPage />} />
          <Route path="users/:id" element={<UserProfilePage />} />
          <Route path="parks" element={<FlagGate flag="explore_parks_enabled"><ParksPage /></FlagGate>} />
          <Route path="parks/new" element={<FlagGate flag="explore_parks_enabled"><ParkEditorPage /></FlagGate>} />
          <Route path="parks/:id/edit" element={<FlagGate flag="explore_parks_enabled"><ParkEditorPage /></FlagGate>} />
          <Route path="parks/:id" element={<FlagGate flag="explore_parks_enabled"><ParkDetailPage /></FlagGate>} />
          <Route path="vets" element={<FlagGate flag="explore_vets_enabled"><VetsPage /></FlagGate>} />
          <Route path="vets/:id" element={<FlagGate flag="explore_vets_enabled"><VetDetailPage /></FlagGate>} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="following" element={<FollowingPage />} />
          <Route path="explore" element={<FlagGate flag="explore_pack_enabled"><ExplorePage /></FlagGate>} />
          <Route path="support" element={<SupportPage />} />
          <Route path="support/tickets/:id" element={<TicketThreadPage />} />
          <Route path="community" element={<FlagGate flag="explore_community_enabled"><PostsPage /></FlagGate>} />
          <Route path="community/:id" element={<FlagGate flag="explore_community_enabled"><PostDetailPage /></FlagGate>} />
          <Route path="rescues" element={<RescuesHubPage />} />
          <Route path="rescues/browse" element={<RescuesPage />} />
          <Route path="rescues/map" element={<RescuesMapPage />} />
          <Route path="rescues/:id" element={<RescueDetailPage />} />
          <Route path="rescue/dashboard" element={<RescueDashboardPage />} />
          <Route path="transfers" element={<TransfersPage />} />
          <Route path="liked" element={<LikedPetsPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="donate" element={<FlagGate flag="explore_donate_enabled"><DonatePage /></FlagGate>} />
          <Route path="donate/success" element={<FlagGate flag="explore_donate_enabled"><DonateReturnPage /></FlagGate>} />
          <Route path="donations" element={<DonationHistoryPage />} />
          <Route path="shop" element={<FlagGate flag="explore_shop_enabled"><ShopPage /></FlagGate>} />
          <Route path="shop/:handle" element={<FlagGate flag="explore_shop_enabled"><ShopProductPage /></FlagGate>} />
          <Route path="cart" element={<FlagGate flag="explore_shop_enabled"><CartPage /></FlagGate>} />
          {/* Unknown /app URL — 404 inside the app shell. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* ── Admin — full-width, own shell ── */}
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminLayout />
            </AdminGuard>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
          <Route path="content" element={<AdminContentPage />} />
          <Route path="lost" element={<AdminLostReportsPage />} />
          <Route path="tickets" element={<AdminTicketsPage />} />
          <Route path="rescues" element={<AdminRescuesPage />} />
          <Route path="inquiries" element={<AdminInquiriesPage />} />
          <Route path="donations" element={<AdminDonationsPage />} />
          <Route path="announcements" element={<AdminAnnouncementsPage />} />
          <Route path="news" element={<AdminNewsPage />} />
          <Route path="feedback" element={<AdminFeedbackPage />} />
          <Route path="invites" element={<AdminInvitesPage />} />
          <Route path="faq" element={<AdminFAQPage />} />
          <Route path="breeds" element={<AdminBreedsPage />} />
          <Route path="traits" element={<AdminTraitsPage />} />
          <Route path="tags" element={<AdminTagsPage />} />
          <Route path="parks" element={<AdminParksPage />} />
          <Route path="vets" element={<AdminVetsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="system" element={<AdminSystemPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
        </Route>
      </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      {/* The global CSS rule only quiets CSS animations. The deck, the modals
          and the end states are framer-motion, and kept springing for people
          who had asked their device to reduce motion. */}
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

export default App;
