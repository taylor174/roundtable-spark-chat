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
          return prev + 1; // Much slower progress
        });
      }, 150); // Even longer interval

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
    <div className="fixed top-0 left-0 right-0 bg-background/90 backdrop-blur-sm z-40 border-b animate-fade-in">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-center space-x-4">
          <div className="flex items-center space-x-2 text-muted-foreground">
            {getPhaseIcon(fromPhase)}
            <span className="text-sm font-medium">{getPhaseLabel(fromPhase)}</span>
          </div>
          
          <ArrowRight className="h-5 w-5 text-primary animate-pulse" />
          
          <div className="flex items-center space-x-2 text-primary">
            {getPhaseIcon(toPhase)}
            <span className="text-sm font-medium">{getPhaseLabel(toPhase)}</span>
          </div>
        </div>

        <div className="mt-3 max-w-xs mx-auto">
          <Progress value={progress} className="h-1" />
          <p className="text-xs text-muted-foreground text-center mt-1">
            {progress < 100 ? getMessage() : 'Almost ready...'}
          </p>
        </div>
      </div>
    </div>
  );
}