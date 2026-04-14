// ===========================================
// Theme Toggle Component
// ===========================================

import { Moon, Sun } from 'lucide-react';
import { Button } from './button';
import { useThemeStore } from '@/stores/theme.store';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ThemeToggle({ variant = 'ghost', size = 'icon', className }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useThemeStore();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={cn('relative', className)}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
