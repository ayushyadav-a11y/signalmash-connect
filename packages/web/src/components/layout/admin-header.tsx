// ===========================================
// Admin Header Component
// ===========================================

import { useNavigate } from 'react-router-dom';
import { Shield, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAdminStore } from '@/stores/admin.store';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
}

export function AdminHeader({ title, subtitle, showBack, backTo = '/admin/dashboard' }: AdminHeaderProps) {
  const navigate = useNavigate();
  const { admin, logout } = useAdminStore();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <header className="bg-gray-800/50 border-b border-gray-700 backdrop-blur-xl sticky top-0 z-50 dark:bg-gray-900/50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {showBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(backTo)}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-orange-600">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{title}</h1>
              {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Welcome, <span className="text-white font-medium">{admin?.name}</span>
            </span>
            <ThemeToggle className="text-gray-400 hover:text-white" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-400 hover:text-white"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
