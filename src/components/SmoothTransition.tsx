import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface SmoothTransitionProps {
  children: ReactNode;
  isVisible: boolean;
  className?: string;
  delay?: number;
}

export function SmoothTransition({ 
  children, 
  isVisible, 
  className,
  delay = 0 
}: SmoothTransitionProps) {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setTimeout(() => {
        setShouldRender(true);
        setIsAnimating(true);
      }, delay);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isVisible, delay]);

  if (!shouldRender) return null;

  return (
    <div 
      className={cn(
        'smooth-transition',
        isAnimating ? 'animate-fade-in' : 'animate-fade-out',
        className
      )}
    >
      {children}
    </div>
  );
}