import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { useAdminStore } from '@/stores/admin.store';
import { useThemeStore } from '@/stores/theme.store';
import { AppLayout } from '@/components/layout/app-layout';
// Auth pages (SSO-based)
import { ConnectPage } from '@/pages/auth/connect';
import { AuthCallbackPage } from '@/pages/auth/callback';
// App pages
import { DashboardPage } from '@/pages/dashboard';
import { BrandsPage } from '@/pages/brands';
import { NewBrandPage } from '@/pages/brands/new';
import { BrandDetailPage } from '@/pages/brands/[id]';
import { CampaignsPage } from '@/pages/campaigns';
import { NewCampaignPage } from '@/pages/campaigns/new';
import { CampaignDetailPage } from '@/pages/campaigns/[id]';
import { PhoneNumbersPage } from '@/pages/phone-numbers';
import { MessagesPage } from '@/pages/messages';
import { PlatformsPage } from '@/pages/platforms';
import { SettingsPage } from '@/pages/settings';
// Admin pages
import { AdminLoginPage } from '@/pages/admin/login';
import { AdminSetupPage } from '@/pages/admin/setup';
import { AdminDashboardPage } from '@/pages/admin/dashboard';
import { AdminSettingsPage } from '@/pages/admin/settings';
import { AdminOrganizationsPage } from '@/pages/admin/organizations';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/connect" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// No auth check route - for OAuth callback
function NoAuthCheckRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Admin Protected Route
function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAdminStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

// Admin Public Route (redirect to dashboard if already logged in)
function AdminPublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAdminStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const location = useLocation();

  // Initialize theme on mount
  useEffect(() => {
    // This triggers the theme store to apply the saved theme
    useThemeStore.getState();
  }, []);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes - GHL SSO based auth */}
        <Route
          path="/connect"
          element={
            <PublicRoute>
              <ConnectPage />
            </PublicRoute>
          }
        />
        {/* OAuth callback - no auth check, handles token from URL */}
        <Route
          path="/auth/callback"
          element={
            <NoAuthCheckRoute>
              <AuthCallbackPage />
            </NoAuthCheckRoute>
          }
        />
        {/* Legacy login redirect to connect */}
        <Route path="/login" element={<Navigate to="/connect" replace />} />
        <Route path="/register" element={<Navigate to="/connect" replace />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="brands" element={<BrandsPage />} />
          <Route path="brands/new" element={<NewBrandPage />} />
          <Route path="brands/:id" element={<BrandDetailPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="campaigns/new" element={<NewCampaignPage />} />
          <Route path="campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="phone-numbers" element={<PhoneNumbersPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="platforms" element={<PlatformsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin/login"
          element={
            <AdminPublicRoute>
              <AdminLoginPage />
            </AdminPublicRoute>
          }
        />
        <Route
          path="/admin/setup"
          element={<AdminSetupPage />}
        />
        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboardPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <AdminProtectedRoute>
              <AdminSettingsPage />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/organizations"
          element={
            <AdminProtectedRoute>
              <AdminOrganizationsPage />
            </AdminProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
