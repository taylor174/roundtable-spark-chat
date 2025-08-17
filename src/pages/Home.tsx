import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { TableCreationDialog } from '@/components/TableCreationDialog';
import { NavigationTest } from '@/components/NavigationTest';
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
          <h1 className="text-4xl font-bold mb-2">Classroom Sessions</h1>
          <p className="text-lg text-muted-foreground">Interactive group discussions and decision making</p>
        </div>

        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Instructors create sessions, students join with a simple code, suggest ideas, vote on options, 
            and see results in real-time. Perfect for brainstorming, decision making, and group activities.
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                For Instructors
              </CardTitle>
              <CardDescription>
                Create a new session and get a code to share with students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TableCreationDialog>
                <Button size="lg" className="w-full">
                  Create New Session
                </Button>
              </TableCreationDialog>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                For Students
              </CardTitle>
              <CardDescription>
                Enter the session code provided by your instructor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinCode">Session Code</Label>
                <Input
                  id="joinCode"
                  placeholder="Enter code (e.g., ABC123)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
              </div>
              <Button 
                size="lg" 
                className="w-full"
                disabled={!joinCode.trim() || !isValidTableCode(joinCode)}
                onClick={() => {
                  console.log('🔍 HOME: Join button clicked', { joinCode, isValid: isValidTableCode(joinCode) });
                  const targetUrl = `/t/${joinCode}/join`;
                  console.log('🔍 HOME: Navigating to:', targetUrl);
                  
                  try {
                    navigate(targetUrl);
                    console.log('🔍 HOME: Navigation called successfully');
                  } catch (error) {
                    console.error('🔍 HOME: Navigation failed:', error);
                    toast({
                      title: "Navigation Error",
                      description: "Failed to navigate to join page. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Join Session
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Navigation Test Component - Remove after debugging */}
        <NavigationTest />
      </div>
    </div>
  );
}