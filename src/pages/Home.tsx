import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { generateTableCode, generateHostToken } from '@/utils';
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
      const hostToken = generateHostToken();
      
      const tableData: TableInsert = {
        code,
        host_token: hostToken,
        status: 'waiting',
        suggestion_seconds: 120,
        voting_seconds: 60,
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
        is_host: true,
      };

      const { error: participantError } = await supabase
        .from('participants')
        .insert(participantData);

      if (participantError) throw participantError;

      // Navigate to table with host token
      navigate(`/t/${code}?host=${hostToken}`);
      
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
            <p className="text-sm text-muted-foreground">
              Or join an existing table with a code
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Home;