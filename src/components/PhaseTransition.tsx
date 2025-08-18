import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Users, Vote, Trophy } from 'lucide-react';

interface PhaseTransitionProps {
  isVisible: boolean;
  fromPhase: string;
  toPhase: string;
}

export function PhaseTransition({ isVisible, fromPhase, toPhase }: PhaseTransitionProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isVisible) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 2; // Slower progress
        });
      }, 100); // Longer interval

      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'suggest':
        return <Users className="h-8 w-8" />;
      case 'vote':
        return <Vote className="h-8 w-8" />;
      case 'result':
        return <Trophy className="h-8 w-8" />;
      default:
        return <ArrowRight className="h-8 w-8" />;
    }
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'suggest':
        return 'Suggestion Phase';
      case 'vote':
        return 'Voting Phase';
      case 'result':
        return 'Results';
      default:
        return phase;
    }
  };

  const getMessage = () => {
    if (fromPhase === 'suggest' && toPhase === 'vote') {
      return 'All suggestions collected! Moving to voting...';
    }
    if (fromPhase === 'vote' && toPhase === 'result') {
      return 'Voting complete! Calculating results...';
    }
    return 'Transitioning to next phase...';
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center space-x-2 text-muted-foreground">
              {getPhaseIcon(fromPhase)}
              <span className="font-medium">{getPhaseLabel(fromPhase)}</span>
            </div>
            
            <ArrowRight className="h-6 w-6 text-primary animate-pulse" />
            
            <div className="flex items-center space-x-2 text-primary">
              {getPhaseIcon(toPhase)}
              <span className="font-medium">{getPhaseLabel(toPhase)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {progress < 100 ? getMessage() : 'Almost ready...'}
            </p>
          </div>

          <div className="animate-pulse">
            <div className="h-2 w-2 bg-primary rounded-full mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}