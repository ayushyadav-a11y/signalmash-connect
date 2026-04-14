import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Shield, User, Lock, Mail, Key, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi, useAdminStore } from '@/stores/admin.store';

const setupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number'),
  confirmPassword: z.string(),
  signalmashApiKey: z.string().min(1, 'Signalmash API key is required'),
  signalmashApiUrl: z.string().url('Please enter a valid URL').optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SetupForm = z.infer<typeof setupSchema>;

export function AdminSetupPage() {
  const navigate = useNavigate();
  const { checkAuth } = useAdminStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      signalmashApiUrl: 'https://api.signalmash.com',
    },
  });

  const onSubmit = async (data: SetupForm) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await adminApi.setup({
        email: data.email,
        password: data.password,
        name: data.name,
        signalmashApiKey: data.signalmashApiKey,
        signalmashApiUrl: data.signalmashApiUrl,
      });

      // The setup endpoint auto-logs in, so update auth state
      await checkAuth();
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-lg"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-blue-600 shadow-lg mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Initial Setup</h1>
          <p className="text-gray-400 mt-1">Configure your SignalMash Connect admin account</p>
        </div>

        <Card className="bg-gray-800/50 border-gray-700 shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Create Admin Account</CardTitle>
            <CardDescription className="text-gray-400">
              Set up your admin credentials and Signalmash API configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 rounded-xl bg-red-500/10 text-red-400 text-sm border border-red-500/20"
                >
                  {error}
                </motion.div>
              )}

              {/* Admin Credentials Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Admin Credentials
                </h3>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Name</label>
                  <Input
                    {...register('name')}
                    placeholder="Your Name"
                    error={errors.name?.message}
                    leftIcon={<User className="h-4 w-4" />}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Email</label>
                  <Input
                    {...register('email')}
                    type="email"
                    placeholder="admin@example.com"
                    error={errors.email?.message}
                    leftIcon={<Mail className="h-4 w-4" />}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Password</label>
                    <Input
                      {...register('password')}
                      type="password"
                      placeholder="••••••••"
                      error={errors.password?.message}
                      leftIcon={<Lock className="h-4 w-4" />}
                      className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Confirm</label>
                    <Input
                      {...register('confirmPassword')}
                      type="password"
                      placeholder="••••••••"
                      error={errors.confirmPassword?.message}
                      leftIcon={<Lock className="h-4 w-4" />}
                      className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                    />
                  </div>
                </div>
              </div>

              {/* Signalmash API Section */}
              <div className="space-y-4 pt-4 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Signalmash API Configuration
                </h3>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">API Key *</label>
                  <Input
                    {...register('signalmashApiKey')}
                    type="password"
                    placeholder="Your Signalmash API key"
                    error={errors.signalmashApiKey?.message}
                    leftIcon={<Key className="h-4 w-4" />}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                  />
                  <p className="text-xs text-gray-500">
                    This key will be used for all SMS operations. You can update it later in settings.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">API URL (Optional)</label>
                  <Input
                    {...register('signalmashApiUrl')}
                    placeholder="https://api.signalmash.com"
                    error={errors.signalmashApiUrl?.message}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
                size="lg"
                isLoading={isSubmitting}
                rightIcon={<Check className="h-4 w-4" />}
              >
                Complete Setup
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
