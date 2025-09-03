import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

export interface SystemMetrics {
  stuckTables: number;
  expiredRounds: number;
  activeUsers: number;
  systemStatus: 'healthy' | 'warning' | 'critical';
  lastChecked: string;
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: string;
  component?: string;
}

/**
 * Collect system health metrics
 */
export async function collectSystemMetrics(): Promise<SystemMetrics> {
  const startTime = Date.now();
  
  try {
    // Get stuck tables count
    const { data: stuckTables } = await supabase
      .from('tables')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'running');

    // Get expired rounds count
    const { data: expiredRounds } = await supabase
      .from('rounds')
      .select('id', { count: 'exact', head: true })
      .in('status', ['suggest', 'vote'])
      .lt('ends_at', new Date().toISOString());

    // Get active participants (seen in last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: activeParticipants } = await supabase
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .gte('last_seen_at', tenMinutesAgo)
      .eq('is_online', true);

    const stuckCount = stuckTables?.length || 0;
    const expiredCount = expiredRounds?.length || 0;
    const activeCount = activeParticipants?.length || 0;

    // Determine system status
    let systemStatus: SystemMetrics['systemStatus'] = 'healthy';
    if (stuckCount > 50 || expiredCount > 20) {
      systemStatus = 'critical';
    } else if (stuckCount > 10 || expiredCount > 5) {
      systemStatus = 'warning';
    }

    const metrics: SystemMetrics = {
      stuckTables: stuckCount,
      expiredRounds: expiredCount,
      activeUsers: activeCount,
      systemStatus,
      lastChecked: new Date().toISOString()
    };

    // Log performance
    const duration = Date.now() - startTime;
    logger.info('System metrics collected', {
      component: 'SystemMonitoring',
      duration,
      metrics
    });

    return metrics;

  } catch (error) {
    logger.error('Failed to collect system metrics', error, 'SystemMonitoring');
    
    return {
      stuckTables: -1,
      expiredRounds: -1,
      activeUsers: -1,
      systemStatus: 'critical',
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Track a performance metric
 */
export function trackPerformance(metric: Omit<PerformanceMetric, 'timestamp'>): void {
  const fullMetric: PerformanceMetric = {
    ...metric,
    timestamp: new Date().toISOString()
  };

  logger.info('Performance metric tracked', {
    component: metric.component || 'Unknown',
    metric: fullMetric
  });

  // Store in localStorage for debugging (limit to last 100 entries)
  try {
    const stored = localStorage.getItem('performance_metrics');
    const metrics: PerformanceMetric[] = stored ? JSON.parse(stored) : [];
    
    metrics.push(fullMetric);
    
    // Keep only last 100 entries
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }
    
    localStorage.setItem('performance_metrics', JSON.stringify(metrics));
  } catch (error) {
    // Ignore localStorage errors
  }
}

/**
 * Get stored performance metrics for analysis
 */
export function getPerformanceMetrics(): PerformanceMetric[] {
  try {
    const stored = localStorage.getItem('performance_metrics');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

/**
 * Clear stored performance metrics
 */
export function clearPerformanceMetrics(): void {
  try {
    localStorage.removeItem('performance_metrics');
  } catch (error) {
    // Ignore localStorage errors
  }
}

/**
 * Calculate average performance for an operation
 */
export function getOperationPerformance(operation: string, hours: number = 1): {
  averageDuration: number;
  successRate: number;
  totalOperations: number;
} {
  const metrics = getPerformanceMetrics();
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const relevantMetrics = metrics.filter(m => 
    m.operation === operation && 
    new Date(m.timestamp) > cutoffTime
  );

  if (relevantMetrics.length === 0) {
    return { averageDuration: 0, successRate: 0, totalOperations: 0 };
  }

  const totalDuration = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
  const successfulOperations = relevantMetrics.filter(m => m.success).length;

  return {
    averageDuration: totalDuration / relevantMetrics.length,
    successRate: successfulOperations / relevantMetrics.length,
    totalOperations: relevantMetrics.length
  };
}
