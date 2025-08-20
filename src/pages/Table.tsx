import { useParams, useNavigate } from 'react-router-dom';
import { getHostSecret } from '@/utils/clientId';
import { useTableState } from '@/hooks/useTableStateOptimized';
import { usePhaseManager } from '@/hooks/usePhaseManager';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { Users, Clock, List, Play } from 'lucide-react';
import { useEffect, useState, startTransition } from 'react';
import { VotingStatusIndicator } from '@/components/VotingStatusIndicator';
import { BackButton } from '@/components/BackButton';
import { usePresenceTracking } from '@/hooks/usePresenceTracking';
import { ResponsiveSidebar, SidebarMobileToggle } from '@/components/ResponsiveSidebar';
import { MobileOptimizedCard } from '@/components/MobileOptimizedCard';
import { TouchOptimizedButton } from '@/components/TouchOptimizedButton';
import { Menu } from 'lucide-react';

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
    refreshBlocks,
  } = useTableState(code || '');
  
  // Initialize presence tracking
  usePresenceTracking(table?.id || null, clientId);
  
  const [suggestionsWithVotes, setSuggestionsWithVotes] = useState<SuggestionWithVotes[]>([]);
  const [winningSuggestions, setWinningSuggestions] = useState<WinningSuggestion[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [phaseTransition, setPhaseTransition] = useState<{
    isVisible: boolean;
    fromPhase: string;
    toPhase: string;
  }>({ isVisible: false, fromPhase: '', toPhase: '' });
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
        if (currentParticipant) {
          const data = await getSuggestionsWithVotes(currentRound.id, currentParticipant.id);
          setSuggestionsWithVotes(data);
          setWinningSuggestions(getWinningSuggestions(data));
        }
      } catch (error) {
        console.error('Error loading suggestions with votes:', error);
        setSuggestionsWithVotes([]);
      }
    };

    loadSuggestionsWithVotes();
  }, [currentRound, suggestions, votes, currentParticipant]);
  
  const userHasVoted = currentParticipant 
    ? votes.some(vote => vote.participant_id === currentParticipant.id)
    : false;
    
  
  // Automatic phase management - always enabled (phase manager handles its own processing state)
  const { isProcessing } = usePhaseManager(table, currentRound, suggestions, votes, timeRemaining, clientId, isHost, refresh, participants);
  
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
        
        // Force refresh blocks to show winner immediately in timeline
        if (refreshBlocks) {
          setTimeout(() => refreshBlocks(), 100);
        }
        
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
    } finally {
      // Safety fallback to reset transitioning state
      setTimeout(() => {
        setIsTransitioning(false);
      }, 3000);
    }
  };
  
  const handleNextRound = async () => {
    console.log('🚀 handleNextRound called!', { table: !!table, currentRound: !!currentRound, isTransitioning, isProcessing });
    if (!table || !currentRound || isTransitioning || isProcessing) {
      console.log('🚀 handleNextRound early return due to conditions');
      return;
    }
    
    try {
      console.log('🚀 handleNextRound starting execution...');
      setIsTransitioning(true);
      
      // Create new round in lobby mode for manual start
      console.log('🚀 About to call advanceRound...');
      const newRound = await advanceRound(table.id, currentRound.number);
      console.log('🚀 advanceRound completed, new round:', newRound);
      
      // Automatically start the suggestion phase for the new round
      console.log('🚀 Starting suggestion phase for new round...');
      await startSuggestPhase(newRound.id, table.default_suggest_sec, table.id);
      
      toast({
        title: "Success", 
        description: "Next round started!",
      });
      
      // Force refresh blocks to ensure timeline shows latest winner
      if (refreshBlocks) {
        setTimeout(() => refreshBlocks(), 100);
      }
      
      // Force a complete refresh to ensure UI updates with new round
      console.log('🚀 Forcing complete refresh...');
      setTimeout(() => {
        refresh();
      }, 300);
      
      // Brief transition time for UI updates
      setTimeout(() => {
        console.log('🚀 Clearing isTransitioning...');
        setIsTransitioning(false);
      }, 1500);
      
    } catch (error) {
      console.error('Error starting next round:', error);
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
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Header */}
      <header className="border-b bg-card smooth-transition">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
                   currentPhase === 'vote' ? 'Voting Phase' : 'Results'} • {participants.length} participants
                   {currentRound && currentRound.number > 1 && (
                     <span> • Round {currentRound.number}</span>
                   )}
                 </p>
                 <ConnectionStatus />
               </div>
           </div>
           
           <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-3 smooth-transition flex-shrink-0">
              {/* Back Button - Always show in lobby, show with confirmation for active sessions, always show when closed */}
              {(currentPhase === 'lobby' || table.status === 'closed') && (
                <BackButton 
                  variant="ghost" 
                  size="sm"
                  showConfirmation={false}
                />
              )}
              
              {table.status === 'running' && currentPhase !== 'lobby' && (
                <BackButton 
                  variant="ghost" 
                  size="sm"
                  showConfirmation={true}
                  confirmationTitle="Leave Active Session?"
                  confirmationDescription="The session is currently active. Are you sure you want to leave?"
                />
              )}
              
               <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
                 <TableInfo
                   tableCode={table.code}
                   participantCount={participants.length}
                   isHost={isHost}
                 />
                 {currentPhase !== 'lobby' && (
                   <div className="xs:text-right">
                     <Timer 
                       timeRemaining={timeRemaining}
                       phase={currentPhase}
                       isActive={table.status === 'running'}
                     />
                   </div>
                 )}
                 
                 {/* Mobile Sidebar Toggle */}
                 <SidebarMobileToggle>
                   <ResponsiveSidebar
                     trigger={
                       <TouchOptimizedButton 
                         variant="outline" 
                         size="icon" 
                         touchSize="default"
                         aria-label="View sidebar"
                       >
                         <Menu className="h-4 w-4" />
                       </TouchOptimizedButton>
                     }
                   >
                     <div className="space-y-4">
                       {/* Timeline */}
                       <div>
                         <h3 className="font-semibold mb-3">Timeline</h3>
                         <Timeline 
                           blocks={blocks} 
                           currentRound={currentRound} 
                           originalTitle={table.title}
                         />
                       </div>
                       
                       {/* Participants */}
                       <div>
                         <h3 className="font-semibold mb-3 flex items-center gap-2">
                           <Users className="h-4 w-4" />
                           Participants ({participants.length})
                         </h3>
                         <div className="space-y-2">
                           {participants.map((participant) => (
                             <div key={participant.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                               <span className="text-sm font-medium truncate">
                                 {participant.display_name}
                               </span>
                               {participant.is_host && (
                                 <Badge variant="secondary" className="text-xs">Host</Badge>
                               )}
                             </div>
                           ))}
                         </div>
                       </div>
                       
                       {/* Host Controls */}
                       {isHost && (
                         <div>
                           <h3 className="font-semibold mb-3">Host Controls</h3>
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
                       )}
                     </div>
                   </ResponsiveSidebar>
                 </SidebarMobileToggle>
               </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 relative">
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
              
              {/* Suggestion Phase - Show to participants and hosts */}
              {currentPhase === 'suggest' && (
                <div className="content-enter space-y-6">
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
                <div className="content-enter">
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
                    refreshBlocks={refreshBlocks}
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

          {/* Desktop Sidebar - Hidden on mobile */}
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
                    {participants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between smooth-transition">
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
                    <SmoothTransition isVisible={true}>
                      <VotingStatusIndicator 
                        participants={participants}
                        votes={votes}
                        currentRound={currentRound}
                      />
                    </SmoothTransition>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Host Controls */}
            {isHost && (
              <div className="smooth-transition">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Table;