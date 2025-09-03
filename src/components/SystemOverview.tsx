import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Table as TableIcon, 
  Play, 
  Pause, 
  XCircle,
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminDashboardData } from '@/hooks/useAdminDashboard';

interface SystemOverviewProps {
  data: AdminDashboardData;
  onRefresh: () => void;
}

export function SystemOverview({ data, onRefresh }: SystemOverviewProps) {
  const { tableSummary, systemStats, isLoading, lastUpdated } = data;

  const getHealthIcon = () => {
    switch (systemStats.systemHealth) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
    }
  };

  const getHealthColor = () => {
    switch (systemStats.systemHealth) {
      case 'healthy':
        return 'text-green-600 border-green-200 bg-green-50';
      case 'warning':
        return 'text-yellow-600 border-yellow-200 bg-yellow-50';
      case 'critical':
        return 'text-red-600 border-red-200 bg-red-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with System Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Overview
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge className={getHealthColor()} variant="outline">
                {getHealthIcon()}
                <span className="ml-2 capitalize">{systemStats.systemHealth}</span>
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TableIcon className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{tableSummary.totalTables}</p>
                <p className="text-xs text-muted-foreground">Total Tables</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{systemStats.activeParticipants}</p>
                <p className="text-xs text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{tableSummary.runningTables}</p>
                <p className="text-xs text-muted-foreground">Running Tables</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{systemStats.stuckTables}</p>
                <p className="text-xs text-muted-foreground">Stuck Tables</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Tables Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tables by Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pause className="h-4 w-4 text-gray-600" />
                <span>Lobby</span>
              </div>
              <Badge variant="secondary">{tableSummary.lobbyTables}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-green-600" />
                <span>Running</span>
              </div>
              <Badge variant="default">{tableSummary.runningTables}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span>Closed</span>
              </div>
              <Badge variant="outline">{tableSummary.closedTables}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* System Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Expired Rounds</span>
              <Badge 
                variant={systemStats.expiredRounds > 10 ? "destructive" : systemStats.expiredRounds > 5 ? "secondary" : "outline"}
              >
                {systemStats.expiredRounds}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Tables Stuck {'>'}24h</span>
              <Badge 
                variant={systemStats.stuckTables > 5 ? "destructive" : systemStats.stuckTables > 0 ? "secondary" : "outline"}
              >
                {systemStats.stuckTables}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>System Health</span>
              <Badge 
                className={getHealthColor()}
                variant="outline"
              >
                {systemStats.systemHealth}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}