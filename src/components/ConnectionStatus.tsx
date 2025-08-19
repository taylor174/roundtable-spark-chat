import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Zap } from 'lucide-react';

export function ConnectionStatus() {
  const { quality, isConnected, lastSeen } = useConnectionMonitor();

  if (quality === 'good') return null; // Don't show when connection is good

  const getStatusConfig = () => {
    switch (quality) {
      case 'poor':
        return {
          icon: Zap,
          text: 'Slow Connection',
          variant: 'secondary' as const,
          className: 'text-yellow-600 border-yellow-200'
        };
      case 'offline':
        return {
          icon: WifiOff,
          text: isConnected ? 'Reconnecting...' : 'Offline',
          variant: 'destructive' as const,
          className: ''
        };
      default:
        return {
          icon: Wifi,
          text: 'Connected',
          variant: 'default' as const,
          className: ''
        };
    }
  };

  const { icon: Icon, text, variant, className } = getStatusConfig();

  return (
    <Badge variant={variant} className={`flex items-center gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs">{text}</span>
      {lastSeen && quality === 'offline' && (
        <span className="text-xs opacity-70">
          {Math.round((Date.now() - lastSeen.getTime()) / 1000)}s ago
        </span>
      )}
    </Badge>
  );
}