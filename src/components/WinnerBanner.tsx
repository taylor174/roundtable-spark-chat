import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown } from 'lucide-react';

interface WinnerBannerProps {
  roundNumber: number;
  winnerText: string;
  isTieBreak?: boolean;
}

export function WinnerBanner({ roundNumber, winnerText, isTieBreak = false }: WinnerBannerProps) {
  return (
    <Card className="border-primary/50 bg-primary/5 mb-6">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {isTieBreak ? (
              <Crown className="h-6 w-6 text-primary" />
            ) : (
              <Trophy className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-primary">
                Round {roundNumber} Winner
              </h3>
              {isTieBreak && (
                <Badge variant="secondary" className="text-xs">
                  Tie-break by Host
                </Badge>
              )}
            </div>
            <p className="text-foreground break-words">{winnerText}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}