import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateTableCode, generateHostSecret } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface TableCreationDialogProps {
  children?: React.ReactNode;
}

export function TableCreationDialog({ children }: TableCreationDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [suggestTime, setSuggestTime] = useState(120);
  const [voteTime, setVoteTime] = useState(60);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a table title",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const tableCode = generateTableCode();
      const hostSecret = generateHostSecret();

      const { data: table, error } = await supabase
        .from('tables')
        .insert({
          code: tableCode,
          host_secret: hostSecret,
          title: title.trim(),
          description: description.trim() || null,
          default_suggest_sec: suggestTime,
          default_vote_sec: voteTime,
          status: 'lobby',
        })
        .select()
        .single();

      if (error) throw error;

      // Store host secret
      localStorage.setItem(`host_secret_${tableCode}`, hostSecret);

      toast({
        title: "Table created successfully!",
        description: `Table code: ${tableCode}`,
      });

      setOpen(false);
      navigate(`/t/${tableCode}`);
    } catch (error: any) {
      console.error('Error creating table:', error);
      toast({
        title: "Failed to create table",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Create New Table
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Discussion Table</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Table Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Product Roadmap Planning"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what you'll be discussing..."
              rows={3}
              maxLength={500}
            />
          </div>

          <Card className="p-4">
            <h4 className="font-medium mb-3">Phase Timing</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="suggestTime">Suggestion Phase (seconds)</Label>
                <Input
                  id="suggestTime"
                  type="number"
                  value={suggestTime}
                  onChange={(e) => setSuggestTime(Number(e.target.value))}
                  min={30}
                  max={600}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voteTime">Voting Phase (seconds)</Label>
                <Input
                  id="voteTime"
                  type="number"
                  value={voteTime}
                  onChange={(e) => setVoteTime(Number(e.target.value))}
                  min={15}
                  max={300}
                />
              </div>
            </div>
          </Card>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setOpen(false)}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Table'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}