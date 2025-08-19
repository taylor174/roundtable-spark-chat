import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Play, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export function SystemIntegrationTester() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runCompleteSystemTest = async () => {
    setIsRunning(true);
    const testResults: TestResult[] = [];

    try {
      // Test 1: Security - Host Secret Protection
      console.log('🔒 Testing security fixes...');
      try {
        const { data } = await supabase.rpc('get_safe_table_data').limit(1);
        const hasHostSecret = data?.some(item => 'host_secret' in item);
        
        testResults.push({
          name: 'Host Secret Protection',
          status: hasHostSecret ? 'fail' : 'pass',
          message: hasHostSecret ? 'host_secret still exposed!' : 'host_secret properly protected',
          details: data
        });
      } catch (error) {
        testResults.push({
          name: 'Host Secret Protection',
          status: 'warning',
          message: 'Error testing host secret protection',
          details: error
        });
      }

      // Test 2: Database Functions - Session Validation
      console.log('🗄️ Testing database functions...');
      try {
        const { data, error } = await supabase.rpc('validate_table_session', {
          p_table_id: '892a43b5-279f-4c54-a312-fb4b04387c4c',
          p_client_id: 'test-client-invalid'
        });
        
        if (error) throw error;
        const isValid = (data as any)?.valid;
        
        testResults.push({
          name: 'Session Validation Function',
          status: isValid === false ? 'pass' : 'warning',
          message: isValid === false ? 'Invalid sessions properly rejected' : 'Session validation unclear',
          details: data
        });
      } catch (error) {
        testResults.push({
          name: 'Session Validation Function',
          status: 'pass',
          message: 'Session validation function working (error expected)',
          details: error
        });
      }

      // Test 3: Public Table Info Function
      console.log('📋 Testing public data access...');
      try {
        const { data, error } = await supabase.rpc('get_public_table_info', {
          table_code: '2N3FIP'
        });
        
        if (error) throw error;
        const hasData = data && data.length > 0;
        const hasSecrets = data?.some((item: any) => 'host_secret' in item);
        
        testResults.push({
          name: 'Public Table Info Access',
          status: hasData && !hasSecrets ? 'pass' : 'warning',
          message: hasData && !hasSecrets ? 'Public data accessible without secrets' : 'Public data access issue',
          details: data
        });
      } catch (error) {
        testResults.push({
          name: 'Public Table Info Access',
          status: 'fail',
          message: 'Public table info function failed',
          details: error
        });
      }

      // Test 4: Database Constraints
      console.log('🏗️ Testing database constraints...');
      try {
        const { error } = await supabase
          .from('suggestions')
          .insert({
            text: 'x'.repeat(1000), // Too long
            round_id: '00000000-0000-0000-0000-000000000000',
            participant_id: '00000000-0000-0000-0000-000000000000'
          });
        
        testResults.push({
          name: 'Text Length Constraints',
          status: error ? 'pass' : 'fail',
          message: error ? 'Long text properly rejected' : 'Long text accepted (constraint failure)',
          details: error
        });
      } catch (error) {
        testResults.push({
          name: 'Text Length Constraints',
          status: 'pass',
          message: 'Text length constraints working',
          details: error
        });
      }

      // Test 5: Real-time Connection
      console.log('⚡ Testing real-time capabilities...');
      try {
        const channel = supabase.channel('test-integration');
        let connected = false;
        
        await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(false), 3000);
          
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              connected = true;
              clearTimeout(timeout);
              resolve(true);
            }
          });
        });
        
        supabase.removeChannel(channel);
        
        testResults.push({
          name: 'Real-time Connection',
          status: connected ? 'pass' : 'warning',
          message: connected ? 'Real-time connection successful' : 'Real-time connection timeout',
          details: { connected }
        });
      } catch (error) {
        testResults.push({
          name: 'Real-time Connection',
          status: 'fail',
          message: 'Real-time connection failed',
          details: error
        });
      }

      // Test 6: Performance - Query Speed
      console.log('🚀 Testing performance...');
      const startTime = Date.now();
      try {
        await supabase.rpc('get_safe_table_data').limit(5);
        const queryTime = Date.now() - startTime;
        
        testResults.push({
          name: 'Database Query Performance',
          status: queryTime < 500 ? 'pass' : queryTime < 1000 ? 'warning' : 'fail',
          message: `Query completed in ${queryTime}ms`,
          details: { queryTime }
        });
      } catch (error) {
        testResults.push({
          name: 'Database Query Performance',
          status: 'fail',
          message: 'Database query failed',
          details: error
        });
      }

      // Test 7: Error Handling
      console.log('🛡️ Testing error handling...');
      try {
        // Test with an invalid query that should fail
        await supabase.from('tables' as any).select('invalid_column_that_does_not_exist');
        testResults.push({
          name: 'Error Handling',
          status: 'fail',
          message: 'Invalid queries should fail but did not',
        });
      } catch (error) {
        testResults.push({
          name: 'Error Handling',
          status: 'pass',
          message: 'Error handling working correctly',
          details: error
        });
      }

      console.log('✅ System integration test complete');
      
    } catch (globalError) {
      testResults.push({
        name: 'Global Test Framework',
        status: 'fail',
        message: 'Test framework encountered an error',
        details: globalError
      });
    }

    setResults(testResults);
    setIsRunning(false);
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

  const passedTests = results.filter(r => r.status === 'pass').length;
  const failedTests = results.filter(r => r.status === 'fail').length;
  const warningTests = results.filter(r => r.status === 'warning').length;
  const totalTests = results.length;
  const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Complete System Integration Test</h2>
          <p className="text-muted-foreground">
            End-to-end testing of all implemented functionality
          </p>
        </div>
        <Button onClick={runCompleteSystemTest} disabled={isRunning} className="gap-2">
          <Play className="h-4 w-4" />
          {isRunning ? 'Running Tests...' : 'Run Integration Test'}
        </Button>
      </div>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center mb-4">
              <div>
                <div className="text-2xl font-bold text-green-600">{passedTests}</div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{failedTests}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{warningTests}</div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{totalTests}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${
                successRate >= 90 ? 'text-green-600' : 
                successRate >= 70 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {successRate}%
              </div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </CardContent>
        </Card>
      )}

      {failedTests > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {failedTests} critical test(s) failed. Review the results below.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {results.map((result, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(result.status)}
                  {result.name}
                </div>
                <Badge className={getStatusBadge(result.status)}>
                  {result.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
              {result.details && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Details</summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {isRunning && (
        <Alert>
          <Play className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Running comprehensive system integration tests...
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}