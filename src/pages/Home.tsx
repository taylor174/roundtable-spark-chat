import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, LogIn, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { TableCreationDialog } from '@/components/TableCreationDialog';

export default function Home() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut, loading: authLoading } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-bold">Agora</h1>
            <p className="text-muted-foreground">Collaborative Decision Making</p>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Welcome back!
                </span>
                <Button variant="outline" onClick={handleSignOut} size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button onClick={() => navigate('/auth')} size="sm">
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            )}
          </div>
        </div>

        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Collaborative Decision Making
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Host interactive sessions where participants suggest ideas, vote on proposals, 
            and reach consensus together in real-time.
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Host a Session
              </CardTitle>
              <CardDescription>
                Create a new collaborative table and invite participants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user ? (
                <TableCreationDialog>
                  <Button size="lg" className="w-full">
                    Create New Table
                  </Button>
                </TableCreationDialog>
              ) : (
                <Button 
                  size="lg" 
                  className="w-full" 
                  onClick={() => navigate('/auth')}
                >
                  Sign In to Create Table
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Join a Session
              </CardTitle>
              <CardDescription>
                Enter a table code to participate in an existing session
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full"
                onClick={() => navigate('/t/example/join')}
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