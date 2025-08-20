import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TouchOptimizedButtonProps extends ButtonProps {
  touchSize?: 'default' | 'large' | 'small';
  fullWidth?: boolean;
}

export function TouchOptimizedButton({ 
  children, 
  touchSize = 'default',
  fullWidth = false,
  className,
  size,
  ...props 
}: TouchOptimizedButtonProps) {
  const touchSizes = {
    small: 'min-h-[40px] min-w-[40px] px-3 py-2',
    default: 'min-h-[44px] min-w-[44px] px-4 py-2 sm:min-h-[40px] sm:min-w-[40px]',
    large: 'min-h-[48px] min-w-[48px] px-6 py-3 text-base'
  };

  return (
    <Button
      size={size || (touchSize === 'large' ? 'lg' : 'default')}
      className={cn(
        touchSizes[touchSize],
        fullWidth && 'w-full',
        "touch-manipulation", // Improves touch responsiveness
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}