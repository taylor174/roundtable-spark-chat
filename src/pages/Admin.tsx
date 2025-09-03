import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Shield, Database, Zap, Activity } from 'lucide-react';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { SystemOverview } from '@/components/SystemOverview';
import { ProblematicTablesList } from '@/components/ProblematicTablesList';
import { QuickActions } from '@/components/QuickActions';
import { QAMonitor } from '@/components/QAMonitor';


export default function AdminPage() {
  const dashboardData = useAdminDashboard();

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Administration</h1>
          <p className="text-muted-foreground">
            Comprehensive system monitoring, management, and quality assurance
          </p>
        </div>
        <Badge variant="secondary" className="px-4 py-2">
          <Shield className="h-4 w-4 mr-2" />
          Administrator
        </Badge>
      </div>

      {/* System Overview */}
      <SystemOverview 
        data={dashboardData} 
        onRefresh={dashboardData.refreshData} 
      />


      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Problematic Tables */}
          <ProblematicTablesList 
            tables={dashboardData.problematicTables}
            onRefresh={dashboardData.refreshData}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Quick Actions */}
          <QuickActions
            onRefresh={dashboardData.refreshData}
            runningTablesCount={dashboardData.tableSummary.runningTables}
            expiredRoundsCount={dashboardData.systemStats.expiredRounds}
          />
          
          {/* Quality Assurance Monitor */}
          <QAMonitor />
        </div>
      </div>
    </div>
  );
}