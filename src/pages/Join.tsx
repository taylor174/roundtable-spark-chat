
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getOrCreateClientId } from '@/utils/clientId';
import { useToast } from '@/hooks/use-toast';
import { Users, Clock, Play } from 'lucide-react';

const Join = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const clientId = getOrCreateClientId();
  
  const [displayName, setDisplayName] = useState('');
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<any>(null);
  const [participantCount, setParticipantCount] = useState(0);

  // Load table information
  useEffect(() => {
    const loadTableInfo = async () => {
      if (!code) return;
      
      try {
        setLoading(true);
        
        // Get table info
        const { data: table, error: tableError } = await supabase
          .rpc('get_safe_table_data', { p_table_code: code })
          .single();

        if (tableError) throw tableError;
        
        // Get participant count
        const { count, error: countError } = await supabase
          .from('participants')
          .select('*', { count: 'exact', head: true })
          .eq('table_id', table.id);

        if (countError) throw countError;

        setTableInfo(table);
        setParticipantCount(count || 0);
        
      } catch (error: any) {
        setError(error.message || 'Failed to load table information');
      } finally {
        setLoading(false);
      }
    };

    loadTableInfo();
  }, [code]);

  // Auto-redirect when session starts (only if not running)
  useEffect(() => {
    if (!tableInfo || tableInfo.status === 'running') return;

    const channel = supabase
      .channel(`table_${tableInfo.id}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'tables', filter: `id=eq.${tableInfo.id}` },
        (payload) => {
          const newTable = payload.new as any;
          if (newTable.status === 'running') {
            toast({
              title: "Session Started!",
              description: "The discussion session has begun. Redirecting...",
            });
            setTimeout(() => navigate(`/t/${code}`), 1000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableInfo, code, navigate, toast]);

  const handleJoin = async () => {
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!tableInfo) return;

    try {
      setJoining(true);
      setError(null);

      // Check if participant already exists
      const { data: existingParticipant } = await supabase
        .from('participants')
        .select('*')
        .eq('table_id', tableInfo.id)
        .eq('client_id', clientId)
        .single();

      let participant = existingParticipant;

      if (!participant) {
        // Determine active_from_round based on table status
        let activeFromRound = null;
        
        if (tableInfo.status === 'running' && tableInfo.current_round_id) {
          // Get current round number to queue for next round
          const { data: currentRound } = await supabase
            .from('rounds')
            .select('number')
            .eq('id', tableInfo.current_round_id)
            .single();
          
          if (currentRound) {
            activeFromRound = currentRound.number + 1;
          }
        }

        // Create new participant
        const { data: newParticipant, error: participantError } = await supabase
          .from('participants')
          .insert({
            table_id: tableInfo.id,
            client_id: clientId,
            display_name: displayName.trim(),
            is_host: false,
            active_from_round: activeFromRound,
          })
          .select()
          .single();

        if (participantError) throw participantError;
        participant = newParticipant;

        if (activeFromRound) {
          toast({
            title: "Joined Successfully!",
            description: `You'll be able to participate starting from round ${activeFromRound}`,
          });
        } else {
          toast({
            title: "Joined Successfully!",
            description: "Welcome to the discussion session",
          });
        }
      }

      // Navigate to table
      navigate(`/t/${code}`);
      
    } catch (error: any) {
      console.error('Error joining table:', error);
      setError(error.message || 'Failed to join table');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !tableInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isRunning = tableInfo?.status === 'running';
  const isClosed = tableInfo?.status === 'closed';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>Join Discussion</span>
            {isRunning && (
              <Badge variant="secondary" className="gap-1">
                <Play className="h-3 w-3" />
                In Progress
              </Badge>
            )}
          </CardTitle>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Code: <span className="font-mono font-medium">{code}</span>
            </p>
            {tableInfo?.title && (
              <p className="text-sm font-medium">{tableInfo.title}</p>
            )}
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>{participantCount} participants</span>
              </span>
              {isRunning && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Session Active
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isClosed && (
            <Alert>
              <AlertDescription>
                This discussion session has ended. You can view the summary instead.
              </AlertDescription>
            </Alert>
          )}

          {isRunning && (
            <Alert>
              <AlertDescription>
                This session is currently in progress. You'll join and be able to participate starting from the next round.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label htmlFor="displayName" className="text-sm font-medium">
              Your Name
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              disabled={joining || isClosed}
              onKeyPress={(e) => e.key === 'Enter' && !isClosed && handleJoin()}
            />
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleJoin}
              disabled={joining || !displayName.trim() || isClosed}
              className="flex-1"
            >
              {joining ? 'Joining...' : isRunning ? 'Join Session' : 'Join & Wait'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              Cancel
            </Button>
          </div>

          {isClosed && (
            <Button
              variant="outline"
              onClick={() => navigate(`/t/${code}/summary`)}
              className="w-full"
            >
              View Summary
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Join;
