import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Block } from '@/types';
import { History, Crown } from 'lucide-react';

interface BlocksSidebarProps {
  blocks: Block[];
  onViewTimeline?: () => void;
}

export function BlocksSidebar({ blocks, onViewTimeline }: BlocksSidebarProps) {
  if (blocks.length === 0) {
    return (
      <Card>
        <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-sm">
            <History className="h-4 w-4" />
            <span>Blocks So Far</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No blocks yet. Complete rounds to see them here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <History className="h-4 w-4" />
            <span>Blocks So Far</span>
          </div>
          <Badge variant="secondary">{blocks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px] pr-3">
          <div className="space-y-2">
            {blocks.map((block, index) => (
              <div 
                key={block.id}
                className="p-2 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={onViewTimeline}
              >
                <div className="flex items-start justify-between">
                  <span className="font-medium text-xs text-muted-foreground">
                    Block #{index + 1}
                  </span>
                  {block.is_tie_break && (
                    <Crown className="h-3 w-3 text-orange-500" />
                  )}
                </div>
                <p className="text-sm mt-1 line-clamp-2">{block.text}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {onViewTimeline && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-3"
            onClick={onViewTimeline}
          >
            <History className="h-3 w-3 mr-1" />
            View Full Timeline
          </Button>
        )}
      </CardContent>
    </Card>
  );
}