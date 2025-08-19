import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AdvancedPenetrationTesting } from '@/utils/advancedPenetrationTesting';
import { 
  Shield, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Play, 
  Target,
  Database,
  Users,
  Globe,
  Gauge,
  Lock,
  Activity
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AdvancedTestResult {
  category: string;
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'critical';
  message: string;
  details?: any;
  execution_time?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations?: string[];
}

interface PenetrationTestResults {
  security_penetration: AdvancedTestResult[];
  stress_testing: AdvancedTestResult[];
  chaos_engineering: AdvancedTestResult[];
  scalability_limits: AdvancedTestResult[];
  data_integrity: AdvancedTestResult[];
  real_world_scenarios: AdvancedTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    critical: number;
    overall_score: number;
    security_score: number;
    reliability_score: number;
    scalability_score: number;
  };
}

export function AdvancedQADashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<PenetrationTestResults | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const runAdvancedQA = async () => {
    setIsRunning(true);
    try {
      const penetrationTesting = new AdvancedPenetrationTesting();
      const testResults = await penetrationTesting.runFullPenetrationTest();
      setResults(testResults);
      setActiveTab('overview');
    } catch (error) {
      console.error('Advanced QA failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-800" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pass: 'bg-green-100 text-green-800',
      fail: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-200 text-red-900 font-bold'
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-800';
      default: return 'text-gray-600';
    }
  };

  const TestCategory = ({ 
    title, 
    icon: Icon, 
    tests, 
    showDetails = false 
  }: { 
    title: string; 
    icon: any; 
    tests: AdvancedTestResult[];
    showDetails?: boolean;
  }) => (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
          <Badge variant="outline" className="ml-auto">
            {tests.length} tests
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tests.map((test, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {getStatusIcon(test.status)}
                <span className="font-medium">{test.test}</span>
              </div>
              <Badge className={getStatusBadge(test.status)}>
                {test.status}
              </Badge>
            </div>
            
            <div className="text-xs text-muted-foreground pl-6">
              {test.message}
            </div>
            
            {showDetails && (
              <div className="pl-6 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className={getSeverityColor(test.severity)}>
                    Severity: {test.severity}
                  </span>
                  {test.execution_time && (
                    <span className="text-muted-foreground">
                      {test.execution_time}ms
                    </span>
                  )}
                </div>
                
                {test.recommendations && test.recommendations.length > 0 && (
                  <div className="text-xs">
                    <div className="font-medium text-muted-foreground mb-1">Recommendations:</div>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {test.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {tests.length === 0 && (
          <div className="text-sm text-muted-foreground">No tests run yet</div>
        )}
      </CardContent>
    </Card>
  );

  const ScoreCard = ({ title, score, icon: Icon, color }: {
    title: string;
    score: number;
    icon: any;
    color: string;
  }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{score}%</p>
          </div>
          <Icon className={`h-8 w-8 ${color}`} />
        </div>
        <Progress value={score} className="h-2 mt-2" />
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8" />
            Advanced Penetration Testing & QA
          </h1>
          <p className="text-muted-foreground">
            Enterprise-grade security testing, stress testing, and chaos engineering
          </p>
        </div>
        <Button onClick={runAdvancedQA} disabled={isRunning} className="gap-2" size="lg">
          <Play className="h-4 w-4" />
          {isRunning ? 'Running Advanced QA...' : 'Run Full Penetration Test'}
        </Button>
      </div>

      {results && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="reliability">Reliability</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <ScoreCard 
                title="Overall Score"
                score={results.summary.overall_score}
                icon={Gauge}
                color={results.summary.overall_score >= 90 ? 'text-green-600' : 
                       results.summary.overall_score >= 70 ? 'text-yellow-600' : 'text-red-600'}
              />
              <ScoreCard 
                title="Security Score"
                score={results.summary.security_score}
                icon={Shield}
                color={results.summary.security_score >= 90 ? 'text-green-600' : 
                       results.summary.security_score >= 70 ? 'text-yellow-600' : 'text-red-600'}
              />
              <ScoreCard 
                title="Reliability Score"
                score={results.summary.reliability_score}
                icon={Activity}
                color={results.summary.reliability_score >= 90 ? 'text-green-600' : 
                       results.summary.reliability_score >= 70 ? 'text-yellow-600' : 'text-red-600'}
              />
              <ScoreCard 
                title="Scalability Score"
                score={results.summary.scalability_score}
                icon={Users}
                color={results.summary.scalability_score >= 90 ? 'text-green-600' : 
                       results.summary.scalability_score >= 70 ? 'text-yellow-600' : 'text-red-600'}
              />
            </div>

            {/* Summary Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Test Results Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-green-600">
                      {results.summary.passed}
                    </div>
                    <div className="text-sm text-muted-foreground">Passed</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-red-600">
                      {results.summary.failed}
                    </div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-yellow-600">
                      {results.summary.warnings}
                    </div>
                    <div className="text-sm text-muted-foreground">Warnings</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-red-800">
                      {results.summary.critical}
                    </div>
                    <div className="text-sm text-muted-foreground">Critical</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">
                      {results.summary.total}
                    </div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Critical Issues Alert */}
            {results.summary.critical > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{results.summary.critical} CRITICAL SECURITY ISSUES</strong> found that require immediate attention before production deployment.
                </AlertDescription>
              </Alert>
            )}

            {/* Quick Overview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              <TestCategory title="Security Penetration" icon={Lock} tests={results.security_penetration} />
              <TestCategory title="Stress Testing" icon={Zap} tests={results.stress_testing} />
              <TestCategory title="Data Integrity" icon={Database} tests={results.data_integrity} />
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <TestCategory 
                title="Security Penetration Testing Results" 
                icon={Shield} 
                tests={results.security_penetration}
                showDetails={true}
              />
            </div>
          </TabsContent>

          <TabsContent value="reliability" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TestCategory 
                title="Stress Testing" 
                icon={Zap} 
                tests={results.stress_testing}
                showDetails={true}
              />
              <TestCategory 
                title="Chaos Engineering" 
                icon={AlertTriangle} 
                tests={results.chaos_engineering}
                showDetails={true}
              />
            </div>
          </TabsContent>

          <TabsContent value="scenarios" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TestCategory 
                title="Scalability Limits" 
                icon={Users} 
                tests={results.scalability_limits}
                showDetails={true}
              />
              <TestCategory 
                title="Real-World Scenarios" 
                icon={Globe} 
                tests={results.real_world_scenarios}
                showDetails={true}
              />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {isRunning && (
        <Alert>
          <Target className="h-4 w-4 animate-pulse" />
          <AlertDescription>
            Running advanced penetration testing and comprehensive QA analysis...
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}