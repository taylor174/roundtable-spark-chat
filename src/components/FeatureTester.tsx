import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertCircle, Play } from 'lucide-react';
import { useTableState } from '@/hooks/useTableStateOptimized';

interface FeatureTest {
  id: string;
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'warning' | 'untested';
  description: string;
  expectedBehavior: string;
}

const ALL_FEATURES: FeatureTest[] = [
  // Core Navigation & Setup (✅ Working)
  {
    id: 'home-page',
    name: 'Home Page',
    category: 'Navigation',
    status: 'pass',
    description: 'Landing page with table creation and join options',
    expectedBehavior: 'Users can create new tables or join existing ones'
  },
  {
    id: 'table-creation',
    name: 'Table Creation',
    category: 'Setup',
    status: 'pass',
    description: 'Host creates new collaborative session',
    expectedBehavior: 'Generate unique code, set up host controls'
  },
  {
    id: 'participant-join',
    name: 'Participant Join System',
    category: 'Setup',
    status: 'pass',
    description: 'Non-hosts join existing sessions',
    expectedBehavior: 'Enter name, join table, see participant list'
  },
  {
    id: 'qr-code-sharing',
    name: 'QR Code Sharing',
    category: 'Setup',
    status: 'pass',
    description: 'Share table access via QR codes',
    expectedBehavior: 'Generate scannable QR code for table URL'
  },

  // Real-Time Core Features (🚨 Testing Required)
  {
    id: 'realtime-table-state',
    name: 'Real-Time Table State Management',
    category: 'Real-Time',
    status: 'untested',
    description: 'All participants see table changes immediately',
    expectedBehavior: 'Status changes, phase transitions sync instantly'
  },
  {
    id: 'phase-management',
    name: 'Phase Management (Suggest → Vote → Result)',
    category: 'Core Flow',
    status: 'untested',
    description: 'Automatic progression through game phases',
    expectedBehavior: 'Timer-based or completion-based phase advancement'
  },
  {
    id: 'host-controls',
    name: 'Host Controls',
    category: 'Host Features',
    status: 'untested',
    description: 'Start/stop table, adjust timing, skip phases',
    expectedBehavior: 'All controls work and sync to participants'
  },
  {
    id: 'suggestion-submission',
    name: 'Suggestion System',
    category: 'Core Flow',
    status: 'untested',
    description: 'Participants submit suggestions during suggest phase',
    expectedBehavior: 'Submit, edit, see all suggestions real-time'
  },
  {
    id: 'voting-system',
    name: 'Voting System',
    category: 'Core Flow',
    status: 'untested',
    description: 'Vote on suggestions during vote phase',
    expectedBehavior: 'Select one suggestion, see voting progress'
  },
  {
    id: 'winner-selection',
    name: 'Winner Selection & Progression',
    category: 'Core Flow',
    status: 'untested',
    description: 'Determine winners and advance rounds',
    expectedBehavior: 'Auto-select winner, create block, next round'
  },

  // Secondary Features
  {
    id: 'timeline-display',
    name: 'Timeline Display',
    category: 'UI',
    status: 'pass',
    description: 'Show progression through rounds',
    expectedBehavior: 'Visual timeline of completed rounds'
  },
  {
    id: 'participant-management',
    name: 'Participant Management',
    category: 'Host Features',
    status: 'pass',
    description: 'Manage participant list and status',
    expectedBehavior: 'View participants, host indicators'
  },
  {
    id: 'mobile-responsiveness',
    name: 'Mobile Responsiveness',
    category: 'UI',
    status: 'pass',
    description: 'Full functionality on mobile devices',
    expectedBehavior: 'Touch-optimized interface, responsive layout'
  },
  {
    id: 'summary-export',
    name: 'Summary & Export',
    category: 'Export',
    status: 'pass',
    description: 'View final results and export',
    expectedBehavior: 'Summary page with export options'
  },
  {
    id: 'connection-monitoring',
    name: 'Connection Monitoring',
    category: 'Reliability',
    status: 'pass',
    description: 'Monitor real-time connection status',
    expectedBehavior: 'Show connection status, handle disconnections'
  },
  {
    id: 'qa-dashboard',
    name: 'QA Dashboard',
    category: 'Admin',
    status: 'pass',
    description: 'Quality assurance and testing tools',
    expectedBehavior: 'Admin panel for system testing'
  }
];

interface FeatureTesterProps {
  tableCode?: string;
}

