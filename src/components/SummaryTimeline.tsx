import { Block, Participant } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users } from 'lucide-react';

interface SummaryTimelineProps {
  blocks: Block[];
  originalTitle?: string;
  participants: Participant[];
}

export function SummaryTimeline({ blocks, originalTitle, participants }: SummaryTimelineProps) {
  if (blocks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Discussion Thread</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No rounds completed yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Discussion Thread</span>
          </div>
          <Badge variant="secondary" className="flex items-center space-x-1">
            <Users className="h-3 w-3" />
            <span>{participants.length}</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Original Topic */}
        {originalTitle && (
          <div className="relative">
            {blocks.length > 0 && (
              <div className="absolute left-6 top-12 w-0.5 h-8 bg-gradient-to-b from-border to-transparent" />
            )}
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-lg">💭</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-semibold text-primary mb-2">Original Topic</h3>
                  <p className="text-foreground leading-relaxed">
                    {originalTitle}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Completed Rounds */}
        {blocks.map((block, index) => (
          <div key={block.id} className="relative">
            {index < blocks.length - 1 && (
              <div className="absolute left-6 top-16 w-0.5 h-8 bg-gradient-to-b from-primary/30 to-transparent" />
            )}
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center font-bold shadow-sm">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                  <div className="bg-card border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-primary">
                        Round {index + 1} Winner{block.winnerName ? ` - ${block.winnerName}` : ''}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {new Date(block.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                    <p className="text-foreground leading-relaxed mb-3">
                      {block.text}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(block.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
              </div>
            </div>
          </div>
        ))}

        {/* Summary Footer */}
        <div className="pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Discussion completed with {blocks.length} round{blocks.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}