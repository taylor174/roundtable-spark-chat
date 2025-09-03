import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { useAuth } from '@/contexts/AuthContext';

export interface TableSummary {
  totalTables: number;
  lobbyTables: number;
  runningTables: number;
  closedTables: number;
}

export interface ProblematicTable {
  id: string;
  code: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  current_round_id: string | null;
  round_status?: string | null;
  round_ends_at?: string | null;
  participant_count?: number;
  lastActivity?: string;
}

export interface SystemStats {
  activeParticipants: number;
  expiredRounds: number;
  stuckTables: number;
  averageSessionDuration: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export interface AdminDashboardData {
  tableSummary: TableSummary;
  problematicTables: ProblematicTable[];
  systemStats: SystemStats;
  isLoading: boolean;
  lastUpdated: Date | null;
}

export function useAdminDashboard() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<AdminDashboardData>({
    tableSummary: {
      totalTables: 0,
      lobbyTables: 0,
      runningTables: 0,
      closedTables: 0,
    },
    problematicTables: [],
    systemStats: {
      activeParticipants: 0,
      expiredRounds: 0,
      stuckTables: 0,
      averageSessionDuration: 0,
      systemHealth: 'healthy',
    },
    isLoading: true,
    lastUpdated: null,
  });

  const fetchDashboardData = useCallback(async () => {
    if (!isAdmin || authLoading) {
      setData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setData(prev => ({ ...prev, isLoading: true }));

      // Use admin-secured function for system stats
      const { data: adminStatsData, error: adminStatsError } = await supabase.rpc('get_admin_system_stats');
      
      if (adminStatsError) {
        logger.error('Failed to fetch admin system stats', adminStatsError, 'AdminDashboard');
        throw adminStatsError;
      }

      // Parse the system stats
      const systemData = adminStatsData as any;
      const tableSummary: TableSummary = {
        totalTables: systemData.total_tables || 0,
        runningTables: systemData.running_tables || 0,
        lobbyTables: 0, // Will calculate separately
        closedTables: 0, // Will calculate separately
      };

      // Fetch table breakdown (public data only - no host_secret)
      const { data: tableCountData } = await supabase
        .from('tables')
        .select('status', { count: 'exact' });

      if (tableCountData) {
        tableSummary.lobbyTables = tableCountData.filter(t => t.status === 'lobby').length;
        tableSummary.closedTables = tableCountData.filter(t => t.status === 'closed').length;
        tableSummary.totalTables = tableCountData.length;
      }

      // Fetch problematic tables (only public data - no host_secret)
      const { data: problematicTablesData } = await supabase
        .from('tables')
        .select(`
          id, code, title, status, created_at, updated_at, current_round_id,
          rounds!inner(id, status, ends_at)
        `)
        .eq('status', 'running')
        .order('updated_at', { ascending: false });

      // Get participant counts for running tables
      const runningTableIds = problematicTablesData?.map(t => t.id) || [];
      const { data: participantCounts } = runningTableIds.length > 0 
        ? await supabase
            .from('participants')
            .select('table_id, id', { count: 'exact' })
            .in('table_id', runningTableIds)
        : { data: [] };

      const participantCountMap = (participantCounts || []).reduce((acc, p) => {
        acc[p.table_id] = (acc[p.table_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const problematicTables: ProblematicTable[] = (problematicTablesData || []).map(table => {
        const round = Array.isArray(table.rounds) ? table.rounds[0] : table.rounds;
        return {
          id: table.id,
          code: table.code,
          title: table.title,
          status: table.status,
          created_at: table.created_at,
          updated_at: table.updated_at,
          current_round_id: table.current_round_id,
          round_status: round?.status || null,
          round_ends_at: round?.ends_at || null,
          participant_count: participantCountMap[table.id] || 0,
          lastActivity: table.updated_at,
        };
      });

      const stuckTables = problematicTables.filter(t => {
        const lastActivity = new Date(t.lastActivity || t.updated_at);
        const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
        return hoursSinceActivity > 24;
      }).length;

      let systemHealth: SystemStats['systemHealth'] = 'healthy';
      if (stuckTables > 10 || systemData.expired_rounds > 20) {
        systemHealth = 'critical';
      } else if (stuckTables > 5 || systemData.expired_rounds > 10) {
        systemHealth = 'warning';
      }

      const systemStats: SystemStats = {
        activeParticipants: systemData.active_participants || 0,
        expiredRounds: systemData.expired_rounds || 0,
        stuckTables,
        averageSessionDuration: 0, // TODO: Calculate based on session data
        systemHealth,
      };

      setData({
        tableSummary,
        problematicTables,
        systemStats,
        isLoading: false,
        lastUpdated: new Date(),
      });

      logger.info('Admin dashboard data updated', {
        component: 'AdminDashboard',
        tableSummary,
        systemStats: { ...systemStats, problematicTablesCount: problematicTables.length },
      });

    } catch (error) {
      logger.error('Failed to fetch admin dashboard data', error, 'AdminDashboard');
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, [isAdmin, authLoading]);

  useEffect(() => {
    fetchDashboardData();
    
    // Refresh every 2 minutes, but only if user is admin
    const interval = setInterval(() => {
      if (isAdmin && !authLoading) {
        fetchDashboardData();
      }
    }, 120000);
    
    return () => clearInterval(interval);
  }, [fetchDashboardData, isAdmin, authLoading]);

  return {
    ...data,
    refreshData: fetchDashboardData,
  };
}