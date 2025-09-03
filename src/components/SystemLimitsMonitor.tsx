import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, Users, Table } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SYSTEM_LIMITS } from "@/constants";

interface SystemLimitsStatus {
  tables: {
    running: number;
    total: number;
    max_simultaneous: number;
  };
  participants: {
    active: number;
    total: number;
    max_total: number;
  };
  rounds: {
    max_per_table: number;
    tables_at_limit: number;
  };
  capacity_status: 'healthy' | 'approaching_table_limit' | 'approaching_participant_limit' | 'tables_full' | 'participants_full';
}

interface SystemLimitsMonitorProps {
  compact?: boolean;
  refreshInterval?: number;
}

export const SystemLimitsMonitor: React.FC<SystemLimitsMonitorProps> = ({ 
  compact = false, 
  refreshInterval = 30000 
}) => {
  const [status, setStatus] = useState<SystemLimitsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('get_system_limits_status');
      if (error) throw error;
      setStatus(data as unknown as SystemLimitsStatus);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch system limits status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    const interval = setInterval(fetchStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getStatusColor = (capacityStatus: string) => {
    switch (capacityStatus) {
      case 'healthy': return 'bg-success text-success-foreground';
      case 'approaching_table_limit':
      case 'approaching_participant_limit': return 'bg-warning text-warning-foreground';
      case 'tables_full':
      case 'participants_full': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (capacityStatus: string) => {
    switch (capacityStatus) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'approaching_table_limit':
      case 'approaching_participant_limit': return <Clock className="h-4 w-4" />;
      case 'tables_full':
      case 'participants_full': return <AlertTriangle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusMessage = (capacityStatus: string) => {
    switch (capacityStatus) {
      case 'healthy': return 'System Operating Normally';
      case 'approaching_table_limit': return 'Approaching Table Limit';
      case 'approaching_participant_limit': return 'Approaching Participant Limit';
      case 'tables_full': return 'Table Capacity Full - New Tables Blocked';
      case 'participants_full': return 'Participant Capacity Full';
      default: return 'Status Unknown';
    }
  };

  if (loading) {
    return (
      <Card className={compact ? "w-full" : ""}>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-2 bg-muted rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !status) {
    return (
      <Card className={compact ? "w-full" : ""}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Failed to load system status</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className="w-full">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(status.capacity_status)}
              <span className="text-sm font-medium">System Status</span>
            </div>
            <Badge className={getStatusColor(status.capacity_status)}>
              {getStatusMessage(status.capacity_status)}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Table className="h-3 w-3" />
                <span>Tables: {status.tables.running}/{status.tables.max_simultaneous}</span>
              </div>
              <Progress 
                value={(status.tables.running / status.tables.max_simultaneous) * 100} 
                className="h-1"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>Active: {status.participants.active}/{status.participants.max_total}</span>
              </div>
              <Progress 
                value={(status.participants.active / status.participants.max_total) * 100} 
                className="h-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon(status.capacity_status)}
          System Capacity Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Overall Status</span>
          <Badge className={getStatusColor(status.capacity_status)}>
            {getStatusMessage(status.capacity_status)}
          </Badge>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4" />
                <span className="text-sm font-medium">Running Tables</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {status.tables.running} / {status.tables.max_simultaneous}
                <span className="ml-1 text-xs">
                  ({Math.round((status.tables.running / status.tables.max_simultaneous) * 100)}%)
                </span>
              </span>
            </div>
            <Progress value={(status.tables.running / status.tables.max_simultaneous) * 100} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Active Participants</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {status.participants.active} / {status.participants.max_total}
                <span className="ml-1 text-xs">
                  ({Math.round((status.participants.active / status.participants.max_total) * 100)}%)
                </span>
              </span>
            </div>
            <Progress value={(status.participants.active / status.participants.max_total) * 100} />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-primary">{status.tables.total}</div>
              <div className="text-xs text-muted-foreground">Total Tables</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-primary">{status.participants.total}</div>
              <div className="text-xs text-muted-foreground">Total Participants</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-primary">{status.rounds.tables_at_limit}</div>
              <div className="text-xs text-muted-foreground">Tables at Round Limit</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};