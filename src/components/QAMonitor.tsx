import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Download, Shield, Zap, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useQualityAssurance } from '@/hooks/useQualityAssurance';

export function QAMonitor() {
  const { results, runQualityAssurance, generateReport } = useQualityAssurance();

  const handleDownloadReport = async () => {
    const report = await generateReport();
    if (report) {
      const blob = new Blob([report], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qa-report-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 90) return 'default';
    if (score >= 80) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Quality Assurance Monitor
            </CardTitle>
            <CardDescription>
              Real-time system health and quality metrics
              {results.lastRun && (
                <span className="block text-xs mt-1">
                  Last run: {results.lastRun.toLocaleString()}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={runQualityAssurance} 
              disabled={results.isRunning}
              size="sm"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {results.isRunning ? 'Running...' : 'Run QA'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownloadReport}
              disabled={!results.lastRun}
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Report
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">Overall Score</span>
            <Badge variant={getScoreBadgeVariant(results.overall.score)}>
              {results.overall.score}%
            </Badge>
          </div>
          <Progress value={results.overall.score} className="w-full mb-2" />
          <p className="text-sm text-muted-foreground">{results.overall.message}</p>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Security */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Security</span>
                <Badge variant={getScoreBadgeVariant(results.security.score)} className="ml-auto">
                  {results.security.score}%
                </Badge>
              </div>
              <Progress value={results.security.score} className="mb-2" />
              <div className="flex gap-2 text-xs">
                {results.security.critical > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {results.security.critical} Critical
                  </Badge>
                )}
                {results.security.warnings > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {results.security.warnings} Warnings
                  </Badge>
                )}
                {results.security.critical === 0 && results.security.warnings === 0 && (
                  <Badge variant="default" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Secure
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reliability */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-green-600" />
                <span className="font-medium">Reliability</span>
                <Badge variant={getScoreBadgeVariant(results.reliability.score)} className="ml-auto">
                  {results.reliability.score}%
                </Badge>
              </div>
              <Progress value={results.reliability.score} className="mb-2" />
              <p className="text-xs text-muted-foreground">
                {results.reliability.passed}/{results.reliability.tests} tests passed
              </p>
            </CardContent>
          </Card>

          {/* Performance */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-yellow-600" />
                <span className="font-medium">Performance</span>
                <Badge variant={getScoreBadgeVariant(results.performance.score)} className="ml-auto">
                  {results.performance.score}%
                </Badge>
              </div>
              <Progress value={results.performance.score} className="mb-2" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Response: {results.performance.responseTime}ms</p>
                <p>Memory: {results.performance.memoryUsage}MB</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}