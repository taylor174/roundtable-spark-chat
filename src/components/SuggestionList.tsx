import { SuggestionWithVotes } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TruncatedText } from '@/components/TruncatedText';

interface SuggestionListProps {
  suggestions: SuggestionWithVotes[];
}

export function SuggestionList({ suggestions }: SuggestionListProps) {
  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No suggestions yet. Be the first to share an idea!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <Card key={suggestion.id}>
          <CardContent className="pt-4">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <TruncatedText text={suggestion.text} />
              </div>
              <Badge variant="secondary" className="shrink-0 mt-1">
                {suggestion.voteCount} {suggestion.voteCount === 1 ? 'vote' : 'votes'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}