import { useParams, useNavigate } from 'react-router-dom';
import { getHostSecret } from '@/utils/clientId';
import { useTableState } from '@/hooks/useTableStateOptimized';
import { usePhaseManager } from '@/hooks/usePhaseManager';
import { Timer } from '@/components/Timer';
import { SuggestionForm } from '@/components/SuggestionForm';
import { SuggestionList } from '@/components/SuggestionList';
import { VoteList } from '@/components/VoteList';
import { ResultsPanel } from '@/components/ResultsPanel';
import { BlocksCard } from '@/components/BlocksCard';
import { HostControls } from '@/components/HostControls';
import { TableInfo } from '@/components/TableInfo';
import { DiscussionContextCard } from '@/components/DiscussionContextCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  getSuggestionsWithVotes, 
  getWinningSuggestions,
  advanceRound,
  endRound
} from '@/utils/roundLogic';
import { SuggestionWithVotes, WinningSuggestion } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { MESSAGES } from '@/constants';
import { Users, Clock, List, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { VotingStatusIndicator } from '@/components/VotingStatusIndicator';

const Table = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
  const {
    table,
    participants,
    currentRound,
    suggestions,
    votes,
    blocks,
    currentParticipant,
    clientId,
    isHost,
    timeRemaining,
    loading,
    error,
    currentPhase,
    refresh,
  } = useTableState(code || '');
  
  const [suggestionsWithVotes, setSuggestionsWithVotes] = useState<SuggestionWithVotes[]>([]);
  const [winningSuggestions, setWinningSuggestions] = useState<WinningSuggestion[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { toast } = useToast();

  // Redirect non-hosts to join page if they don't have a participant record
  useEffect(() => {
    if (!code || loading) return;
    
    const checkParticipant = async () => {
      if (!currentParticipant && !getHostSecret(code)) {
        // Not a participant and not a host, redirect to join
        navigate(`/t/${code}/join`);
      }
    };

    checkParticipant();
  }, [code, currentParticipant, loading, navigate]);
  
  // Load suggestions with votes
  useEffect(() => {
    const loadSuggestionsWithVotes = async () => {
      if (!currentRound) {
        setSuggestionsWithVotes([]);
        return;
      }
      
      try {
        const data = await getSuggestionsWithVotes(currentRound.id, clientId);
        setSuggestionsWithVotes(data);
        setWinningSuggestions(getWinningSuggestions(data));
      } catch (error) {
        console.error('Error loading suggestions with votes:', error);
        setSuggestionsWithVotes([]);
      }
    };

    loadSuggestionsWithVotes();
  }, [currentRound, suggestions, votes, clientId]);
  
  const userHasVoted = currentParticipant 
    ? votes.some(vote => vote.participant_id === currentParticipant.id)
    : false;
    
  
  // Automatic phase management (disabled during manual transitions)
  usePhaseManager(table, currentRound, suggestions, votes, timeRemaining, clientId, isTransitioning ? undefined : refresh);
  
  // Event handlers
  const handleWinnerSelected = async (suggestionId: string) => {
    if (!table || !currentRound || isTransitioning) return;
    
    try {
      setIsTransitioning(true);
      
      const winningSuggestion = suggestionsWithVotes.find(s => s.id === suggestionId);
      if (winningSuggestion) {
        await endRound(currentRound.id, table.id, winningSuggestion.text);
        toast({
          title: "Success",
          description: "Winner selected!",
        });
        
        // Don't call refresh immediately - let real-time updates handle it
        setTimeout(() => {
          setIsTransitioning(false);
        }, 1500);
      }
    } catch (error) {
      console.error('Error selecting winner:', error);
      toast({
        title: "Error",
        description: "Failed to select winner. Please try again.",
        variant: "destructive",
      });
      setIsTransitioning(false);
    }
  };
  
  const handleNextRound = async () => {
    if (!table || !currentRound || isTransitioning) return;
    
    try {
      setIsTransitioning(true);
      
      await advanceRound(table.id, currentRound.number);
      
      toast({
        title: "Success", 
        description: "Next round started!",
      });
      
      // Extended transition time to handle all real-time updates
      setTimeout(() => {
        setIsTransitioning(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error starting next round:', error);
      toast({
        title: "Error",
        description: "Failed to start next round. Please try again.",
        variant: "destructive",
      });
      setIsTransitioning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 md:gap-6">
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-60 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 md:p-6">
        <Alert className="max-w-md">
          <AlertDescription>
            {error || 'Table not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight break-words">{table.title || `Session ${table.code}`}</h1>
              <p className="text-lg text-muted-foreground mt-1">
                {currentPhase === 'lobby' ? 'Waiting to start' : 
                 currentPhase === 'suggest' ? 'Suggestion Phase' :
                 currentPhase === 'vote' ? 'Voting Phase' : 'Results'} • {participants.length} participants
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              <TableInfo
                tableCode={table.code}
                participantCount={participants.length}
                isHost={isHost}
              />
              {currentPhase !== 'lobby' && (
                <div className="text-right">
                  <Timer 
                    timeRemaining={timeRemaining}
                    phase={currentPhase}
                    isActive={table.status === 'running'}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 relative">
        {/* Loading Overlay */}
        {isTransitioning && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Transitioning to next round...</p>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 md:gap-6">
          {/* Main Content */}
          <div className={`space-y-6 transition-all duration-300 ${isTransitioning ? 'opacity-30' : ''}`}>
            {/* Current Phase Content */}
            {currentPhase === 'lobby' && (
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Play className="h-5 w-5" />
                    <span>Waiting to Start</span>
                  </CardTitle>
                </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="text-center py-8">
                  <p className="text-lg mb-4">{MESSAGES.WAITING_FOR_HOST}</p>
                    {isHost && (
                      <p className="text-muted-foreground">
                        Use the host controls on the right to configure and start the table.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Suggestion Phase - Show to participants and hosts */}
            {currentPhase === 'suggest' && (
              <div className="animate-fade-in space-y-6">
                {currentParticipant && currentRound && (
                  <SuggestionForm
                    roundId={currentRound.id}
                    participantId={currentParticipant.id}
                  />
                )}
                <SuggestionList 
                  suggestions={suggestionsWithVotes}
                />
              </div>
            )}
            
            {/* Voting Phase - Show to participants and hosts */}
            {currentPhase === 'vote' && (
              <div className="animate-fade-in">
                {currentParticipant && currentRound && (
                  <VoteList
                    suggestions={suggestionsWithVotes}
                    roundId={currentRound.id}
                    participantId={currentParticipant.id}
                    userHasVoted={userHasVoted}
                  />
                )}
              </div>
            )}
            
            {/* Results Phase */}
            {currentPhase === 'result' && winningSuggestions.length > 0 && (
              <div className="animate-fade-in">
                <ResultsPanel
                  winningSuggestions={winningSuggestions}
                  isHost={isHost}
                  roundNumber={currentRound?.number}
                  tableId={table?.id}
                  roundId={currentRound?.id}
                  onWinnerSelected={handleWinnerSelected}
                  onNextRound={handleNextRound}
                  isTransitioning={isTransitioning}
                />
              </div>
            )}

            {/* Show suggestions in voting and results phases */}
            {(currentPhase === 'vote' || currentPhase === 'result') && suggestionsWithVotes.length > 0 && (
              <SuggestionList 
                suggestions={suggestionsWithVotes}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className={`space-y-6 transition-all duration-300 ${isTransitioning ? 'opacity-30' : ''}`}>
            {/* Discussion Context Card */}
            {table.description && (
              <DiscussionContextCard description={table.description} />
            )}
            
            {/* Participants */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Participants ({participants.length})</span>
                </CardTitle>
              </CardHeader>
               <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    {participants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between">
                        <span>{participant.display_name}</span>
                        {participant.is_host && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                            Host
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Show voting status during voting phase */}
                  {currentPhase === 'vote' && isHost && currentRound && (
                    <VotingStatusIndicator 
                      participants={participants}
                      votes={votes}
                      currentRound={currentRound}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Host Controls */}
            {isHost && (
              <HostControls
                table={table}
                canStart={true}
                currentPhase={currentPhase}
                participantCount={participants.length}
                participants={participants}
                currentParticipant={currentParticipant}
                onRefresh={refresh}
              />
            )}

            {/* Story Blocks */}
            <BlocksCard blocks={blocks} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Table;