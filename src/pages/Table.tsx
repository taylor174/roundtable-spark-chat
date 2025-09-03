import { useParams, useNavigate } from 'react-router-dom';
import { getHostSecret } from '@/utils/clientId';
import { useTableState } from '@/hooks/useTableStateOptimized';
import { usePhaseManager } from '@/hooks/usePhaseManager';
import { useAutoCleanup } from '@/hooks/useAutoCleanup';
import { Timer } from '@/components/Timer';
import { SuggestionForm } from '@/components/SuggestionForm';
import { SuggestionList } from '@/components/SuggestionList';
import { VoteList } from '@/components/VoteList';
import { ResultsPanel } from '@/components/ResultsPanel';
import { Timeline } from '@/components/Timeline';
import { HostControls } from '@/components/HostControls';
import { TableInfo } from '@/components/TableInfo';
import { DiscussionContextCard } from '@/components/DiscussionContextCard';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { PhaseTransition } from '@/components/PhaseTransition';
import { SmoothTransition } from '@/components/SmoothTransition';
import { PhaseTransitionIndicator } from '@/components/PhaseTransitionIndicator';
import { PendingParticipantScreen } from '@/components/PendingParticipantScreen';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  getSuggestionsWithVotes, 
  getWinningSuggestions,
  getWinnerWithTieBreak,
  advanceRound,
  endRound,
  startSuggestPhase
} from '@/utils/roundLogic';
import { SuggestionWithVotes, WinningSuggestion } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { MESSAGES } from '@/constants';
import { Users, Clock, List, Play, Trash2, RefreshCw } from 'lucide-react';
import { useEffect, useState, startTransition } from 'react';
import { VotingStatusIndicator } from '@/components/VotingStatusIndicator';
import { BackButton } from '@/components/BackButton';
import { usePresenceTracking } from '@/hooks/usePresenceTracking';
import { ResponsiveSidebar, SidebarMobileToggle } from '@/components/ResponsiveSidebar';
import { MobileOptimizedCard } from '@/components/MobileOptimizedCard';
import { TouchOptimizedButton } from '@/components/TouchOptimizedButton';
import { PhaseTransitionMonitor } from '@/components/PhaseTransitionMonitor';
import { MobileHostActions } from '@/components/MobileHostActions';
import { Menu } from 'lucide-react';