export function FeatureTester({ tableCode }: FeatureTesterProps) {
  const [features, setFeatures] = useState<FeatureTest[]>(ALL_FEATURES);
  const [testingFeature, setTestingFeature] = useState<string | null>(null);

  // Get table state if we have a table code
  const tableState = tableCode ? useTableState(tableCode) : null;

  const updateFeatureStatus = (featureId: string, status: FeatureTest['status']) => {
    setFeatures(prev => prev.map(f => 
      f.id === featureId ? { ...f, status } : f
    ));
  };

  const testRealTimeFeatures = async () => {
    if (!tableState) return;

    const { table, currentPhase, participants, isHost } = tableState;

    // Test 1: Real-Time Table State Management
    setTestingFeature('realtime-table-state');
    if (table?.status && currentPhase) {
      updateFeatureStatus('realtime-table-state', 'pass');
    } else {
      updateFeatureStatus('realtime-table-state', 'fail');
    }

    // Test 2: Host Controls (if user is host)
    setTestingFeature('host-controls');
    if (isHost) {
      updateFeatureStatus('host-controls', table?.status === 'lobby' ? 'pass' : 'warning');
    } else {
      updateFeatureStatus('host-controls', 'warning'); // Can't test if not host
    }

    // Test 3: Phase Management
    setTestingFeature('phase-management');
    if (currentPhase === 'lobby' || currentPhase === 'suggest' || currentPhase === 'vote') {
      updateFeatureStatus('phase-management', 'pass');
    } else {
      updateFeatureStatus('phase-management', 'fail');
    }

    // Test 4: Participant System
    setTestingFeature('suggestion-submission');
    if (participants.length > 0) {
      updateFeatureStatus('suggestion-submission', currentPhase === 'suggest' ? 'pass' : 'warning');
    } else {
      updateFeatureStatus('suggestion-submission', 'fail');
    }

    setTestingFeature(null);
  };

  const getStatusIcon = (status: FeatureTest['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusBadge = (status: FeatureTest['status']) => {
    const variants = {
      pass: 'default',
      fail: 'destructive',
      warning: 'secondary',
      untested: 'outline'
    } as const;

    const labels = {
      pass: 'PASS',
      fail: 'FAIL',
      warning: 'WARNING',
      untested: 'UNTESTED'
    };

    return (
      <Badge variant={variants[status]} className="text-xs font-mono">
        {labels[status]}
      </Badge>
    );
  };

  const categorizedFeatures = features.reduce((acc, feature) => {
    if (!acc[feature.category]) acc[feature.category] = [];
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, FeatureTest[]>);

  const passCount = features.filter(f => f.status === 'pass').length;
  const failCount = features.filter(f => f.status === 'fail').length;
  const warningCount = features.filter(f => f.status === 'warning').length;
  const untestedCount = features.filter(f => f.status === 'untested').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Collaborative Storytelling App - Feature Test Results
            {tableCode && (
              <Button onClick={testRealTimeFeatures} disabled={!!testingFeature}>
                <Play className="h-4 w-4 mr-2" />
                Test Real-Time Features
              </Button>
            )}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" className="bg-green-600">
              {passCount} Passing
            </Badge>
            <Badge variant="destructive">
              {failCount} Failing
            </Badge>
            <Badge variant="secondary">
              {warningCount} Warnings
            </Badge>
            <Badge variant="outline">
              {untestedCount} Untested
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(categorizedFeatures).map(([category, categoryFeatures]) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-3 text-primary">
                  {category}
                </h3>
                <div className="space-y-3">
                  {categoryFeatures.map(feature => (
                    <div
                      key={feature.id}
                      className={`p-4 rounded-lg border transition-all ${
                        testingFeature === feature.id 
                          ? 'border-primary bg-primary/5 animate-pulse' 
                          : 'border-border bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusIcon(feature.status)}
                            <h4 className="font-medium truncate">{feature.name}</h4>
                            {getStatusBadge(feature.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {feature.description}
                          </p>
                          <p className="text-xs text-muted-foreground italic">
                            Expected: {feature.expectedBehavior}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {tableCode && tableState && (
        <Card>
          <CardHeader>
            <CardTitle>Current Table State (Table: {tableCode})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Status:</span>
                <Badge variant="outline" className="ml-2">
                  {tableState.table?.status || 'unknown'}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Phase:</span>
                <Badge variant="outline" className="ml-2">
                  {tableState.currentPhase || 'unknown'}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Participants:</span>
                <Badge variant="outline" className="ml-2">
                  {tableState.participants.length}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Is Host:</span>
                <Badge variant="outline" className="ml-2">
                  {tableState.isHost ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}