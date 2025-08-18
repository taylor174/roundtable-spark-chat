import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ErrorContext {
  operation?: string;
  component?: string;
  userMessage?: string;
}

export function useErrorHandler() {
  const { toast } = useToast();

  const handleError = useCallback((error: any, context: ErrorContext = {}) => {
    const { operation = 'operation', component = 'app', userMessage } = context;
    
    console.error(`Error in ${component} during ${operation}:`, error);

    // Determine user-friendly message
    let message = userMessage;
    
    if (!message) {
      if (error?.message?.includes('timeout')) {
        message = 'Request timed out. Please try again.';
      } else if (error?.message?.includes('network')) {
        message = 'Network error. Please check your connection.';
      } else if (error?.message?.includes('constraint')) {
        message = 'A data conflict occurred. Please refresh and try again.';
      } else if (error?.message?.includes('permission')) {
        message = 'You don\'t have permission to perform this action.';
      } else if (error?.code === 'PGRST301') {
        message = 'This item already exists.';
      } else if (error?.code === 'PGRST116') {
        message = 'Item not found. It may have been deleted.';
      } else {
        message = 'Something went wrong. Please try again.';
      }
    }

    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    });

    // In development, show technical details
    if (process.env.NODE_ENV === 'development') {
      console.error('Technical details:', {
        error,
        context,
        stack: error?.stack,
      });
    }
  }, [toast]);

  const handleAsyncOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    context: ErrorContext = {}
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      handleError(error, context);
      return null;
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncOperation,
  };
}