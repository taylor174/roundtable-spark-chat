import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ComprehensiveQASystem } from '@/utils/comprehensiveQA';
import { Shield, Zap, Users, AlertTriangle, CheckCircle, XCircle, Play } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

interface QAResults {
  security: TestResult[];
  reliability: TestResult[];
  performance: TestResult[];
  usability: TestResult[];
  edge_cases: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    score: number;
  };
}

export function QADashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<QAResults | null>(null);

  const runQA = async () => {
    setIsRunning(true);
    try {
      const qaSystem = new ComprehensiveQASystem();
      const testResults = await qaSystem.runFullQA();
      setResults(testResults);
    } catch (error) {
      console.error('QA failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pass: 'bg-green-100 text-green-800',
      fail: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800'
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const TestCategory = ({ title, icon: Icon, tests }: { 
    title: string; 
    icon: any; 
    tests: TestResult[] 
  }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tests.map((test, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {getStatusIcon(test.status)}
              <span>{test.test}</span>
            </div>
            <Badge className={getStatusBadge(test.status)}>
              {test.status}
            </Badge>
          </div>
        ))}
        {tests.length === 0 && (
          <div className="text-sm text-muted-foreground">No tests run yet</div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comprehensive QA Dashboard</h1>
          <p className="text-muted-foreground">
            Deep testing of security, reliability, performance, and usability
          </p>
        </div>
        <Button onClick={runQA} disabled={isRunning} className="gap-2">
          <Play className="h-4 w-4" />
          {isRunning ? 'Running QA...' : 'Run Full QA'}
        </Button>
      </div>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Overall Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">Quality Score</span>
                <span className={`text-2xl font-bold ${
                  results.summary.score >= 90 ? 'text-green-600' : 
                  results.summary.score >= 70 ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {results.summary.score}%
                </span>
              </div>
              <Progress value={results.summary.score} className="h-2" />
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {results.summary.passed}
                  </div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {results.summary.failed}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {results.summary.warnings}
                  </div>
                  <div className="text-sm text-muted-foreground">Warnings</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {results.summary.total}
                  </div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results && results.summary.failed > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {results.summary.failed} critical issues found that need immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {results && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TestCategory 
            title="Security Tests" 
            icon={Shield} 
            tests={results.security} 
          />
          <TestCategory 
            title="Reliability Tests" 
            icon={Zap} 
            tests={results.reliability} 
          />
          <TestCategory 
            title="Performance Tests" 
            icon={Users} 
            tests={results.performance} 
          />
          <TestCategory 
            title="Usability Tests" 
            icon={Users} 
            tests={results.usability} 
          />
        </div>
      )}

      {results && results.edge_cases.length > 0 && (
        <TestCategory 
          title="Edge Case Tests" 
          icon={AlertTriangle} 
          tests={results.edge_cases} 
        />
      )}

      {isRunning && (
        <Alert>
          <Play className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Running comprehensive quality assurance tests...
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}