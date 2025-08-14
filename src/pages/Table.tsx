import { useParams, useSearchParams } from 'react-router-dom';
import { useTableState } from '@/hooks/useTableState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Clock, List } from 'lucide-react';

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
  } = useTableState(code || '', hostToken || undefined);

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
            
            {currentPhase !== 'waiting' && (
              <div className="flex items-center space-x-2 text-lg font-mono">
                <Clock className="h-5 w-5" />
                <span>{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Current Phase Content */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span>Current Phase: {currentPhase}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentPhase === 'waiting' && (
                  <div className="text-center py-8">
                    <p className="text-lg mb-4">Waiting for host to start the table...</p>
                    {isHost && (
                      <p className="text-muted-foreground">You are the host. Use the controls on the right to start.</p>
                    )}
                  </div>
                )}
                
                {currentPhase === 'suggestions' && (
                  <div className="space-y-4">
                    <p className="text-lg">Share your suggestions!</p>
                    {/* Suggestion form will go here */}
                  </div>
                )}
                
                {currentPhase === 'voting' && (
                  <div className="space-y-4">
                    <p className="text-lg">Vote for your favorite suggestion</p>
                    {/* Voting interface will go here */}
                  </div>
                )}
                
                {currentPhase === 'results' && (
                  <div className="space-y-4">
                    <p className="text-lg">Round complete!</p>
                    {/* Results display will go here */}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Suggestions List */}
            {proposals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <List className="h-5 w-5" />
                    <span>Suggestions ({proposals.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {proposals.map((proposal) => (
                      <div key={proposal.id} className="p-3 border rounded-lg">
                        <p>{proposal.text}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {votes.filter(v => v.proposal_id === proposal.id).length} votes
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
              <Card>
                <CardHeader>
                  <CardTitle>Host Controls</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Host controls will be implemented here
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            {blocks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {blocks.map((block, index) => (
                      <div key={block.id} className="text-sm">
                        <span className="font-medium">Round {index + 1}:</span>
                        <p className="text-muted-foreground">{block.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Table;