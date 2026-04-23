import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

function getEncryptedDataFromQuery(searchParams: URLSearchParams): string | null {
  return (
    searchParams.get('encryptedData') ||
    searchParams.get('token') ||
    searchParams.get('ssoData') ||
    searchParams.get('data')
  );
}

export function GhlSsoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginViaOAuth } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requestEncryptedData = async (): Promise<string | null> => {
      const queryValue = getEncryptedDataFromQuery(searchParams);
      if (queryValue) {
        return queryValue;
      }

      if (window.parent === window) {
        return null;
      }

      return new Promise((resolve) => {
        const timeout = window.setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          resolve(null);
        }, 5000);

        const handleMessage = (event: MessageEvent) => {
          const payload = event.data as
            | { message?: string; payload?: string }
            | undefined;

          if (payload?.message !== 'REQUEST_USER_DATA_RESPONSE' || typeof payload.payload !== 'string') {
            return;
          }

          window.clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          resolve(payload.payload);
        };

        window.addEventListener('message', handleMessage);
        window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
      });
    };

    const bootstrap = async () => {
      const encryptedData = await requestEncryptedData();

      if (!encryptedData) {
        setStatus('error');
        setError('Missing GHL user context. Open this page from the GoHighLevel custom page entry.');
        return;
      }

      try {
        let response;
        try {
          response = await api.exchangeGhlSso(encryptedData);
        } catch (firstError) {
          await new Promise((resolve) => window.setTimeout(resolve, 750));
          response = await api.exchangeGhlSso(encryptedData);
        }

        if (!response.success || !response.data) {
          throw new Error('Failed to complete GHL SSO authentication');
        }

        await loginViaOAuth(
          response.data.tokens.accessToken,
          response.data.tokens.refreshToken
        );

        setStatus('success');

        setTimeout(() => {
          navigate('/onboarding', { replace: true });
        }, 800);
      } catch (err: any) {
        setStatus('error');
        setError(err?.message || 'Failed to complete GHL SSO authentication');
      }
    };

    bootstrap();
  }, [loginViaOAuth, navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative text-center space-y-4"
      >
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Opening Signalmash Connect...</h2>
            <p className="text-muted-foreground">
              Requesting workspace context from GoHighLevel and preparing the embedded workspace.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Workspace ready</h2>
            <p className="text-muted-foreground">Redirecting into the embedded onboarding flow...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold">Embedded sign-in failed</h2>
            <p className="max-w-md text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate('/connect')}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              Open standard connect flow
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
