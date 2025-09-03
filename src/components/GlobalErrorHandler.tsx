import { useEffect } from 'react';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { logger } from '@/utils/logger';

/**
 * Global error handler component that captures unhandled errors
 * and provides consistent error reporting across the application
 */
export function GlobalErrorHandler() {
  const { handleError } = useErrorHandler();

  useEffect(() => {
    // Handle uncaught JavaScript errors
    const handleGlobalError = (event: ErrorEvent) => {
      const error = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      };

      logger.error('Uncaught JavaScript error', error, 'GlobalErrorHandler');
      
      handleError(event.error || new Error(event.message), {
        component: 'GlobalErrorHandler',
        operation: 'global_error_catch',
        userMessage: 'An unexpected error occurred. The development team has been notified.'
      });
    };

    // Handle unhandled Promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled Promise rejection', {
        reason: event.reason,
        stack: event.reason?.stack
      }, 'GlobalErrorHandler');

      handleError(event.reason, {
        component: 'GlobalErrorHandler',
        operation: 'promise_rejection',
        userMessage: 'A background operation failed. Please try again.'
      });

      // Prevent the default behavior (logging to console)
      event.preventDefault();
    };

    // Handle Supabase connection errors
    const handleSupabaseError = (event: CustomEvent) => {
      logger.error('Supabase connection error', event.detail, 'GlobalErrorHandler');
      
      handleError(new Error('Database connection issue'), {
        component: 'GlobalErrorHandler',
        operation: 'supabase_connection',
        userMessage: 'Database connection lost. Please check your internet connection and refresh the page.'
      });
    };

    // Add event listeners
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    // Custom event for Supabase errors (can be triggered from connection hooks)
    window.addEventListener('supabase-error', handleSupabaseError as EventListener);

    // Resource loading errors (images, scripts, etc.)
    const handleResourceError = (event: Event) => {
      const target = event.target as HTMLElement;
      const resourceType = target.tagName?.toLowerCase() || 'resource';
      
      logger.warn('Resource loading failed', {
        type: resourceType,
        src: (target as any).src || (target as any).href,
        component: 'GlobalErrorHandler'
      });

      // Don't show user-facing errors for resource loading failures
      // as they're usually non-critical
    };

    // Add resource error listener to document (captures during capture phase)
    document.addEventListener('error', handleResourceError, true);

    // Cleanup function
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('supabase-error', handleSupabaseError as EventListener);
      document.removeEventListener('error', handleResourceError, true);
    };
  }, [handleError]);

  // This component doesn't render anything
  return null;
}