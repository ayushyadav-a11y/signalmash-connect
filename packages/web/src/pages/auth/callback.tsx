// ===========================================
// OAuth Callback Page
// Handles tokens from GHL OAuth and auto-logs user in
// ===========================================

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginViaOAuth } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');
      const success = searchParams.get('success');
      const isNew = searchParams.get('isNew');

      if (success !== 'true' || !accessToken || !refreshToken) {
        setStatus('error');
        setError('Invalid OAuth callback. Please try again.');
        return;
      }

      try {
        await loginViaOAuth(accessToken, refreshToken);
        setStatus('success');

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          if (isNew === 'true') {
            // New user - maybe show onboarding later
            navigate('/dashboard');
          } else {
            navigate('/dashboard');
          }
        }, 1500);
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'Failed to complete authentication');
      }
    };

    handleCallback();
  }, [searchParams, loginViaOAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative text-center"
      >
        {status === 'loading' && (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Completing authentication...</h2>
            <p className="text-muted-foreground">Please wait while we set up your session</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Authentication successful!</h2>
            <p className="text-muted-foreground">Redirecting to your dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold">Authentication failed</h2>
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate('/connect')}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              Try again
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
