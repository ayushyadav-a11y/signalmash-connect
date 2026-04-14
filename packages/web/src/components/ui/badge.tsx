import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
        warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
        destructive: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
        info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
        outline: 'border border-current bg-transparent',
        ghost: 'bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', {
            'bg-primary': variant === 'default' || !variant,
            'bg-green-500': variant === 'success',
            'bg-yellow-500': variant === 'warning',
            'bg-red-500': variant === 'destructive',
            'bg-blue-500': variant === 'info',
          })}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
