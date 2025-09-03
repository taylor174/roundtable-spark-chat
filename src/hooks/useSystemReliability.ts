import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { useToast } from '@/hooks/use-toast';

interface ReliabilityOptions {
  enableAutoCleanup?: boolean;
  cleanupInterval?: number; // minutes
  healthCheckInterval?: number; // seconds
}

/**
 * Hook to monitor and maintain system reliability
 */
export function useSystemReliability(options: ReliabilityOptions = {}) {
  const {
    enableAutoCleanup = true,
    cleanupInterval = 30,
    healthCheckInterval = 60
  } = options;
  
  const { toast } = useToast();
  const lastCleanupRef = useRef<number>(0);
  const healthCheckRef = useRef<NodeJS.Timeout>();
  const cleanupRef = useRef<NodeJS.Timeout>();

  const performHealthCheck = useCallback(async () => {
    try {
      // Check system health indicators
      const { data: stuckTables } = await supabase
        .from('tables')
        .select('id')
        .eq('status', 'running');

      const { data: expiredRounds } = await supabase
        .from('rounds')
        .select('id')
        .in('status', ['suggest', 'vote'])
        .lt('ends_at', new Date().toISOString());

      const stuckCount = stuckTables?.length || 0;
      const expiredCount = expiredRounds?.length || 0;

      // Log health metrics
      logger.info('System health check', {
        component: 'SystemReliability',
        stuckTables: stuckCount,
        expiredRounds: expiredCount,
        timestamp: new Date().toISOString()
      });

      // Auto-cleanup if thresholds exceeded
      if (enableAutoCleanup && (stuckCount > 20 || expiredCount > 10)) {
        const now = Date.now();
        const timeSinceLastCleanup = now - lastCleanupRef.current;
        
        if (timeSinceLastCleanup > cleanupInterval * 60 * 1000) {
          await performAutoCleanup();
          lastCleanupRef.current = now;
        }
      }

    } catch (error) {
      logger.error('Health check failed', error, 'SystemReliability');
    }
  }, [enableAutoCleanup, cleanupInterval]);

  const performAutoCleanup = useCallback(async () => {
    try {
      logger.info('Performing auto-cleanup', null, 'SystemReliability');
      
      const { data, error } = await supabase.rpc('comprehensive_cleanup_stuck_tables');
      
      if (error) throw error;

      const result = data as any;
      if (result.success) {
        logger.info('Auto-cleanup completed successfully', {
          component: 'SystemReliability',
          updatedTables: result.updated_tables,
          updatedRounds: result.updated_rounds,
          createdBlocks: result.created_blocks
        });

        // Only show toast for significant cleanups
        if (result.updated_tables > 5 || result.updated_rounds > 5) {
          toast({
            title: "System Cleanup",
            description: `Automatically cleaned up ${result.updated_tables} stuck tables and ${result.updated_rounds} expired rounds`,
          });
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Auto-cleanup failed', error, 'SystemReliability');
    }
  }, [toast]);

  const manualCleanup = useCallback(async () => {
    try {
      await performAutoCleanup();
      lastCleanupRef.current = Date.now();
      
      toast({
        title: "Manual Cleanup Complete",
        description: "System cleanup has been performed successfully",
      });
    } catch (error) {
      toast({
        title: "Cleanup Failed",
        description: "Manual cleanup encountered an error",
        variant: "destructive"
      });
    }
  }, [performAutoCleanup, toast]);

  // Performance monitoring
  const trackPerformance = useCallback((operation: string, duration: number, success: boolean) => {
    logger.info('Performance metric', {
      component: 'SystemReliability',
      operation,
      duration,
      success,
      timestamp: new Date().toISOString()
    });

    // Alert on slow operations
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow operation detected', {
        component: 'SystemReliability',
        operation,
        duration
      });
    }
  }, []);

  // Connection quality monitoring
  const monitorConnection = useCallback(async () => {
    const start = Date.now();
    try {
      await supabase.from('tables').select('count').limit(1).single();
      const duration = Date.now() - start;
      trackPerformance('connection_test', duration, true);
      
      if (duration > 2000) {
        logger.warn('Slow database connection detected', {
          component: 'SystemReliability',
          responseTime: duration
        });
      }
    } catch (error) {
      const duration = Date.now() - start;
      trackPerformance('connection_test', duration, false);
      logger.error('Database connection test failed', error, 'SystemReliability');
    }
  }, [trackPerformance]);

  useEffect(() => {
    // Start health monitoring
    if (healthCheckInterval > 0) {
      healthCheckRef.current = setInterval(performHealthCheck, healthCheckInterval * 1000);
      
      // Initial health check
      performHealthCheck();
    }

    // Start connection monitoring (less frequent)
    const connectionInterval = setInterval(monitorConnection, 120000); // Every 2 minutes

    return () => {
      if (healthCheckRef.current) clearInterval(healthCheckRef.current);
      if (cleanupRef.current) clearInterval(cleanupRef.current);
      clearInterval(connectionInterval);
    };
  }, [performHealthCheck, healthCheckInterval, monitorConnection]);

  return {
    performHealthCheck,
    manualCleanup,
    trackPerformance,
    monitorConnection
  };
}