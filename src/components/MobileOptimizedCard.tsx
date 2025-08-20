import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MobileOptimizedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: React.ReactNode;
  variant?: 'default' | 'compact' | 'full-width';
}

export function MobileOptimizedCard({ 
  title, 
  children, 
  variant = 'default',
  className,
  ...props 
}: MobileOptimizedCardProps) {
  const cardVariants = {
    default: "mx-2 sm:mx-0",
    compact: "mx-1 sm:mx-0 shadow-sm",
    'full-width': "mx-0 rounded-none sm:rounded-lg sm:mx-0"
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-200",
        cardVariants[variant],
        className
      )}
      {...props}
    >
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn(
        title ? "pt-0" : "",
        "space-y-3 sm:space-y-4"
      )}>
        {children}
      </CardContent>
    </Card>
  );
}