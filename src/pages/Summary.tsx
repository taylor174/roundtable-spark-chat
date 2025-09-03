import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SummaryTimeline } from '@/components/SummaryTimeline';
import { useSummaryData } from '@/hooks/useSummaryData';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Home, Download, Share2, ExternalLink } from 'lucide-react';
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
    
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discussion Summary: ${data.table?.title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
            line-height: 1.6; 
            color: hsl(222.2 84% 4.9%); 
            background: hsl(0 0% 100%);
            padding: 2rem;
        }
        .container { max-width: 64rem; margin: 0 auto; }
        .header { margin-bottom: 2rem; }
        .title { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; color: hsl(222.2 84% 4.9%); }
        .subtitle { color: hsl(215.4 16.3% 46.9%); font-size: 1rem; }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 1rem; 
            margin-bottom: 2rem; 
        }
        .stat-card { 
            background: hsl(0 0% 100%); 
            border: 1px solid hsl(214.3 31.8% 91.4%); 
            border-radius: 0.75rem; 
            padding: 1.5rem; 
            text-align: center;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        }
        .stat-value { font-size: 2rem; font-weight: 700; color: hsl(221.2 83.2% 53.3%); }
        .stat-label { font-size: 0.875rem; color: hsl(215.4 16.3% 46.9%); margin-top: 0.25rem; }
        .timeline-card { 
            background: hsl(0 0% 100%); 
            border: 1px solid hsl(214.3 31.8% 91.4%); 
            border-radius: 0.75rem; 
            padding: 1.5rem;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        }
        .timeline-title { 
            font-size: 1.25rem; 
            font-weight: 600; 
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: hsl(222.2 84% 4.9%);
        }
        .original-topic { 
            background: hsl(210 40% 98%); 
            border: 1px solid hsl(214.3 31.8% 91.4%);
            border-radius: 0.5rem; 
            padding: 1rem; 
            margin-bottom: 1.5rem; 
        }
        .round-item { 
            display: flex; 
            gap: 1rem; 
            margin-bottom: 1.5rem; 
            align-items: flex-start;
            position: relative;
        }
        .round-item:not(:last-child)::after {
            content: '';
            position: absolute;
            left: 0.875rem;
            top: 2rem;
            bottom: -1.5rem;
            width: 2px;
            background: hsl(214.3 31.8% 91.4%);
            z-index: -1;
        }
        .round-number { 
            background: linear-gradient(135deg, hsl(221.2 83.2% 53.3%), hsl(262.1 83.3% 57.8%)); 
            color: white; 
            width: 2rem; 
            height: 2rem; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-weight: 600; 
            font-size: 0.875rem;
            flex-shrink: 0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            position: relative;
            z-index: 1;
        }
        .round-content { flex: 1; }
        .round-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 0.5rem; 
        }
        .round-meta { color: hsl(215.4 16.3% 46.9%); font-size: 0.875rem; }
        .round-text { 
            background: hsl(210 40% 98%); 
            border: 1px solid hsl(214.3 31.8% 91.4%);
            padding: 0.75rem; 
            border-radius: 0.5rem; 
            margin-top: 0.5rem; 
            line-height: 1.5;
        }
        .winner-badge { 
            background: hsl(47.9 95.8% 53.1%); 
            color: hsl(222.2 84% 4.9%); 
            padding: 0.25rem 0.75rem; 
            border-radius: 9999px; 
            font-size: 0.75rem; 
            font-weight: 500;
            display: inline-flex;
            align-items: center;
        }
        .summary-footer { 
            text-align: center; 
            padding-top: 1rem; 
            border-top: 1px solid hsl(214.3 31.8% 91.4%); 
            color: hsl(215.4 16.3% 46.9%); 
            font-size: 0.875rem; 
        }
        @media print {
            body { background: white; padding: 1rem; }
            .container { max-width: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">Discussion Summary</h1>
            <p class="subtitle">${data.table?.title} • ${data.blocks.length} rounds</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${data.blocks.length}</div>
                <div class="stat-label">Rounds</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.participants.length}</div>
                <div class="stat-label">Participants</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.table?.status === 'closed' ? 'Closed' : 'Active'}</div>
                <div class="stat-label">Status</div>
            </div>
        </div>
        
        <div class="timeline-card">
            <div class="timeline-title">
                <span>💬</span>
                <span>Discussion Thread</span>
                <span style="margin-left: auto; font-size: 0.875rem; color: #6b7280;">${data.participants.length} participants</span>
            </div>
            
            ${data.table?.title ? `
            <div class="original-topic">
                <div style="font-weight: 600; margin-bottom: 0.5rem;">Original Topic</div>
                <div>${data.table.title}</div>
            </div>
            ` : ''}
            
            ${data.blocks.length > 0 ? `
            <div>
                <div style="font-weight: 600; margin-bottom: 1rem;">Completed Rounds</div>
                ${data.blocks.map((block, index) => {
                  const date = new Date(block.created_at);
                  return `
                  <div class="round-item">
                      <div class="round-number">${index + 1}</div>
                      <div class="round-content">
                          <div class="round-header">
                              <div class="round-meta">
                                  ${block.winnerName ? `<span class="winner-badge">Winner: ${block.winnerName}</span>` : ''}
                              </div>
                              <div class="round-meta">${date.toLocaleDateString()}</div>
                          </div>
                          <div class="round-text">${block.text}</div>
                          <div class="round-meta" style="margin-top: 0.5rem;">
                              ${date.toLocaleTimeString()}
                          </div>
                      </div>
                  </div>`;
                }).join('')}
            </div>
            ` : '<div style="text-align: center; color: #6b7280; padding: 2rem;">No rounds completed yet.</div>'}
            
            <div class="summary-footer">
                Summary contains ${data.blocks.length} discussion rounds
            </div>
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discussion-summary-${code}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: "Discussion summary downloaded as HTML (print to save as PDF)",
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
              <Button variant="outline" size="sm" asChild>
                <a 
                  href="https://docs.google.com/forms/d/12bGHXGWlxTrCjf5pxiAo3Es-AxdrnqO0VvVQnvqUYB0/edit" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Feedback
                </a>
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
          rounds={data.rounds}
          suggestions={data.suggestions}
          votes={data.votes}
        />
      </div>
    </div>
  );
}