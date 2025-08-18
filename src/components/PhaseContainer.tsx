import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PhaseContainerProps {
  isVisible: boolean;
  children: ReactNode;
  className?: string;
}

export function PhaseContainer({ isVisible, children, className }: PhaseContainerProps) {
  return (
    <div 
      className={cn(
        "phase-container stable-layout",
        isVisible 
          ? "opacity-100 translate-y-0 pointer-events-auto" 
          : "opacity-0 translate-y-2 pointer-events-none absolute",
        className
      )}
      aria-hidden={!isVisible}
    >
      {children}
    </div>
  );
}