import { Block } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BookOpen } from 'lucide-react';

interface BlocksCardProps {
  blocks: Block[];
}

export function BlocksCard({ blocks }: BlocksCardProps) {
  if (blocks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5" />
            <span>Story Blocks</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Winning suggestions become building blocks of your collaborative story...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5" />
          <span>Story Blocks ({blocks.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] w-full">
          <div className="p-4 space-y-4">
            {blocks.map((block, index) => (
              <div key={block.id} className="relative">
                {index < blocks.length - 1 && (
                  <div className="absolute left-4 top-8 w-0.5 h-6 bg-border" />
                )}
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Block {index + 1}</p>
                    <p className="text-sm text-foreground leading-relaxed mt-1 font-medium">
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
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}