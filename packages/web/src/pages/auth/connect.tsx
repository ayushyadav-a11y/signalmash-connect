// ===========================================
// Connect GHL Page
// Entry point for users - initiates GHL OAuth
// ===========================================

import { motion } from 'framer-motion';
import { ExternalLink, Shield, Zap, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';

const features = [
  {
    icon: Zap,
    title: 'Instant Setup',
    description: 'Connect your GHL account in seconds with secure OAuth',
  },
  {
    icon: MessageSquare,
    title: 'SMS Campaigns',
    description: 'Send bulk SMS campaigns through Signalmash',
  },
  {
    icon: Shield,
    title: 'Secure & Reliable',
    description: 'Enterprise-grade security for your messaging needs',
  },
];

export function ConnectPage() {
  const { initiateGHLOAuth, isLoading, error } = useAuthStore();

  const handleConnect = async () => {
    try {
      await initiateGHLOAuth();
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-lg"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg mb-4">
            <span className="text-white font-bold text-3xl">SM</span>
          </div>
          <h1 className="text-3xl font-bold">Signalmash Connect</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Power your GoHighLevel with SMS messaging
          </p>
        </div>

        <Card className="shadow-2xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl">
          <CardContent className="p-8">
            {/* Features */}
            <div className="space-y-4 mb-8">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                  className="flex items-start gap-4"
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-3 rounded-xl bg-destructive/10 text-destructive text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Connect Button */}
            <Button
              onClick={handleConnect}
              className="w-full h-14 text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              isLoading={isLoading}
            >
              <ExternalLink className="h-5 w-5 mr-2" />
              Connect with GoHighLevel
            </Button>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              You'll be redirected to GoHighLevel to authorize access
            </p>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          By connecting, you agree to our{' '}
          <a href="#" className="underline hover:text-foreground">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="underline hover:text-foreground">
            Privacy Policy
          </a>
        </p>
      </motion.div>
    </div>
  );
}
