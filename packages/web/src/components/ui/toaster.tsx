import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { Button } from './button';
import { useNotificationStore } from '@/stores/notification.store';

const variantConfig = {
  success: {
    icon: CheckCircle2,
    card: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
    iconColor: 'text-emerald-600 dark:text-emerald-300',
  },
  error: {
    icon: AlertCircle,
    card: 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100',
    iconColor: 'text-red-600 dark:text-red-300',
  },
  info: {
    icon: Info,
    card: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100',
    iconColor: 'text-sky-600 dark:text-sky-300',
  },
} as const;

export function Toaster() {
  const { notifications, dismiss } = useNotificationStore();

  useEffect(() => {
    const timers = notifications.map((notification) =>
      window.setTimeout(() => dismiss(notification.id), 4500)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [notifications, dismiss]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      <AnimatePresence>
        {notifications.map((notification) => {
          const config = variantConfig[notification.variant];
          const Icon = config.icon;

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              className={`pointer-events-auto rounded-2xl border shadow-lg ${config.card}`}
            >
              <div className="flex items-start gap-3 p-4">
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconColor}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{notification.title}</p>
                  {notification.description && (
                    <p className="mt-1 text-sm opacity-90">{notification.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 rounded-full"
                  onClick={() => dismiss(notification.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
