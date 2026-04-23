import { Bell, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth.store';
import { ThemeToggle } from '@/components/ui/theme-toggle';

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
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/80">
      <div className="flex min-h-20 flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{title}</h1>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
          <div className="relative w-full sm:w-72">
            <Input
              placeholder="Search..."
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {action && (
              <Button onClick={action.onClick} leftIcon={<Plus className="h-4 w-4" />}>
                {action.label}
              </Button>
            )}

            <ThemeToggle
              variant="outline"
              size="icon"
              className="border-slate-300 dark:border-slate-700 lg:hidden"
            />

            <Button
              variant="outline"
              size="icon"
              className="relative border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            </Button>

            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900 sm:flex">
              <Avatar size="sm">
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {user?.firstName} {user?.lastName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