const Table = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
  // Validate table code exists and handle invalid routes
  useEffect(() => {
    if (!code || code.trim() === '') {
      navigate('/', { 
        replace: true,
        state: { error: 'Invalid table URL. Please check the link and try again.' }
      });
      return;
    }
    
    // Basic validation for table code format (alphanumeric, reasonable length)
    if (!/^[a-zA-Z0-9]{3,20}$/.test(code)) {
      navigate('/', { 
        replace: true,
        state: { error: `Invalid table code format: "${code}". Table codes should be 3-20 alphanumeric characters.` }
      });
      return;
    }
  }, [code, navigate]);
  
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
    refreshBlocks,
  } = useTableState(code || '');
  
  // Initialize presence tracking
  usePresenceTracking(table?.id || null, clientId);

  // Initialize auto-cleanup for expired rounds
  const { manualCleanup } = useAutoCleanup({
    interval: 5, // Check every 5 minutes
    enabled: true
  });

  // Navigate to summary when table is closed and has blocks
  useEffect(() => {
    if (table?.status === 'closed' && blocks.length > 0) {
      navigate(`/t/${code}/summary`);
    }
  }, [table?.status, blocks.length, code, navigate]);
  
  const [suggestionsWithVotes, setSuggestionsWithVotes] = useState<SuggestionWithVotes[]>([]);
  const [winningSuggestions, setWinningSuggestions] = useState<WinningSuggestion[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [phaseTransition, setPhaseTransition] = useState<{
    isVisible: boolean;
    fromPhase: string;
    toPhase: string;
  }>({ isVisible: false, fromPhase: '', toPhase: '' });
  const { toast } = useToast();

  // Handle table not found or loading errors with better messaging
  useEffect(() => {
    if (error) {
      
      if (error.includes('not found')) {
        navigate('/', { 
          replace: true, 
          state: { error: `Table "${code}" not found. Please check the code and try again.` } 
        });
      } else if (error.includes('Failed to load table data')) {
        navigate('/', { 
          replace: true, 
          state: { error: `Unable to load table data. Please check your connection and try again.` } 
        });
      } else if (error.includes('permission') || error.includes('Access denied')) {
        navigate('/', { 
          replace: true, 
          state: { error: `Access denied to table "${code}". You may not have permission to view this table.` } 
        });
      }
    }
  }, [error, code, navigate]);

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

  // Determine active participants (those who can currently participate)
  const activeParticipants = participants.filter(p => 
    !p.active_from_round || 
    (currentRound && currentRound.number >= p.active_from_round)
  );

  // Check if current participant is pending (waiting for their turn)
  const isCurrentParticipantPending = currentParticipant && 
    currentParticipant.active_from_round && 
    currentRound && 
    currentRound.number < currentParticipant.active_from_round;
  
  // Load suggestions with votes
  useEffect(() => {
    const loadSuggestionsWithVotes = async () => {
      if (!currentRound) {
        setSuggestionsWithVotes([]);
        return;
      }
      
      try {
        if (currentParticipant) {
          const data = await getSuggestionsWithVotes(currentRound.id, currentParticipant.id);
          setSuggestionsWithVotes(data);
          setWinningSuggestions(getWinningSuggestions(data));
        }
      } catch (error) {
        setSuggestionsWithVotes([]);
      }
    };

    loadSuggestionsWithVotes();
  }, [currentRound, suggestions, votes, currentParticipant]);
  
  const userHasVoted = currentParticipant 
    ? votes.some(vote => vote.participant_id === currentParticipant.id)
    : false;
    
  
  // Automatic phase management - pass active participants for accurate counts
  const { isProcessing } = usePhaseManager(table, currentRound, suggestions, votes, timeRemaining, clientId, isHost, refresh, activeParticipants);
  
  // Handle phase transition animations
  useEffect(() => {
    if (isProcessing && currentPhase) {
      // Show transition animation when processing starts
      const nextPhase = currentPhase === 'suggest' ? 'vote' : 
                       currentPhase === 'vote' ? 'result' : currentPhase;
      
      setPhaseTransition({
        isVisible: true,
        fromPhase: currentPhase,
        toPhase: nextPhase
      });
    } else {
      // Hide transition when processing ends
      setPhaseTransition(prev => ({ ...prev, isVisible: false }));
    }
  }, [isProcessing, currentPhase]);
  
  // Event handlers
  const handleWinnerSelected = async (suggestionId: string) => {
    if (!table || !currentRound || isTransitioning || isProcessing) return;
    
    try {
      setIsTransitioning(true);
      
      const winningSuggestion = suggestionsWithVotes.find(s => s.id === suggestionId);
      if (winningSuggestion) {
        await endRound(currentRound.id, table.id, winningSuggestion.text);
        toast({
          title: "Success",
          description: "Winner selected!",
        });
        
        // Force refresh to show winner immediately in timeline
        setTimeout(() => {
          refresh();
          refreshBlocks();
        }, 100);
        
        setTimeout(() => {
          setIsTransitioning(false);
        }, 1500);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to select winner. Please try again.",
        variant: "destructive",
      });
      setIsTransitioning(false);
    } finally {
      // Safety fallback to reset transitioning state
      setTimeout(() => {
        setIsTransitioning(false);
      }, 3000);
    }
  };
  
  const handleNextRound = async () => {
    if (!table || !currentRound || isTransitioning || isProcessing) {
      return;
    }
    
    try {
      setIsTransitioning(true);
      
      // Create new round in lobby mode for manual start
      const newRound = await advanceRound(table.id, currentRound.number);
      
      // Automatically start the suggestion phase for the new round
      await startSuggestPhase(newRound.id, table.default_suggest_sec, table.id);
      
      toast({
        title: "Success", 
        description: "Next round started!",
      });
      
      // Force refresh to ensure timeline shows latest winner
      setTimeout(() => {
        refresh();
        refreshBlocks();
      }, 100);
      
      // Force a complete refresh to ensure UI updates with new round
      setTimeout(() => {
        refresh();
      }, 300);
      
      // Brief transition time for UI updates
      setTimeout(() => {
        setIsTransitioning(false);
      }, 1500);
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start next round. Please try again.",
        variant: "destructive",
      });
      setIsTransitioning(false);
    } finally {
      // Safety fallback to reset transitioning state
      setTimeout(() => {
        setIsTransitioning(false);
      }, 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 animate-fade-in">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full smooth-transition" />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 md:gap-6">
            <div className="space-y-4">
              <Skeleton className="h-40 w-full smooth-transition" />
              <Skeleton className="h-60 w-full smooth-transition" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-32 w-full smooth-transition" />
              <Skeleton className="h-48 w-full smooth-transition" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 md:p-6">
        <div className="max-w-md space-y-4">
          <Alert>
            <AlertDescription>
              {error || 'Table not found'}
            </AlertDescription>
          </Alert>
          <div className="text-center">
            <BackButton 
              variant="outline"
              showConfirmation={false}
              redirectToSummary={false}
              tableCode={code}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Show pending participant screen if waiting */}
      {isCurrentParticipantPending && (
        <PendingParticipantScreen
          currentRound={currentRound}
          activeFromRound={currentParticipant.active_from_round!}
          participantName={currentParticipant.display_name}
          timeRemaining={timeRemaining}
          onRefresh={refresh}
        />
      )}

      {/* Header */}
      <header className="border-b bg-card smooth-transition">
        <div className="max-w-5xl mx-auto px-3 md:px-6 py-3 md:py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="smooth-transition min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold leading-tight break-words line-clamp-2 lg:line-clamp-1">
                {currentRound && currentRound.number > 1 && blocks.length > 0 
                  ? blocks[blocks.length - 1].text 
                  : table.title || `Session ${table.code}`}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {currentPhase === 'lobby' ? 'Waiting to start' : 
                  currentPhase === 'suggest' ? 'Suggestion Phase' :
                  currentPhase === 'vote' ? 'Voting Phase' : 'Results'} • {activeParticipants.length} active
                  {participants.length > activeParticipants.length && (
                    <span> • {participants.length - activeParticipants.length} waiting</span>
                  )}
                  {currentRound && currentRound.number > 1 && (
                    <span> • Round {currentRound.number}</span>
                  )}
                </p>
                <ConnectionStatus />
              </div>
            </div>
          
            <div className="flex items-center gap-2 smooth-transition flex-shrink-0">
              {/* Back Button - Always show in lobby, show with confirmation for active sessions, always show when closed */}
              {(currentPhase === 'lobby' || table.status === 'closed') && (
                <BackButton 
                  variant="ghost" 
                  size="sm"
                  showConfirmation={false}
                  redirectToSummary={blocks.length > 0}
                  tableCode={code}
                />
              )}
              
              {table.status === 'running' && currentPhase !== 'lobby' && (
                <BackButton 
                  variant="ghost" 
                  size="sm"
                  showConfirmation={true}
                  confirmationTitle="Leave Active Session?"
                  confirmationDescription="The session is currently active. Are you sure you want to leave?"
                  redirectToSummary={blocks.length > 0}
                  tableCode={code}
                />
              )}
             
              <TableInfo
                tableCode={table.code}
                participantCount={participants.length}
                isHost={isHost}
              />
              
              {/* Mobile Sidebar Toggle */}
              <SidebarMobileToggle>
                <ResponsiveSidebar
                  trigger={
                    <TouchOptimizedButton 
                      variant="ghost" 
                      size="icon" 
                      touchSize="default"
                      aria-label="View menu"
                    >
                      <Menu className="h-4 w-4" />
                    </TouchOptimizedButton>
                  }
                 >
                  {/* Timeline Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-2 border-b border-border">
                      <List className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">Timeline</h3>
                    </div>
                    <div className="px-1">
                      <Timeline 
                        blocks={blocks} 
                        currentRound={currentRound} 
                        originalTitle={table.title}
                      />
                    </div>
                  </div>
                    
                  {/* Participants Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-2 border-b border-border">
                      <Users className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">
                        Participants ({participants.length})
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {participants.map((participant) => (
                        <div 
                          key={participant.id} 
                          className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                        >
                          <span className="text-base font-medium truncate">
                            {participant.display_name}
                          </span>
                          <div className="flex items-center gap-2">
                            {participant.is_host && (
                              <Badge variant="secondary" className="text-xs font-medium">
                                Host
                              </Badge>
                            )}
                            {participant.active_from_round && currentRound && 
                             currentRound.number < participant.active_from_round && (
                              <Badge variant="outline" className="text-xs">
                                Waiting
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                    
                  {/* Host Controls Section */}
                  {isHost && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 pb-2 border-b border-border">
                        <Play className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">Host Controls</h3>
                      </div>
                      <div className="px-1">
                        <HostControls
                          table={table}
                          canStart={true}
                          currentPhase={currentPhase}
                          participantCount={participants.length}
                          participants={participants}
                          currentParticipant={currentParticipant}
                          onRefresh={refresh}
                        />
                      </div>
                    </div>
                  )}
                </ResponsiveSidebar>
              </SidebarMobileToggle>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 pb-20 md:pb-4 relative">
        {/* Phase Transition Overlay */}
        <PhaseTransition 
          isVisible={phaseTransition.isVisible}
          fromPhase={phaseTransition.fromPhase}
          toPhase={phaseTransition.toPhase}
        />
        
        {/* Loading Overlay for round transitions */}
        {isTransitioning && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">
                Transitioning to next round...
              </p>
            </div>
          </div>
        )}
        
        
        <div className="responsive-grid">
          {/* Main Content */}
          <div className="space-y-6 stable-layout">
            {/* Phase Transition Indicator - Hidden for result phase to prevent participants getting stuck */}
            {currentPhase !== 'lobby' && currentPhase !== 'result' && (
              <PhaseTransitionIndicator
                phase={currentPhase}
                timeRemaining={timeRemaining}
                isTransitioning={isProcessing}
                participantCount={activeParticipants.length}
                votedCount={votes.filter(vote => 
                  activeParticipants.some(p => p.id === vote.participant_id)
                ).length}
              />
            )}

            <SmoothTransition 
              isVisible={!isTransitioning} 
              className="phase-container"
            >
              {/* Current Phase Content */}
              {currentPhase === 'lobby' && (
                <Card className="content-enter">
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
              
              {/* Suggestion Phase - Only show form to active participants */}
              {currentPhase === 'suggest' && (
                <div className="content-enter space-y-6">

                  {currentParticipant && currentRound && !isCurrentParticipantPending && (
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
              
              {/* Voting Phase - Only show voting to active participants */}
              {currentPhase === 'vote' && (
                <div className="content-enter space-y-6">

                  {currentParticipant && currentRound && !isCurrentParticipantPending && (
                    <VoteList
                      suggestions={suggestionsWithVotes}
                      roundId={currentRound.id}
                      participantId={currentParticipant.id}
                      userHasVoted={userHasVoted}
                      onVoteSuccess={() => {
                        // Trigger immediate refresh for real-time vote count updates
                        refresh();
                      }}
                    />
                  )}
                </div>
              )}
              
              {/* Results Phase - Only show to host to prevent participants getting stuck */}
              {currentPhase === 'result' && winningSuggestions.length > 0 && isHost && (
                <div className="content-enter">
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
            </SmoothTransition>
          </div>

          {/* Desktop Sidebar - Show all participants with status */}
          <div className="hidden md:block space-y-6 smooth-transition">
            {/* Timeline */}
            <div className="smooth-transition">
              <Timeline 
                blocks={blocks} 
                currentRound={currentRound} 
                originalTitle={table.title}
              />
            </div>
            
            {/* Participants */}
            <Card className="smooth-transition">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Participants ({participants.length})</span>
                </CardTitle>
              </CardHeader>
               <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    {participants.map((participant) => {
                      const isPending = participant.active_from_round && 
                        currentRound && 
                        currentRound.number < participant.active_from_round;
                      
                      return (
                        <div key={participant.id} className="flex items-center justify-between smooth-transition">
                          <span className={isPending ? 'text-muted-foreground' : ''}>
                            {participant.display_name}
                          </span>
                          <div className="flex items-center space-x-1">
                            {participant.is_host && (
                              <Badge variant="secondary" className="text-xs">
                                Host
                              </Badge>
                            )}
                            {isPending && (
                              <Badge variant="outline" className="text-xs">
                                Round {participant.active_from_round}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Show voting status during voting phase for active participants only */}
                  {currentPhase === 'vote' && isHost && currentRound && (
                    <SmoothTransition isVisible={true}>
                      <VotingStatusIndicator 
                        participants={activeParticipants}
                        votes={votes}
                        currentRound={currentRound}
                      />
                    </SmoothTransition>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Phase Transition Monitor */}
            <PhaseTransitionMonitor
              table={table}
              currentRound={currentRound}
              timeRemaining={timeRemaining}
              clientId={clientId}
              isHost={isHost}
              participants={participants}
              onRefresh={refresh}
            />

            {/* Host Controls */}
            {isHost && (
              <div className="smooth-transition space-y-4">
                <HostControls
                  table={table}
                  canStart={true}
                  currentPhase={currentPhase}
                  participantCount={activeParticipants.length}
                  participants={activeParticipants}
                  currentParticipant={currentParticipant}
                  onRefresh={refresh}
                />
                
                {/* Manual Cleanup Button */}
                <Card className="border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      Session Maintenance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Clean up expired rounds and stuck phases
                      </p>
                      <Button
                        onClick={manualCleanup}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <RefreshCw className="h-3 w-3 mr-2" />
                        Clean Up Session
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Host Actions - Fixed Bottom Toolbar */}
      {isHost && (
        <MobileHostActions
          table={table}
          currentPhase={currentPhase}
          participantCount={participants.length}
          participants={participants}
          onRefresh={refresh}
        />
      )}
    </div>
  );
};

export default Table;
