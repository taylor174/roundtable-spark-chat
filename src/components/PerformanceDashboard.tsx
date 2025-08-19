import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EnterpriseQAFramework } from '@/utils/enterpriseQAFramework';
import { Activity, Download, Play } from 'lucide-react';

interface BenchmarkResult {
  name: string;
  averageTime: number;
  maxTime: number;
  minTime: number;
  successRate: number;
  errorRate: number;
  throughput: number;
}

export function PerformanceDashboard() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<string>('');

  const runBenchmarks = async () => {
    setIsRunning(true);
    try {
      const framework = new EnterpriseQAFramework();
      const results = await framework.runPerformanceBenchmarks();
      setBenchmarks(results);
      
      const fullReport = await framework.generateComprehensiveReport();
      setReport(fullReport);
    } catch (error) {
      console.error('Benchmark failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const downloadReport = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qa-report-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPerformanceColor = (value: number, type: 'time' | 'rate') => {
    if (type === 'time') {
      return value < 100 ? 'text-green-600' : value < 500 ? 'text-yellow-600' : 'text-red-600';
    } else {
      return value > 95 ? 'text-green-600' : value > 80 ? 'text-yellow-600' : 'text-red-600';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Performance Benchmarks
          </h2>
          <p className="text-muted-foreground">
            Real-time performance metrics and system benchmarks
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runBenchmarks} disabled={isRunning} className="gap-2">
            <Play className="h-4 w-4" />
            {isRunning ? 'Running...' : 'Run Benchmarks'}
          </Button>
          {report && (
            <Button onClick={downloadReport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download Report
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {benchmarks.map((benchmark, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-lg">{benchmark.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Average Time</div>
                  <div className={`text-xl font-bold ${getPerformanceColor(benchmark.averageTime, 'time')}`}>
                    {benchmark.averageTime.toFixed(1)}ms
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                  <div className={`text-xl font-bold ${getPerformanceColor(benchmark.successRate, 'rate')}`}>
                    {benchmark.successRate.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Throughput</div>
                  <div className="text-lg font-medium">
                    {benchmark.throughput.toFixed(1)} ops/s
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Error Rate</div>
                  <div className={`text-lg font-medium ${benchmark.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                    {benchmark.errorRate.toFixed(1)}%
                  </div>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Min: {benchmark.minTime}ms</span>
                  <span>Max: {benchmark.maxTime}ms</span>
                </div>
              </div>
              
              <Badge 
                variant={benchmark.successRate > 95 ? 'default' : 
                        benchmark.successRate > 80 ? 'secondary' : 'destructive'}
                className="w-full justify-center"
              >
                {benchmark.successRate > 95 ? 'Excellent' : 
                 benchmark.successRate > 80 ? 'Good' : 'Needs Improvement'}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {benchmarks.length === 0 && !isRunning && (
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Benchmarks Run Yet</h3>
            <p className="text-muted-foreground mb-4">
              Click "Run Benchmarks" to start performance testing
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}