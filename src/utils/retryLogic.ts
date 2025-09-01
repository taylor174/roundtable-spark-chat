/**
 * Retry utility for handling transient failures
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoffMultiplier?: number;
    retryCondition?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoffMultiplier = 2,
    retryCondition = (error) => {
      // Retry on network errors, timeouts, and constraint violations
      return (
        error?.message?.includes('timeout') ||
        error?.message?.includes('network') ||
        error?.message?.includes('constraint') ||
        error?.code === 'PGRST301' || // Unique violation
        error?.code === 'PGRST116'    // Row not found
      );
    }
  } = options;

  let lastError: any;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !retryCondition(error)) {
        throw error;
      }

      // Operation failed, will retry if attempts remaining
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Debounce utility to prevent rapid successive calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Connection state manager for real-time subscriptions
 */
export class ConnectionManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  async handleConnectionError(error: any, reconnectFn: () => void) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      // Connection lost, retrying with exponential backoff
      
      setTimeout(() => {
        reconnectFn();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      throw new Error('Unable to maintain connection to server');
    }
  }
  
  resetReconnectAttempts() {
    this.reconnectAttempts = 0;
  }
}