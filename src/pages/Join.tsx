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
  console.log('🔍 JOIN: Component rendered with code:', code);
  
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableTitle, setTableTitle] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load table data on mount to set up realtime subscriptions
  useEffect(() => {
    console.log('🔍 JOIN: useEffect triggered with code:', code);
    
    const loadTableData = async () => {
      if (!code) {
        console.log('🔍 JOIN: No code provided');
        return;
      }
      
      if (!isValidTableCode(code)) {
        console.log('🔍 JOIN: Invalid code format:', code);
        return;
      }

      console.log('🔍 JOIN: Loading table data for code:', code);
      
      try {
        const { data: table, error } = await supabase
          .from('tables')
          .select('id, status, title')
          .eq('code', code)
          .single();

        if (error) {
          console.log('🔍 JOIN: Error loading table:', error);
          return;
        }

        if (table) {
          console.log('🔍 JOIN: Table found:', table);
          setTableId(table.id);
          setTableTitle(table.title);
          
          // If table is already running, we can optionally show a different message
          if (table.status === 'running') {
            toast({
              title: "Session in Progress",
              description: "This session is currently active. Join to participate!",
            });
          }
        }
      } catch (error) {
        // Silently fail - table validation will happen on join
        console.log('🔍 JOIN: Table lookup failed on join page:', error);
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
    console.log('🚀 Starting join process with code:', code, 'displayName:', displayName);
    
    if (!code || !isValidTableCode(code)) {
      console.error('❌ Invalid table code:', code);
      toast({
        title: "Error",
        description: MESSAGES.INVALID_CODE,
        variant: "destructive",
      });
      return;
    }

    if (!isValidDisplayName(displayName)) {
      console.error('❌ Invalid display name:', displayName);
      toast({
        title: "Error", 
        description: MESSAGES.NAME_REQUIRED,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Generate client ID with fallback for older browsers
      let clientId: string;
      try {
        clientId = getOrCreateClientId();
        console.log('✅ Client ID generated:', clientId);
      } catch (error) {
        console.error('❌ Failed to generate client ID:', error);
        // Fallback UUID generation
        clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('table_client_id', clientId);
        console.log('✅ Fallback client ID generated:', clientId);
      }

      // Check if table exists and store tableId for realtime subscriptions
      console.log('🔍 Looking up table with code:', code);
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('id, status, title')
        .eq('code', code)
        .single();

      if (tableError || !table) {
        console.error('❌ Table lookup failed:', tableError?.message, tableError?.code);
        toast({
          title: "Error",
          description: MESSAGES.INVALID_CODE,
          variant: "destructive",
        });
        return;
      }
      
      console.log('✅ Table found:', { id: table.id, status: table.status, title: table.title });

      // Store table ID for realtime subscriptions
      setTableId(table.id);

      // If table is already running, redirect immediately
      if (table.status === 'running') {
        console.log('✅ Table is running, redirecting immediately');
        navigate(`/t/${code}`);
        return;
      }

      // Check if client already has a participant
      console.log('🔍 Checking for existing participant with client_id:', clientId);
      const { data: existingParticipant, error: existingError } = await supabase
        .from('participants')
        .select('id')
        .eq('table_id', table.id)
        .eq('client_id', clientId)
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        console.error('❌ Error checking existing participant:', existingError);
      }

      if (existingParticipant) {
        // Already joined, just navigate to table
        console.log('✅ Already joined, navigating to table');
        navigate(`/t/${code}`);
        return;
      }
      
      console.log('✅ No existing participant found, proceeding with join');

      // Check if name is already taken
      console.log('🔍 Checking if display name is taken:', displayName.trim());
      const { data: nameExists, error: nameCheckError } = await supabase
        .from('participants')
        .select('id')
        .eq('table_id', table.id)
        .eq('display_name', displayName.trim())
        .single();

      if (nameCheckError && nameCheckError.code !== 'PGRST116') {
        console.error('❌ Error checking name availability:', nameCheckError);
      }

      if (nameExists) {
        console.error('❌ Display name already taken:', displayName.trim());
        toast({
          title: "Error",
          description: "This name is already taken. Please choose another.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('✅ Display name is available');

      // Create participant
      const participantData: ParticipantInsert = {
        table_id: table.id,
        display_name: displayName.trim(),
        client_id: clientId,
        is_host: false,
      };

      console.log('📝 Creating participant with data:', participantData);
      const { data: insertedParticipant, error: participantError } = await supabase
        .from('participants')
        .insert(participantData)
        .select('id')
        .single();

      if (participantError) {
        console.error('❌ Participant creation failed:', participantError.code, participantError.message, participantError.details);
        throw participantError;
      }

      console.log('✅ Participant created successfully:', insertedParticipant);

      toast({
        title: "Success",
        description: MESSAGES.JOIN_SUCCESS,
      });

      // Small delay to ensure participant is fully inserted before navigation
      console.log('⏳ Waiting briefly before navigation...');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify participant was created before navigating
      const { data: verifyParticipant } = await supabase
        .from('participants')
        .select('id')
        .eq('table_id', table.id)
        .eq('client_id', clientId)
        .single();

      if (!verifyParticipant) {
        console.error('❌ Participant verification failed - participant not found after creation');
        throw new Error('Failed to verify participant creation');
      }

      console.log('✅ Participant verified, navigating to table:', `/t/${code}`);
      navigate(`/t/${code}`);
      
    } catch (error: any) {
      console.error('❌ Join process failed:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      
      toast({
        title: "Error",
        description: error?.message || "Failed to join table. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleJoin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Join Session</CardTitle>
          <CardDescription>
            {tableTitle || 'Loading session...'}
            <div className="text-sm text-muted-foreground mt-1">
              You're about to join this session.
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                disabled={loading}
              />
            </div>
            
            <Button 
              type="submit"
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
          </form>
          
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