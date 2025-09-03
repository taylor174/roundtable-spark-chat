import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { logger } from '@/utils/logger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface SystemHealth {
  stuckTables: number;
  expiredRounds: number;
  lastCleanup: string | null;
  status: 'healthy' | 'warning' | 'critical';
}

interface SystemHealthMonitorProps {
  isAdminPanel?: boolean;
}

export function SystemHealthMonitor({ isAdminPanel = false }: SystemHealthMonitorProps) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useAdminCheck();

  const checkSystemHealth = async () => {
    try {
      // Check for stuck tables
      const { data: stuckData } = await supabase
        .from('tables')
        .select('id')
        .eq('status', 'running');

      // Check for expired rounds
      const { data: expiredRounds } = await supabase
        .from('rounds')
        .select('id')
        .in('status', ['suggest', 'vote'])
        .lt('ends_at', new Date().toISOString());

      const stuckCount = stuckData?.length || 0;
      const expiredCount = expiredRounds?.length || 0;

      let status: SystemHealth['status'] = 'healthy';
      if (stuckCount > 50 || expiredCount > 20) status = 'critical';
      else if (stuckCount > 10 || expiredCount > 5) status = 'warning';

      setHealth({
        stuckTables: stuckCount,
        expiredRounds: expiredCount,
        lastCleanup: localStorage.getItem('lastSystemCleanup'),
        status
      });

      logger.info('System health check completed', {
        stuckTables: stuckCount,
        expiredRounds: expiredCount,
        status
      });
    } catch (error) {
      logger.error('Health check failed', error);
      toast({
        title: "Health Check Failed",
        description: "Unable to check system health",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const runCleanup = async () => {
    setCleaning(true);
    try {
      const { data, error } = await supabase.rpc('comprehensive_cleanup_stuck_tables');
      
      if (error) throw error;

      const result = data as any;
      if (result.success) {
        toast({
          title: "Cleanup Completed",
          description: `Fixed ${result.updated_tables} tables, ${result.updated_rounds} rounds, created ${result.created_blocks} blocks`,
        });
        
        localStorage.setItem('lastSystemCleanup', new Date().toISOString());
        await checkSystemHealth();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Cleanup failed', error);
      toast({
        title: "Cleanup Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Only show to admins unless it's in admin panel
  if (!isAdminPanel && !isAdmin) return null;
  
  if (loading) return null;
  if (!health) return null;

  const getStatusColor = () => {
    switch (health.status) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const getStatusIcon = () => {
    switch (health.status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'warning': 
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // If in admin panel, render compact version
  if (isAdminPanel) {
    if (health.status === 'healthy') {
      return (
        <Badge variant="outline" className={getStatusColor()}>
          {getStatusIcon()}
          <span className="ml-1">System Healthy</span>
        </Badge>
      );
    }

    return (
      <Alert className={`border ${health.status === 'critical' ? 'border-red-300' : 'border-yellow-300'}`}>
        {getStatusIcon()}
        <AlertTitle className="text-sm">
          System {health.status === 'critical' ? 'Critical' : 'Warning'}
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <div className="text-sm">
            <div>Stuck tables: {health.stuckTables}</div>
            <div>Expired rounds: {health.expiredRounds}</div>
            {health.lastCleanup && (
              <div className="text-xs text-muted-foreground">
                Last cleanup: {new Date(health.lastCleanup).toLocaleTimeString()}
              </div>
            )}
          </div>
          <Button
            size="sm"
            onClick={runCleanup}
            disabled={cleaning}
            className="w-full"
          >
            {cleaning && <RefreshCw className="mr-2 h-3 w-3 animate-spin" />}
            Run Cleanup
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Fixed position version for non-admin panel
  if (health.status === 'healthy') {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Badge variant="outline" className={getStatusColor()}>
          {getStatusIcon()}
          <span className="ml-1">System Healthy</span>
        </Badge>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Alert className={`border ${health.status === 'critical' ? 'border-red-300' : 'border-yellow-300'}`}>
        {getStatusIcon()}
        <AlertTitle>
          System {health.status === 'critical' ? 'Critical' : 'Warning'}
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <div>
            <div>Stuck tables: {health.stuckTables}</div>
            <div>Expired rounds: {health.expiredRounds}</div>
            {health.lastCleanup && (
              <div className="text-xs text-muted-foreground">
                Last cleanup: {new Date(health.lastCleanup).toLocaleTimeString()}
              </div>
            )}
          </div>
          <Button
            size="sm"
            onClick={runCleanup}
            disabled={cleaning}
            className="w-full"
          >
            {cleaning && <RefreshCw className="mr-2 h-3 w-3 animate-spin" />}
            Run Cleanup
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}