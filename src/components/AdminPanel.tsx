import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Activity, Shield } from 'lucide-react';
import { SystemHealthMonitor } from '@/components/SystemHealthMonitor';
import { QAMonitor } from '@/components/QAMonitor';
import { useAdminCheck } from '@/hooks/useAdminCheck';

/**
 * Admin panel that shows system health and QA controls
 * Only visible to admin users
 */
export function AdminPanel() {
  const { isAdmin } = useAdminCheck();

  // Don't render anything if user is not admin
  if (!isAdmin) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-md">
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4" />
            Admin Panel
            <Badge variant="secondary" className="ml-auto">
              <Settings className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            System monitoring and quality assurance
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* System Health Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">System Health</span>
            </div>
            <SystemHealthMonitor isAdminPanel />
          </div>

          {/* QA Monitor Section */}
          <div>
            <QAMonitor />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}