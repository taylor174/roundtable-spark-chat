import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SummaryTimeline } from '@/components/SummaryTimeline';
import { useSummaryData } from '@/hooks/useSummaryData';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Home, Download, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Summary() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, loading, error } = useSummaryData(code || '');

  useEffect(() => {
    if (!code) {
      navigate('/');
    }
  }, [code, navigate]);

  const handleShare = async () => {
    if (navigator.share && data?.table) {
      try {
        await navigator.share({
          title: `Discussion Summary: ${data.table.title}`,
          text: `Check out this discussion summary with ${data.blocks.length} rounds`,
          url: window.location.href,
        });
      } catch (error) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link copied",
          description: "Summary link copied to clipboard",
        });
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Summary link copied to clipboard",
      });
    }
  };

  const handleExport = () => {
    if (!data) return;
    
    const content = `Discussion Summary: ${data.table?.title}\n\n` +
      `Original Topic: ${data.table?.title}\n` +
      `Total Rounds: ${data.blocks.length}\n` +
      `Participants: ${data.participants.length}\n\n` +
      data.blocks.map((block, index) => 
        `Round ${index + 1}: ${block.text}\n`
      ).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discussion-summary-${code}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: "Discussion summary downloaded",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !data) {
    const isTableNotFound = error?.includes('Table not found');
    const isParticipantsError = error?.includes('Failed to load participants');
    const isBlocksError = error?.includes('Failed to load discussion rounds');
    
    let errorMessage = 'Failed to load discussion summary';
    if (isTableNotFound) {
      errorMessage = `Discussion with code "${code}" not found`;
    } else if (isParticipantsError) {
      errorMessage = 'Unable to load participant information';
    } else if (isBlocksError) {
      errorMessage = 'Unable to load discussion history';
    } else if (error) {
      errorMessage = error;
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">
              {errorMessage}
            </p>
            <div className="space-y-2">
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                Try Again
              </Button>
              <Button onClick={() => navigate('/')} className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Discussion Summary</h1>
              <p className="text-muted-foreground">
                {data.table?.title} • {data.blocks.length} rounds
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => navigate('/')}>
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            </div>
          </div>
        </div>

        {/* Session Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {data.blocks.length}
                </div>
                <div className="text-sm text-muted-foreground">Rounds</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {data.participants.length}
                </div>
                <div className="text-sm text-muted-foreground">Participants</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {data.table?.status === 'closed' ? 'Closed' : 'Active'}
                </div>
                <div className="text-sm text-muted-foreground">Status</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <SummaryTimeline 
          blocks={data.blocks}
          originalTitle={data.table?.title}
          participants={data.participants}
        />
      </div>
    </div>
  );
}