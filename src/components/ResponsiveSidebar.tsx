import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveSidebarProps {
  children: React.ReactNode;
  trigger?: React.ReactNode;
  className?: string;
  side?: 'left' | 'right';
}

export function ResponsiveSidebar({ 
  children, 
  trigger, 
  className,
  side = 'right' 
}: ResponsiveSidebarProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const defaultTrigger = (
    <Button 
      variant="outline" 
      size="icon" 
      className="md:hidden"
      aria-label="Open sidebar"
    >
      <Menu className="h-4 w-4" />
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {trigger || defaultTrigger}
        </SheetTrigger>
        <SheetContent 
          side={side} 
          className={cn(
            "w-[280px] sm:w-[320px] p-0 overflow-y-auto",
            className
          )}
        >
          <div className="p-4">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: render children directly
  return (
    <div className={cn("hidden md:block", className)}>
      {children}
    </div>
  );
}

export function SidebarMobileToggle({ 
  children,
  className 
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("md:hidden", className)}>
      {children}
    </div>
  );
}