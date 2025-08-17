import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

interface DiscussionContextCardProps {
  description: string;
}

export function DiscussionContextCard({ description }: DiscussionContextCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Check if description is long enough to warrant collapse/expand
  const isLongDescription = description.length > 300;
  const shouldShowToggle = isLongDescription;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          <span>Discussion Context</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div 
          className={`text-muted-foreground whitespace-pre-wrap break-words leading-relaxed transition-all duration-300 ${
            !isExpanded && shouldShowToggle 
              ? 'line-clamp-6 overflow-hidden' 
              : ''
          }`}
        >
          {description}
        </div>
        {shouldShowToggle && (
          <div className="mt-3 pt-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show more
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}