import { Bell, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth.store';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Header({ title, subtitle, action }: HeaderProps) {
  const { user } = useAuthStore();

  const getInitials = () => {
    if (!user) return 'U';
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-glass border-b border-gray-200/50 dark:border-gray-700/50">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left: Title */}
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Input
              placeholder="Search..."
              className="w-64 pl-10"
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Action Button */}
          {action && (
            <Button onClick={action.onClick} leftIcon={<Plus className="h-4 w-4" />}>
              {action.label}
            </Button>
          )}

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
          </Button>

          {/* User Menu */}
          <Avatar size="sm">
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
