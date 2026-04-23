import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle } from 'lucide-react';

export function InstallCompletePage() {
  const [searchParams] = useSearchParams();
  const [canClose, setCanClose] = useState(false);
  const success = searchParams.get('success') === 'true';
  const isNew = searchParams.get('isNew') === 'true';

  useEffect(() => {
    setCanClose(window.opener != null || window.history.length > 1);
  }, []);

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative max-w-xl rounded-[32px] border border-slate-200 bg-white/90 px-8 py-10 text-center shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/90"
      >
        {success ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="mt-6 text-2xl font-semibold text-slate-950 dark:text-slate-50">
              Signalmash Connect is installed
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Return to HighLevel and open <span className="font-medium text-slate-950 dark:text-slate-50">SM Connect</span> from the left menu to continue the embedded rollout.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {isNew
                ? 'Your first stop will be onboarding inside the embedded app.'
                : 'The embedded app will reopen in the connected workspace.'}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              {canClose && (
                <button
                  onClick={handleClose}
                  className="inline-flex items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-slate-100 dark:text-slate-950"
                >
                  Close this tab
                </button>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                If this tab does not close automatically, you can close it manually and continue in HighLevel.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="mt-6 text-2xl font-semibold text-slate-950 dark:text-slate-50">
              Installation could not be completed
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Return to HighLevel and try the installation again. If the problem persists, open the Signalmash Connect app from HighLevel and retry the connection flow.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
