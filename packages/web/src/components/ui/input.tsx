import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-11 w-full rounded-xl border border-input bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm px-4 py-2.5 text-sm shadow-sm transition-all duration-200',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus:ring-destructive/50',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className
          )}
          ref={ref}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {rightIcon}
          </div>
        )}
        {error && (
          <p className="mt-1.5 text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
