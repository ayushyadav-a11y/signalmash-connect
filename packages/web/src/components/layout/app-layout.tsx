import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="pl-64">
        <div className="relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
