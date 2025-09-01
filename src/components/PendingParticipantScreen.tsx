
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Timer } from '@/components/Timer';
import { calculateTimeRemaining } from '@/utils';
import { Clock, Users, Play } from 'lucide-react';

interface PendingParticipantScreenProps {
  currentRound: any;
  activeFromRound: number;
  participantName: string;
  timeRemaining: number;
  onRefresh?: () => void;
}

export function PendingParticipantScreen({
  currentRound,
  activeFromRound,
  participantName,
  timeRemaining,
  onRefresh
}: PendingParticipantScreenProps) {
  const [countdown, setCountdown] = useState(timeRemaining);

  useEffect(() => {
    setCountdown(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const roundsToWait = activeFromRound - (currentRound?.number || 1);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Waiting to Join</CardTitle>
          <p className="text-muted-foreground">
            Hi {participantName}! You'll be able to participate starting from round {activeFromRound}.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <Badge variant="outline" className="gap-1">
                  <Play className="h-3 w-3" />
                  Round {currentRound?.number || 1} in Progress
                </Badge>
              </div>
              
              {roundsToWait > 0 && (
                <p className="text-sm text-muted-foreground">
                  {roundsToWait === 1 
                    ? "You'll join the next round"
                    : `${roundsToWait} rounds until you can participate`
                  }
                </p>
              )}
            </div>

            {currentRound?.ends_at && countdown > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Current phase ends in:</p>
                <div className="text-2xl font-mono font-bold text-primary">
                  <Timer 
                    timeRemaining={countdown}
                    phase={currentRound.status}
                    isActive={true}
                  />
                </div>
              </div>
            )}

            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>You can observe the current discussion</span>
              </div>
            </div>
          </div>

          {onRefresh && (
            <Button onClick={onRefresh} variant="outline" className="w-full">
              Refresh Status
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
