import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateTableCode, generateHostSecret } from '@/utils';
import { storeHostSecret } from '@/utils/clientId';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface TableCreationDialogProps {
  children?: React.ReactNode;
}

export function TableCreationDialog({ children }: TableCreationDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [suggestTime, setSuggestTime] = useState(600); // 10 minutes default
  const [voteTime, setVoteTime] = useState(60); // 60 seconds default
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const suggestionPresets = [
    { label: '5 minutes', value: 300 },
    { label: '10 minutes', value: 600 },
    { label: '15 minutes', value: 900 },
    { label: '20 minutes', value: 1200 },
    { label: '30 minutes', value: 1800 },
    { label: '40 minutes', value: 2400 },
    { label: '50 minutes', value: 3000 },
    { label: '60 minutes', value: 3600 },
  ];

  const votingPresets = [
    { label: '30 seconds', value: 30 },
    { label: '60 seconds', value: 60 },
    { label: '90 seconds', value: 90 },
    { label: '2 minutes', value: 120 },
    { label: '3 minutes', value: 180 },
  ];

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
      storeHostSecret(tableCode, hostSecret);

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
          <DialogTitle>Create New Session</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Session Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Brainstorming Session, Decision Making"
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional: What topic will you be exploring?"
              rows={4}
              className="resize-y"
            />
          </div>

          <Card className="p-4">
            <h4 className="font-medium mb-3">Phase Timing</h4>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="suggestTime">Suggestion Phase</Label>
                <Select value={suggestTime.toString()} onValueChange={(value) => setSuggestTime(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {suggestionPresets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value.toString()}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="voteTime">Voting Phase</Label>
                <Select value={voteTime.toString()} onValueChange={(value) => setVoteTime(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {votingPresets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value.toString()}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              {loading ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}