import { Block, Round } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface TimelineProps {
  blocks: Block[];
  rounds: Round[];
}

export function Timeline({ blocks, rounds }: TimelineProps) {
  if (blocks.length === 0) {
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
          <span>Timeline ({blocks.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] w-full">
          <div className="p-4 space-y-4">
            {blocks.map((block, index) => {
              const round = rounds.find(r => r.id === block.round_id);
              const roundNumber = round?.number || index + 1;
              const isTieBreak = round?.winner_suggestion_id === block.suggestion_id;
              
              return (
                <div key={block.id} className="relative">
                  {index < blocks.length - 1 && (
                    <div className="absolute left-4 top-8 w-0.5 h-6 bg-border" />
                  )}
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                      {roundNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">
                          Round {roundNumber} — Winner{isTieBreak ? ' (Tie-break)' : ''}
                        </p>
                        {isTieBreak && (
                          <Badge variant="secondary" className="text-xs">
                            Tie-break by Host
                          </Badge>
                        )}
                      </div>
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
                  {index < blocks.length - 1 && <Separator className="mt-4" />}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}