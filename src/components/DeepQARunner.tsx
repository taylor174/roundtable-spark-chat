import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Shield, Activity, Zap, Users } from 'lucide-react';
import { liveQA } from '@/utils/liveQAExecution';
import { ComprehensiveQASystem } from '@/utils/comprehensiveQA';
import { AdvancedPenetrationTesting } from '@/utils/advancedPenetrationTesting';
import { EnterpriseQAFramework } from '@/utils/enterpriseQAFramework';

interface DeepQAResults {
  liveQA?: any;
  comprehensiveQA?: any;
  penetrationTesting?: any;
  enterpriseQA?: any;
  summary?: {
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
    securityScore: number;
    reliabilityScore: number;
    performanceScore: number;
    overallScore: number;
  };
  report?: string;
}

export function DeepQARunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<DeepQAResults | null>(null);
  const { toast } = useToast();

  const runDeepQA = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults(null);

    try {
      const qaResults: DeepQAResults = {};

      // Phase 1: Live QA Execution (25%)
      setCurrentPhase('Running Live QA System...');
      setProgress(25);
      qaResults.liveQA = await liveQA.executeCompleteQA();

      // Phase 2: Comprehensive QA (50%)
      setCurrentPhase('Executing Comprehensive QA...');
      setProgress(50);
      const comprehensiveQA = new ComprehensiveQASystem();
      qaResults.comprehensiveQA = await comprehensiveQA.runFullQA();

      // Phase 3: Advanced Penetration Testing (75%)
      setCurrentPhase('Running Penetration Tests...');
      setProgress(75);
      const penetrationTesting = new AdvancedPenetrationTesting();
      qaResults.penetrationTesting = await penetrationTesting.runFullPenetrationTest();

      // Phase 4: Enterprise QA Framework (90%)
      setCurrentPhase('Enterprise QA Framework...');
      setProgress(90);
      const enterpriseQA = new EnterpriseQAFramework();
      qaResults.enterpriseQA = await enterpriseQA.generateComprehensiveReport();

      // Phase 5: Generate Final Report (100%)
      setCurrentPhase('Generating Production Readiness Report...');
      setProgress(100);
      qaResults.report = await liveQA.generateDetailedReport();

      // Calculate summary metrics
      const summary = calculateSummaryMetrics(qaResults);
      qaResults.summary = summary;

      setResults(qaResults);
      
      toast({
        title: `Deep QA Complete - Overall Score: ${summary.overallScore}%`,
        description: `${summary.passed}/${summary.totalTests} tests passed. Security: ${summary.securityScore}%`,
        variant: summary.overallScore >= 80 ? "default" : "destructive"
      });

    } catch (error) {
      console.error('Deep QA execution failed:', error);
      toast({
        title: "Deep QA Failed",
        description: "Could not complete comprehensive quality assurance",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
      setCurrentPhase('');
    }
  };

  const calculateSummaryMetrics = (qaResults: DeepQAResults) => {
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    // Aggregate from all QA systems
    if (qaResults.liveQA?.summary) {
      totalTests += qaResults.liveQA.summary.total_tests || 0;
      passed += qaResults.liveQA.summary.passed || 0;
      failed += qaResults.liveQA.summary.failed || 0;
      warnings += qaResults.liveQA.summary.warnings || 0;
    }

    if (qaResults.comprehensiveQA?.summary) {
      totalTests += qaResults.comprehensiveQA.summary.total || 0;
      passed += qaResults.comprehensiveQA.summary.passed || 0;
      failed += qaResults.comprehensiveQA.summary.failed || 0;
    }

    if (qaResults.penetrationTesting?.summary) {
      totalTests += qaResults.penetrationTesting.summary.total_tests || 0;
      passed += qaResults.penetrationTesting.summary.passed_tests || 0;
      failed += qaResults.penetrationTesting.summary.failed_tests || 0;
    }

    const securityScore = Math.round(
      ((qaResults.liveQA?.summary?.security_score || 0) +
       (qaResults.penetrationTesting?.summary?.security_score || 0)) / 2
    );

    const reliabilityScore = Math.round(
      (passed / Math.max(totalTests, 1)) * 100
    );

    const performanceScore = Math.round(
      ((qaResults.liveQA?.summary?.performance_score || 0) +
       (qaResults.penetrationTesting?.summary?.performance_score || 0)) / 2
    );

    const overallScore = Math.round(
      (securityScore + reliabilityScore + performanceScore) / 3
    );

    return {
      totalTests,
      passed,
      failed,
      warnings,
      securityScore,
      reliabilityScore,
      performanceScore,
      overallScore
    };
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-yellow-600';
    if (score >= 70) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 80) return 'bg-yellow-100 text-yellow-800';
    if (score >= 70) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Deep Quality Assurance System
          </CardTitle>
          <CardDescription>
            Comprehensive production readiness assessment covering security, reliability, performance, and scalability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runDeepQA} 
            disabled={isRunning}
            size="lg"
            className="w-full mb-4"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Deep QA...
              </>
            ) : (
              'Execute Deep QA Assessment'
            )}
          </Button>

          {isRunning && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{currentPhase}</div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {results?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(results.summary.securityScore)}`}>
                {results.summary.securityScore}%
              </div>
              <Badge className={getScoreBadge(results.summary.securityScore)}>
                {results.summary.securityScore >= 90 ? 'Excellent' :
                 results.summary.securityScore >= 80 ? 'Good' :
                 results.summary.securityScore >= 70 ? 'Fair' : 'Needs Work'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Reliability Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(results.summary.reliabilityScore)}`}>
                {results.summary.reliabilityScore}%
              </div>
              <div className="text-xs text-muted-foreground">
                {results.summary.passed}/{results.summary.totalTests} tests passed
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Performance Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(results.summary.performanceScore)}`}>
                {results.summary.performanceScore}%
              </div>
              <Badge className={getScoreBadge(results.summary.performanceScore)}>
                Performance
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Overall Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(results.summary.overallScore)}`}>
                {results.summary.overallScore}%
              </div>
              <Badge className={getScoreBadge(results.summary.overallScore)}>
                {results.summary.overallScore >= 85 ? 'Production Ready' :
                 results.summary.overallScore >= 75 ? 'Nearly Ready' : 'Needs Improvement'}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {results?.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium">{results.summary.passed} Passed</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium">{results.summary.failed} Failed</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium">{results.summary.warnings} Warnings</span>
              </div>
            </div>

            {results.summary.overallScore < 85 && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Production Readiness:</strong> Your application needs improvement before production deployment. 
                  Focus on security ({results.summary.securityScore}%) and reliability ({results.summary.reliabilityScore}%) scores.
                </AlertDescription>
              </Alert>
            )}

            {results.summary.overallScore >= 85 && (
              <Alert className="mt-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Production Ready:</strong> Your application meets production quality standards with an overall score of {results.summary.overallScore}%.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {results?.report && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed QA Report</CardTitle>
            <CardDescription>
              Comprehensive analysis and recommendations for production deployment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-auto max-h-96">
              {results.report}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}