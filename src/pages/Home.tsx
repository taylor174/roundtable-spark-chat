import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { generateTableCode, generateHostToken } from '@/utils';
import { getOrCreateClientId, storeHostSecret } from '@/utils/clientId';
import { TableInsert, ParticipantInsert } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const Home = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreateTable = async () => {
    try {
      setLoading(true);
      
      const code = generateTableCode();
      const hostSecret = generateHostToken();
      const clientId = getOrCreateClientId();
      
      const tableData: TableInsert = {
        code,
        host_secret: hostSecret,
        status: 'lobby',
        default_suggest_sec: 120,
        default_vote_sec: 60,
      };

      const { data: table, error: tableError } = await supabase
        .from('tables')
        .insert(tableData)
        .select()
        .single();

      if (tableError) throw tableError;

      // Create host participant
      const participantData: ParticipantInsert = {
        table_id: table.id,
        display_name: 'Host',
        client_id: clientId,
        is_host: true,
      };

      const { error: participantError } = await supabase
        .from('participants')
        .insert(participantData);

      if (participantError) throw participantError;

      // Store host secret in localStorage
      storeHostSecret(code, hostSecret);

      // Navigate to table
      navigate(`/t/${code}`);
      
    } catch (error) {
      console.error('Error creating table:', error);
      toast({
        title: "Error",
        description: "Failed to create table. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">RoundTable</CardTitle>
          <CardDescription>
            Create a collaborative discussion space for your group
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleCreateTable}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Table...
              </>
            ) : (
              'Open Table'
            )}
          </Button>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Or join an existing table
            </p>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/t/SAMPLE/join')}
              className="text-sm"
            >
              Enter table code
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Home;