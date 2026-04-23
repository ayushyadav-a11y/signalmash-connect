import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ListChecks,
  Building2,
  Megaphone,
  Phone,
  MessageSquare,
  Plug,
  Settings,
  HelpCircle,
  ChevronRight,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Onboarding', href: '/onboarding', icon: ListChecks },
  { name: 'Brands', href: '/brands', icon: Building2 },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'Phone Numbers', href: '/phone-numbers', icon: Phone },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Platforms', href: '/platforms', icon: Plug },
];

const secondaryNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help & Support', href: '/help', icon: HelpCircle },
];

export function Sidebar() {
  const location = useLocation();
  const { user, organization } = useAuthStore();

  const getInitials = () => {
    if (!user) return 'U';
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/80 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950">
              SM
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Signalmash</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Connect</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="outline" size="icon" className="border-slate-300 dark:border-slate-700" />
            <Avatar size="sm">
              <AvatarImage src={undefined} />
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        <nav className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-3">
          {navigation.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 flex-col border-r border-slate-200 bg-white/92 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/92 dark:supports-[backdrop-filter]:bg-slate-950/80 lg:flex">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-base font-semibold text-white shadow-sm dark:bg-slate-100 dark:text-slate-950">
              SM
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Signalmash Connect
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Messaging operations console
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
            <Avatar size="md">
              <AvatarImage src={undefined} />
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {organization?.name}
              </p>
            </div>
            <ThemeToggle variant="outline" size="icon" className="shrink-0 border-slate-300 dark:border-slate-700" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-3 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <PanelLeft className="h-3.5 w-3.5" />
            Workspace
          </div>
          <div className="space-y-1.5">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                  {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                </NavLink>
              );
            })}
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Support
            </p>
            <div className="space-y-1.5">
              {secondaryNavigation.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-slate-200 text-slate-950 dark:bg-slate-800 dark:text-slate-50'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
