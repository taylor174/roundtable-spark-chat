import { Block, Participant, Round, Suggestion, Vote } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Clock, Users, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { useState } from 'react';

interface SummaryTimelineProps {
  blocks: Block[];
  originalTitle?: string;
  participants: Participant[];
  rounds?: Round[];
  suggestions?: Suggestion[];
  votes?: Vote[];
}

interface RoundSuggestion extends Suggestion {
  authorName: string;
  voteCount: number;
  percentage: number;
  isWinner: boolean;
}

export function SummaryTimeline({ blocks, originalTitle, participants, rounds = [], suggestions = [], votes = [] }: SummaryTimelineProps) {
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  
  const toggleRound = (roundId: string) => {
    const newExpanded = new Set(expandedRounds);
    if (newExpanded.has(roundId)) {
      newExpanded.delete(roundId);
    } else {
      newExpanded.add(roundId);
    }
    setExpandedRounds(newExpanded);
  };

  // Process rounds data to include all suggestions with vote counts
  const processedRounds = rounds.map(round => {
    const roundSuggestions = suggestions.filter(s => s.round_id === round.id);
    const roundVotes = votes.filter(v => v.round_id === round.id);
    
    const suggestionsWithVotes: RoundSuggestion[] = roundSuggestions.map(suggestion => {
      const suggestionVotes = roundVotes.filter(v => v.suggestion_id === suggestion.id);
      const voteCount = suggestionVotes.length;
      const percentage = roundVotes.length > 0 ? (voteCount / roundVotes.length) * 100 : 0;
      const author = participants.find(p => p.id === suggestion.participant_id);
      const isWinner = round.winner_suggestion_id === suggestion.id;
      
      return {
        ...suggestion,
        authorName: author?.display_name || 'Unknown',
        voteCount,
        percentage,
        isWinner
      };
    });

    // Sort suggestions by vote count (highest first)
    suggestionsWithVotes.sort((a, b) => b.voteCount - a.voteCount);
    
    return {
      ...round,
      suggestions: suggestionsWithVotes,
      totalVotes: roundVotes.length
    };
  });
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
        {processedRounds.map((round, index) => {
          const isExpanded = expandedRounds.has(round.id);
          const block = blocks.find(b => b.round_id === round.id);
          
          return (
            <div key={round.id} className="relative">
              {index < processedRounds.length - 1 && (
                <div className="absolute left-6 top-16 w-0.5 h-8 bg-gradient-to-b from-primary/30 to-transparent" />
              )}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center font-bold shadow-sm">
                  {round.number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-card border rounded-lg shadow-sm">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleRound(round.id)}>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-primary">
                              Round {round.number}
                            </h3>
                            {block?.winnerName && (
                              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <Trophy className="h-3 w-3" />
                                {block.winnerName}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {round.suggestions.length} suggestions
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {round.totalVotes} votes
                            </Badge>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        
                        {/* Winner display */}
                        {block && (
                          <div className="bg-muted/50 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Trophy className="h-4 w-4 text-yellow-600" />
                              <span className="font-medium text-sm">Winning Selection</span>
                            </div>
                            <p className="text-sm leading-relaxed">{block.text}</p>
                          </div>
                        )}
                        
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(round.started_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      
                      <CollapsibleContent>
                        <div className="border-t px-4 pb-4">
                          <div className="mt-4 space-y-3">
                            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                              <span>💭</span>
                              All Suggestions & Votes
                            </h4>
                            {round.suggestions.length > 0 ? (
                              <div className="space-y-2">
                                {round.suggestions.map((suggestion, suggestionIndex) => (
                                  <div 
                                    key={suggestion.id} 
                                    className={`p-3 rounded-lg border transition-colors ${
                                      suggestion.isWinner 
                                        ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800' 
                                        : 'bg-muted/30 border-border'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-medium text-muted-foreground">
                                            #{suggestionIndex + 1}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            by {suggestion.authorName}
                                          </span>
                                          {suggestion.isWinner && (
                                            <Badge variant="default" className="text-xs">
                                              Winner
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-sm leading-relaxed">{suggestion.text}</p>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <Badge 
                                          variant={suggestion.voteCount > 0 ? "secondary" : "outline"} 
                                          className="text-xs"
                                        >
                                          {suggestion.voteCount} vote{suggestion.voteCount !== 1 ? 's' : ''}
                                        </Badge>
                                        {round.totalVotes > 0 && (
                                          <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                            <div 
                                              className="h-full bg-primary transition-all duration-500"
                                              style={{ width: `${suggestion.percentage}%` }}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No suggestions submitted in this round
                              </p>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

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