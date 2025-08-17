import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateClientId } from '@/utils/clientId';
import { ParticipantInsert } from '@/types';
import { isValidDisplayName, isValidTableCode } from '@/utils';
import { useToast } from '@/hooks/use-toast';
import { MESSAGES } from '@/constants';
import { Loader2 } from 'lucide-react';

const Join = () => {
  const { code } = useParams<{ code: string }>();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [tableId, setTableId] = useState<string | null>(null);
  const [table, setTable] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load table data on mount to set up realtime subscriptions
  useEffect(() => {
    const loadTableData = async () => {
      if (!code || !isValidTableCode(code)) return;

      try {
        const { data: tableData } = await supabase
          .from('tables')
          .select('id, status, title')
          .eq('code', code)
          .maybeSingle();

        if (tableData) {
          setTableId(tableData.id);
          setTable(tableData);
          
          // If table is already running, we can optionally show a different message
          if (tableData.status === 'running') {
            toast({
              title: "Session in Progress",
              description: "This session is currently active. Join to participate!",
            });
          }
        }
      } catch (error) {
        // Silently fail - table validation will happen on join
        console.log('Table lookup failed on join page:', error);
      }
    };

    loadTableData();
  }, [code, toast]);

  // Set up realtime listener to auto-redirect when session starts
  useEffect(() => {
    if (!code || !tableId) return;

    console.log('Setting up realtime listener for table status changes');

    const channel = supabase
      .channel(`join_page_${tableId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tables', filter: `id=eq.${tableId}` },
        (payload) => {
          console.log('Table status changed in join page:', payload);
          const newTable = payload.new as any;
          
          // If table status changed to running, auto-redirect immediately
          if (newTable.status === 'running') {
            console.log('Table started - redirecting to session immediately');
            toast({
              title: "Session Started!",
              description: "Redirecting to the session...",
            });
            navigate(`/t/${code}`);
          }
        }
      )
      .subscribe((status) => {
        console.log('Join page realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up join page realtime listener');
      supabase.removeChannel(channel);
    };
  }, [code, tableId, navigate, toast]);

  const handleJoin = async () => {
    if (!code || !isValidTableCode(code)) {
      toast({
        title: "Error",
        description: MESSAGES.INVALID_CODE,
        variant: "destructive",
      });
      return;
    }

    if (!isValidDisplayName(displayName)) {
      toast({
        title: "Error", 
        description: MESSAGES.NAME_REQUIRED,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const clientId = getOrCreateClientId();

      // Check if table exists and store tableId for realtime subscriptions
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('id, status')
        .eq('code', code)
        .maybeSingle();

      if (tableError || !table) {
        toast({
          title: "Error",
          description: MESSAGES.INVALID_CODE,
          variant: "destructive",
        });
        return;
      }

      // Store table ID for realtime subscriptions
      setTableId(table.id);

      // If table is already running, redirect immediately
      if (table.status === 'running') {
        navigate(`/t/${code}`);
        return;
      }

      // Check if client already has a participant
      const { data: existingParticipant } = await supabase
        .from('participants')
        .select('id')
        .eq('table_id', table.id)
        .eq('client_id', clientId)
        .maybeSingle();

      if (existingParticipant) {
        // Already joined, just navigate to table
        navigate(`/t/${code}`);
        return;
      }

      // Check if name is already taken
      const { data: nameExists } = await supabase
        .from('participants')
        .select('id')
        .eq('table_id', table.id)
        .eq('display_name', displayName.trim())
        .maybeSingle();

      if (nameExists) {
        toast({
          title: "Error",
          description: "This name is already taken. Please choose another.",
          variant: "destructive",
        });
        return;
      }

      // Create participant
      const participantData: ParticipantInsert = {
        table_id: table.id,
        display_name: displayName.trim(),
        client_id: clientId,
        is_host: false,
      };

      const { error: participantError } = await supabase
        .from('participants')
        .insert(participantData);

      if (participantError) throw participantError;

      toast({
        title: "Success",
        description: MESSAGES.JOIN_SUCCESS,
      });

      // Navigate to table
      navigate(`/t/${code}`);
      
    } catch (error) {
      console.error('Error joining table:', error);
      toast({
        title: "Error",
        description: "Failed to join table. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Join Session</CardTitle>
          {table?.title && (
            <p className="text-lg font-medium">{table.title}</p>
          )}
          <CardDescription>
            Session Code: <span className="font-mono font-bold text-lg">{code}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Enter your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyPress={handleKeyPress}
              maxLength={50}
              disabled={loading}
            />
          </div>
          
          <Button 
            onClick={handleJoin}
            disabled={loading || !displayName.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              'Join Session'
            )}
          </Button>
          
          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/')}
              disabled={loading}
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Join;