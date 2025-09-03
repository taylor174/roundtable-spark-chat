import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Clock, 
  Users, 
  Settings,
  ExternalLink,
  Trash2,
  RotateCcw,
  Calendar,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ProblematicTable } from '@/hooks/useAdminDashboard';
import { logger } from '@/utils/logger';

interface ProblematicTablesListProps {
  tables: ProblematicTable[];
  onRefresh: () => void;
}

export function ProblematicTablesList({ tables, onRefresh }: ProblematicTablesListProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const { toast } = useToast();

  const getTimeSinceLastActivity = (lastActivity: string) => {
    const now = new Date();
    const lastActivityDate = new Date(lastActivity);
    const diffHours = Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60));
    
    if (diffHours > 24) {
      return `${Math.floor(diffHours / 24)}d ${diffHours % 24}h ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else {
      return `${diffMinutes}m ago`;
    }
  };

  const isStuck = (table: ProblematicTable) => {
    const lastActivityDate = new Date(table.lastActivity || table.updated_at);
    const hoursInactive = (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60);
    return hoursInactive > 24;
  };

  const hasExpiredRound = (table: ProblematicTable) => {
    if (!table.round_ends_at) return false;
    return new Date(table.round_ends_at) < new Date();
  };

  const closeTable = async (tableId: string, tableCode: string) => {
    setLoadingAction(`close-${tableId}`);
    try {
      const { error } = await supabase
        .from('tables')
        .update({ status: 'closed', current_round_id: null, phase_ends_at: null })
        .eq('id', tableId);

      if (error) throw error;

      toast({
        title: "Table Closed",
        description: `Table ${tableCode} has been closed successfully`,
      });
      
      logger.info('Table manually closed by admin', { tableId, tableCode });
      onRefresh();
    } catch (error) {
      logger.error('Failed to close table', error, 'ProblematicTablesList');
      toast({
        title: "Error",
        description: "Failed to close table",
        variant: "destructive"
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const resetToLobby = async (tableId: string, tableCode: string) => {
    setLoadingAction(`reset-${tableId}`);
    try {
      const { error } = await supabase
        .from('tables')
        .update({ status: 'lobby', current_round_id: null, phase_ends_at: null })
        .eq('id', tableId);

      if (error) throw error;

      toast({
        title: "Table Reset",
        description: `Table ${tableCode} has been reset to lobby`,
      });
      
      logger.info('Table reset to lobby by admin', { tableId, tableCode });
      onRefresh();
    } catch (error) {
      logger.error('Failed to reset table', error, 'ProblematicTablesList');
      toast({
        title: "Error",
        description: "Failed to reset table",
        variant: "destructive"
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const forceCleanupTable = async (tableId: string, tableCode: string) => {
    setLoadingAction(`cleanup-${tableId}`);
    try {
      // First run the cleanup function
      const { error: cleanupError } = await supabase.rpc('comprehensive_cleanup_stuck_tables');
      if (cleanupError) throw cleanupError;

      toast({
        title: "Cleanup Completed",
        description: `Forced cleanup on table ${tableCode}`,
      });
      
      logger.info('Table cleanup forced by admin', { tableId, tableCode });
      onRefresh();
    } catch (error) {
      logger.error('Failed to cleanup table', error, 'ProblematicTablesList');
      toast({
        title: "Error",
        description: "Failed to cleanup table",
        variant: "destructive"
      });
    } finally {
      setLoadingAction(null);
    }
  };

  if (tables.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            Running Tables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-green-700">All Clear!</p>
            <p className="text-sm text-muted-foreground">No problematic tables found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Running Tables ({tables.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tables.map((table) => (
            <Card key={table.id} className="border-l-4 border-l-yellow-400">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    {/* Table Info */}
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{table.code}</h3>
                      {table.title && (
                        <span className="text-sm text-muted-foreground">- {table.title}</span>
                      )}
                      {isStuck(table) && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Stuck
                        </Badge>
                      )}
                      {hasExpiredRound(table) && (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Expired Round
                        </Badge>
                      )}
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span>{table.participant_count || 0} participants</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-600" />
                        <span>Last active: {getTimeSinceLastActivity(table.lastActivity || table.updated_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-600" />
                        <span>Created: {new Date(table.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-green-600" />
                        <span>
                          Round: {table.round_status || 'none'}
                          {table.round_ends_at && hasExpiredRound(table) && (
                            <span className="text-red-600 ml-1">(expired)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/t/${table.code}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => forceCleanupTable(table.id, table.code)}
                      disabled={loadingAction === `cleanup-${table.id}`}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Cleanup
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetToLobby(table.id, table.code)}
                      disabled={loadingAction === `reset-${table.id}`}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => closeTable(table.id, table.code)}
                      disabled={loadingAction === `close-${table.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}