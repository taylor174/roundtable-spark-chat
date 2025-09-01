import { Block, Round } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Clock, Timer } from 'lucide-react';


interface TimelineProps {
  blocks: Block[];
  currentRound: Round | null;
  originalTitle?: string;
}

export function Timeline({ blocks, currentRound, originalTitle }: TimelineProps) {
  // Calculate total rounds including current pending round
  const totalRounds = currentRound ? currentRound.number : blocks.length;
  const hasPendingTieBreak = currentRound?.status === 'result' && 
    !blocks.find(block => block.round_id === currentRound.id);

  if (blocks.length === 0 && !hasPendingTieBreak) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Timeline</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Completed rounds will appear here...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Discussion Thread</span>
          </CardTitle>
        </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] w-full">
          <div className="p-4 space-y-4">
            {/* Show original topic first */}
            {originalTitle && (
              <div className="relative">
                {(blocks.length > 0 || hasPendingTieBreak) && (
                  <div className="absolute left-4 top-8 w-0.5 h-6 bg-border" />
                )}
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
                    📝
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Original Topic</p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                      {originalTitle}
                    </p>
                  </div>
                </div>
                {(blocks.length > 0 || hasPendingTieBreak) && <Separator className="mt-4" />}
              </div>
            )}
            
            {/* Render completed rounds from blocks */}
            {blocks.map((block, index) => (
              <div key={block.id} className="relative">
                {(index < blocks.length - 1 || hasPendingTieBreak) && (
                  <div className="absolute left-4 top-8 w-0.5 h-6 bg-border" />
                )}
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      Round {index + 1} Winner{block.winnerName ? ` - ${block.winnerName}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                      {block.text}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(block.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                {(index < blocks.length - 1 || hasPendingTieBreak) && <Separator className="mt-4" />}
              </div>
            ))}
            
            {/* Render pending tie-break round */}
            {hasPendingTieBreak && (
              <div className="relative">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-medium">
                    <Timer className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Round {currentRound.number}</p>
                    <p className="text-sm text-orange-600 leading-relaxed mt-1">
                      Pending tie-break - waiting for host decision
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      In progress...
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}