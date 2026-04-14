import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminStore } from '@/stores/admin.store';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAdminStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      navigate('/admin/dashboard');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 shadow-lg mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-gray-400 mt-1">SignalMash Connect Administration</p>
        </div>

        <Card className="bg-gray-800/50 border-gray-700 shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Sign in</CardTitle>
            <CardDescription className="text-gray-400">
              Enter your admin credentials to access the portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 rounded-xl bg-red-500/10 text-red-400 text-sm border border-red-500/20"
                >
                  {error}
                </motion.div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Email</label>
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="admin@example.com"
                  error={errors.email?.message}
                  leftIcon={<Mail className="h-4 w-4" />}
                  onChange={() => clearError()}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Password</label>
                <Input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  error={errors.password?.message}
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="focus:outline-none text-gray-400"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  }
                  onChange={() => clearError()}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
                size="lg"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-gray-500">
          This is a restricted area. Unauthorized access is prohibited.
        </p>
      </motion.div>
    </div>
  );
}
