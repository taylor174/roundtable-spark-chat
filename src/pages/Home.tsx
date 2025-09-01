import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { TableCreationDialog } from '@/components/TableCreationDialog';
import { isValidTableCode } from '@/utils';

export default function Home() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">Roundtable Sessions</h1>
          <p className="text-lg text-muted-foreground">Structured group debate and fast decisions.</p>
        </div>

        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Create a table, invite people with a code, share proposals, vote, and watch consensus form in real time. Great for cabinet briefings, strategy meetings, workshops, and classrooms.
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                For Hosts
              </CardTitle>
              <CardDescription>
                Create a new table and get a code to share with participants.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TableCreationDialog>
                <Button size="lg" className="w-full">
                  Start New Table
                </Button>
              </TableCreationDialog>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                For Participants
              </CardTitle>
              <CardDescription>
                Have a code from your host? Join the table to submit ideas and vote.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinCode">Table Code</Label>
                <Input
                  id="joinCode"
                  placeholder="Enter code (e.g., R1NMEC)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
              </div>
              <Button 
                size="lg" 
                className="w-full"
                disabled={!joinCode.trim() || !isValidTableCode(joinCode)}
                onClick={() => navigate(`/t/${joinCode}/join`)}
              >
                Join Table
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}