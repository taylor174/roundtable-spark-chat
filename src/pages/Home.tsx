import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Users, ExternalLink, AlertCircle, Play } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { TableCreationDialog } from '@/components/TableCreationDialog';

import { isValidTableCode } from '@/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState('');
  
  // Handle navigation state errors (from redirected table routes)
  useEffect(() => {
    if (location.state?.error) {
      toast({
        title: "Navigation Error",
        description: location.state.error,
        variant: "destructive",
      });
      
      // Clear the error from navigation state to prevent it showing on refresh
      window.history.replaceState({}, '', '/');
    }
  }, [location.state, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Roundtable</h1>
          <p className="text-base sm:text-lg text-muted-foreground">A new way to have big conversations</p>
        </div>

        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4">
            How it works
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-4">
            Roundtable helps groups reach consensus through structured dialogue, where every voice is equal and every idea gets heard. Host a table, share proposals, and vote step by step: great for large groups, meaningful discussions, and complex decisions
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-4 px-4 sm:px-0">
          
          {/* Show error alert if there was a navigation error */}
          {location.state?.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {location.state.error}
              </AlertDescription>
            </Alert>
          )}
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
                <Button size="touch" className="w-full">
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
                size="touch" 
                className="w-full"
                disabled={!joinCode.trim() || !isValidTableCode(joinCode)}
                onClick={() => navigate(`/t/${joinCode}/join`)}
              >
                Join Table
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Demo and Feedback Buttons */}
        <div className="max-w-md mx-auto mt-12 text-center">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open('https://youtu.be/djEuxMn4dtY?si=h0k5GaFi7BWMPD07', '_blank', 'noopener,noreferrer')}
            >
              <Play className="h-4 w-4 mr-2" />
              Demo
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              asChild
            >
              <a 
                href="https://docs.google.com/forms/d/12bGHXGWlxTrCjf5pxiAo3Es-AxdrnqO0VvVQnvqUYB0/edit" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Give Feedback
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
