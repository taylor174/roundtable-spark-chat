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
            "w-[90vw] max-w-[400px] p-0 overflow-y-auto",
            "bg-background border-l border-border",
            className
          )}
        >
          <div className="flex flex-col h-full">
            {/* Header with close button */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Menu</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Content with proper spacing */}
            <div className="flex-1 p-6 space-y-8 overflow-y-auto">
              {children}
            </div>
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