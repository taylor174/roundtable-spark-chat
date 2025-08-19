import { useEffect, useState } from 'react';
import { useConnectionQuality } from '@/hooks/useConnectionQuality';
import { useSessionValidator } from '@/hooks/useSessionValidator';
import { Shield, Wifi, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ReliabilityMonitorProps {
  tableId: string | null;
  clientId: string;
  participantCount: number;
  isHost: boolean;
}

export function ReliabilityMonitor({ 
  tableId, 
  clientId, 
  participantCount, 
  isHost 
}: ReliabilityMonitorProps) {
  const { quality } = useConnectionQuality();
  const { validateSession } = useSessionValidator(tableId, clientId);
  const [systemHealth, setSystemHealth] = useState<'excellent' | 'good' | 'warning' | 'critical'>('excellent');

  useEffect(() => {
    // Calculate overall system health
    let health: typeof systemHealth = 'excellent';

    if (quality.level === 'disconnected') {
      health = 'critical';
    } else if (quality.level === 'poor' || participantCount > 40) {
      health = 'warning';
    } else if (quality.level === 'good' || participantCount > 25) {
      health = 'good';
    }

    setSystemHealth(health);
  }, [quality.level, participantCount]);

  if (!isHost) return null; // Only show to hosts

  const getHealthColor = () => {
    switch (systemHealth) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
    }
  };

  const getQualityBadge = () => {
    const colors = {
      excellent: 'bg-green-100 text-green-800',
      good: 'bg-blue-100 text-blue-800',
      poor: 'bg-yellow-100 text-yellow-800',
      disconnected: 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={colors[quality.level]}>
        {quality.level} ({quality.latency}ms)
      </Badge>
    );
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          System Health
          <div className={`w-2 h-2 rounded-full ${getHealthColor()}`} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Connection</span>
          </div>
          {getQualityBadge()}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Participants</span>
          </div>
          <Badge variant={participantCount > 40 ? 'destructive' : participantCount > 25 ? 'secondary' : 'default'}>
            {participantCount}/50
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Last Check</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {quality.lastCheck.toLocaleTimeString()}
          </span>
        </div>

        {quality.warnings.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            <div className="font-medium">Warnings:</div>
            <ul className="list-disc list-inside">
              {quality.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}