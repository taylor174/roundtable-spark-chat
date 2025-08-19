import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface ErrorRetryButtonProps {
  onRetry: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function ErrorRetryButton({ onRetry, children, disabled }: ErrorRetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      disabled={disabled || isRetrying}
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
      {children}
    </Button>
  );
}