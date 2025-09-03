import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

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
    try {
      setData(prev => ({ ...prev, isLoading: true }));

      // Fetch table summary
      const { data: tableCountData } = await supabase
        .from('tables')
        .select('status', { count: 'exact' });

      const tableSummary: TableSummary = {
        totalTables: tableCountData?.length || 0,
        lobbyTables: tableCountData?.filter(t => t.status === 'lobby').length || 0,
        runningTables: tableCountData?.filter(t => t.status === 'running').length || 0,
        closedTables: tableCountData?.filter(t => t.status === 'closed').length || 0,
      };

      // Fetch problematic tables (running tables with details)
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

      // Fetch system statistics
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: activeParticipantsData } = await supabase
        .from('participants')
        .select('id', { count: 'exact' })
        .gte('last_seen_at', tenMinutesAgo)
        .eq('is_online', true);

      const { data: expiredRoundsData } = await supabase
        .from('rounds')
        .select('id', { count: 'exact' })
        .in('status', ['suggest', 'vote'])
        .lt('ends_at', new Date().toISOString());

      const activeParticipants = activeParticipantsData?.length || 0;
      const expiredRounds = expiredRoundsData?.length || 0;
      const stuckTables = problematicTables.filter(t => {
        const lastActivity = new Date(t.lastActivity || t.updated_at);
        const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
        return hoursSinceActivity > 24;
      }).length;

      let systemHealth: SystemStats['systemHealth'] = 'healthy';
      if (stuckTables > 10 || expiredRounds > 20) {
        systemHealth = 'critical';
      } else if (stuckTables > 5 || expiredRounds > 10) {
        systemHealth = 'warning';
      }

      const systemStats: SystemStats = {
        activeParticipants,
        expiredRounds,
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
  }, []);

  useEffect(() => {
    fetchDashboardData();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchDashboardData, 120000);
    
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  return {
    ...data,
    refreshData: fetchDashboardData,
  };
}