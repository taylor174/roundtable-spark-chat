import { useParams, useSearchParams } from 'react-router-dom';
import { useTableState } from '@/hooks/useTableState';
import { usePhaseManager } from '@/hooks/usePhaseManager';
import { Timer } from '@/components/Timer';
import { SuggestionForm } from '@/components/SuggestionForm';
import { SuggestionList } from '@/components/SuggestionList';
import { VoteList } from '@/components/VoteList';
import { ResultsPanel } from '@/components/ResultsPanel';
import { Timeline } from '@/components/Timeline';
import { HostControls } from '@/components/HostControls';
import { TableInfo } from '@/components/TableInfo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  getProposalsWithVotes, 
  hasUserVoted, 
  getWinningProposals,
  advanceRound,
  startNextRound,
  selectWinner 
} from '@/utils/roundLogic';
import { useToast } from '@/hooks/use-toast';
import { MESSAGES } from '@/constants';
import { Users, Clock, List, Play } from 'lucide-react';

const Table = () => {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const hostToken = searchParams.get('host');
  
  const {
    table,
    participants,
    currentRound,
    proposals,
    votes,
    blocks,
    currentParticipant,
    isHost,
    timeRemaining,
    loading,
    error,
    currentPhase,
    refresh,
  } = useTableState(code || '', hostToken || undefined);
  
  const { toast } = useToast();
  
  // Derived state
  const proposalsWithVotes = getProposalsWithVotes(
    proposals,
    votes,
    currentParticipant?.id
  );
  
  const userHasVoted = currentParticipant 
    ? hasUserVoted(votes, currentParticipant.id)
    : false;
    
  const winningProposals = getWinningProposals(proposalsWithVotes);
  
  // Automatic phase management
  usePhaseManager(table, currentRound, proposals, votes, timeRemaining, refresh);
  
  // Event handlers
  const handleWinnerSelected = async (proposalId: string) => {
    if (!table || !currentRound) return;
    
    try {
      await selectWinner(table.id, currentRound.id, proposalId);
      toast({
        title: "Success",
        description: "Winner selected!",
      });
      refresh();
    } catch (error) {
      console.error('Error selecting winner:', error);
      toast({
        title: "Error",
        description: "Failed to select winner. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleNextRound = async () => {
    if (!table || !currentRound) return;
    
    try {
      await startNextRound(table.id, currentRound.round_index);
      toast({
        title: "Success", 
        description: "Next round started!",
      });
      refresh();
    } catch (error) {
      console.error('Error starting next round:', error);
      toast({
        title: "Error",
        description: "Failed to start next round. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-4">
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
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
        <div className="max-w-6xl mx-auto p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Table {table.code}</h1>
              <p className="text-muted-foreground">
                Phase: {currentPhase} • {participants.length} participants
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <TableInfo
                tableCode={table.code}
                participantCount={participants.length}
                isHost={isHost}
              />
              {currentPhase !== 'waiting' && (
                <Timer 
                  timeRemaining={timeRemaining}
                  phase={currentPhase}
                  isActive={table.status === 'active'}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Current Phase Content */}
            {currentPhase === 'waiting' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Play className="h-5 w-5" />
                    <span>Waiting to Start</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
            
            {/* Suggestion Phase */}
            {currentPhase === 'suggestions' && currentParticipant && currentRound && (
              <>
                <SuggestionForm
                  roundId={currentRound.id}
                  participantId={currentParticipant.id}
                  disabled={timeRemaining === 0}
                />
                <SuggestionList 
                  proposals={proposalsWithVotes}
                  showVoteCounts={false}
                />
              </>
            )}
            
            {/* Voting Phase */}
            {currentPhase === 'voting' && currentParticipant && currentRound && (
              <VoteList
                proposals={proposalsWithVotes}
                roundId={currentRound.id}
                participantId={currentParticipant.id}
                hasVoted={userHasVoted}
                disabled={timeRemaining === 0}
              />
            )}
            
            {/* Results Phase */}
            {currentPhase === 'results' && winningProposals.length > 0 && (
              <ResultsPanel
                winningProposals={winningProposals}
                isHost={isHost}
                onWinnerSelected={handleWinnerSelected}
                onNextRound={handleNextRound}
              />
            )}

            {/* Show suggestions in voting and results phases */}
            {(currentPhase === 'voting' || currentPhase === 'results') && (
              <SuggestionList 
                proposals={proposalsWithVotes}
                showVoteCounts={currentPhase === 'results'}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Participants */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Participants ({participants.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            {/* Host Controls */}
            {isHost && (
              <HostControls
                table={table}
                canStart={participants.length >= 2}
                currentPhase={currentPhase}
                participantCount={participants.length}
                onRefresh={refresh}
              />
            )}

            {/* Timeline */}
            <Timeline blocks={blocks} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Table;