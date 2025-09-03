import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Activity, Shield, TestTube } from 'lucide-react';
import { SystemHealthMonitor } from '@/components/SystemHealthMonitor';
import { QAMonitor } from '@/components/QAMonitor';

export default function AdminPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            System monitoring, quality assurance, and administrative controls
          </p>
        </div>
        <Badge variant="secondary" className="px-4 py-2">
          <Shield className="h-4 w-4 mr-2" />
          Administrator
        </Badge>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* System Health Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
            <CardDescription>
              Monitor system performance and run cleanup operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SystemHealthMonitor isAdminPanel={false} />
          </CardContent>
        </Card>

        {/* Quality Assurance Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Quality Assurance
            </CardTitle>
            <CardDescription>
              Run comprehensive tests and generate reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QAMonitor />
          </CardContent>
        </Card>
      </div>

      {/* Additional Admin Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Administrative Tools
          </CardTitle>
          <CardDescription>
            Additional system controls and utilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            More admin tools can be added here as needed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}