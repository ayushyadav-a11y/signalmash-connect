import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  Megaphone,
  Phone,
  MessageSquare,
  Plug,
  Settings,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
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
    <aside className="sidebar fixed left-0 top-0 z-40 h-screen w-64 flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">SM</span>
        </div>
        <div>
          <h1 className="font-semibold text-sm">Signalmash</h1>
          <p className="text-xs text-muted-foreground">Connect</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-primary rounded-xl"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <item.icon className="h-5 w-5 relative z-10" />
                <span className="relative z-10">{item.name}</span>
                {isActive && (
                  <ChevronRight className="ml-auto h-4 w-4 relative z-10" />
                )}
              </NavLink>
            );
          })}
        </div>

        <div className="mt-8">
          <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Support
          </p>
          <div className="space-y-1">
            {secondaryNavigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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

      {/* User Profile */}
      <div className="border-t border-gray-200/50 dark:border-gray-700/50 p-4">
        <div className="flex items-center gap-2">
          <NavLink
            to="/settings/profile"
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent transition-colors flex-1 min-w-0"
          >
            <Avatar size="sm">
              <AvatarImage src={undefined} />
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {organization?.name}
              </p>
            </div>
          </NavLink>
          <ThemeToggle className="shrink-0" />
        </div>
      </div>
    </aside>
  );
}
