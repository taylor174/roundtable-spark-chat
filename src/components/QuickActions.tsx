import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  RotateCcw, 
  Settings, 
  Zap,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface QuickActionsProps {
  onRefresh: () => void;
  runningTablesCount: number;
  expiredRoundsCount: number;
}

export function QuickActions({ onRefresh, runningTablesCount, expiredRoundsCount }: QuickActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const closeAbandonedTables = async () => {
    setLoading('close-abandoned');
    try {
      // Close tables that have been inactive for more than 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { error, count } = await supabase
        .from('tables')
        .update({ 
          status: 'closed', 
          current_round_id: null, 
          phase_ends_at: null 
        })
        .eq('status', 'running')
        .lt('updated_at', twentyFourHoursAgo);

      if (error) throw error;

      toast({
        title: "Abandoned Tables Closed",
        description: `Closed ${count || 0} abandoned tables (inactive >24h)`,
      });
      
      logger.info('Bulk close abandoned tables', { closedCount: count });
      onRefresh();
    } catch (error) {
      logger.error('Failed to close abandoned tables', error, 'QuickActions');
      toast({
        title: "Error",
        description: "Failed to close abandoned tables",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const forceCleanupAllRounds = async () => {
    setLoading('cleanup-rounds');
    try {
      const { data, error } = await supabase.rpc('comprehensive_cleanup_stuck_tables');
      
      if (error) throw error;

      const result = data as any;
      if (result.success) {
        toast({
          title: "System Cleanup Complete",
          description: `Updated ${result.updated_tables} tables, ${result.updated_rounds} rounds, created ${result.created_blocks} blocks`,
        });
        
        logger.info('Comprehensive system cleanup completed', result);
        onRefresh();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Failed to run comprehensive cleanup', error, 'QuickActions');
      toast({
        title: "Error",
        description: "Failed to run system cleanup",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const resetStuckTables = async () => {
    setLoading('reset-stuck');
    try {
      // First identify stuck tables (running for >24h with no activity)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { error, count } = await supabase
        .from('tables')
        .update({ 
          status: 'lobby', 
          current_round_id: null, 
          phase_ends_at: null 
        })
        .eq('status', 'running')
        .lt('updated_at', twentyFourHoursAgo);

      if (error) throw error;

      toast({
        title: "Stuck Tables Reset",
        description: `Reset ${count || 0} stuck tables to lobby status`,
      });
      
      logger.info('Bulk reset stuck tables', { resetCount: count });
      onRefresh();
    } catch (error) {
      logger.error('Failed to reset stuck tables', error, 'QuickActions');
      toast({
        title: "Error",
        description: "Failed to reset stuck tables",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const emergencyShutdown = async () => {
    setLoading('emergency');
    try {
      // Close all running tables and clean up all rounds
      const { error: tablesError, count: tablesCount } = await supabase
        .from('tables')
        .update({ 
          status: 'closed', 
          current_round_id: null, 
          phase_ends_at: null 
        })
        .eq('status', 'running');

      if (tablesError) throw tablesError;

      // Run comprehensive cleanup
      const { data, error: cleanupError } = await supabase.rpc('comprehensive_cleanup_stuck_tables');
      if (cleanupError) throw cleanupError;

      toast({
        title: "Emergency Shutdown Complete",
        description: `Closed ${tablesCount || 0} tables and cleaned up all rounds`,
        variant: "destructive"
      });
      
      logger.warn('Emergency system shutdown executed', { 
        closedTables: tablesCount, 
        cleanupResult: data 
      });
      onRefresh();
    } catch (error) {
      logger.error('Failed to execute emergency shutdown', error, 'QuickActions');
      toast({
        title: "Error",
        description: "Failed to execute emergency shutdown",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Close Abandoned Tables */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="justify-start h-auto p-4"
                disabled={loading !== null}
              >
                <div className="flex flex-col items-start gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    <span className="font-medium">Close Abandoned Tables</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    Close tables inactive for more than 24 hours
                  </p>
                </div>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close Abandoned Tables?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will close all tables that have been running but inactive for more than 24 hours. 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={closeAbandonedTables}>
                  {loading === 'close-abandoned' && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Close Abandoned Tables
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Force Cleanup All */}
          <Button 
            variant="outline" 
            className="justify-start h-auto p-4"
            onClick={forceCleanupAllRounds}
            disabled={loading !== null}
          >
            <div className="flex flex-col items-start gap-2 w-full">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="font-medium">Force Cleanup All</span>
                {loading === 'cleanup-rounds' && <RefreshCw className="h-4 w-4 animate-spin" />}
              </div>
              <p className="text-xs text-muted-foreground text-left">
                Clean up all expired rounds and fix inconsistencies
              </p>
            </div>
          </Button>

          {/* Reset Stuck Tables */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="justify-start h-auto p-4"
                disabled={loading !== null}
              >
                <div className="flex flex-col items-start gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    <span className="font-medium">Reset Stuck Tables</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    Reset stuck tables back to lobby status
                  </p>
                </div>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Stuck Tables?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all stuck tables (inactive for {'>'}24h) back to lobby status. 
                  Participants will need to rejoin these tables.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetStuckTables}>
                  {loading === 'reset-stuck' && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Reset Tables
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Emergency Shutdown */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="justify-start h-auto p-4"
                disabled={loading !== null}
              >
                <div className="flex flex-col items-start gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Emergency Shutdown</span>
                  </div>
                  <p className="text-xs text-left opacity-90">
                    Close ALL running tables immediately
                  </p>
                </div>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600">Emergency Shutdown</AlertDialogTitle>
                <AlertDialogDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">⚠️ This is a destructive action!</p>
                    <p>This will immediately:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Close ALL {runningTablesCount} running tables</li>
                      <li>End all active sessions</li>
                      <li>Clean up {expiredRoundsCount} expired rounds</li>
                      <li>Force all participants to rejoin</li>
                    </ul>
                    <p className="text-red-600 font-medium">Only use in emergency situations!</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={emergencyShutdown} className="bg-red-600 hover:bg-red-700">
                  {loading === 'emergency' && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Execute Emergency Shutdown
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Status Indicators */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>System Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {runningTablesCount} running tables • {expiredRoundsCount} expired rounds
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}