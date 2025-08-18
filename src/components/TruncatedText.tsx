import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface TruncatedTextProps {
  text: string;
  maxLength?: number;
  className?: string;
}

export function TruncatedText({ text, maxLength = 200, className = "" }: TruncatedTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (text.length <= maxLength) {
    return <p className={className}>{text}</p>;
  }

  const truncatedText = text.slice(0, maxLength).trim() + '...';

  return (
    <div className={className}>
      <p className="mb-2">
        {isExpanded ? text : truncatedText}
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </Button>
    </div>
  );
}