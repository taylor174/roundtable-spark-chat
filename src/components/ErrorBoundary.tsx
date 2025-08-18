import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorId: '',
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { 
      hasError: true, 
      error,
      errorId 
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error reporting service
      // errorReportingService.captureException(error, { extra: errorInfo });
    }
  }

  private handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      errorId: ''
    });
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. This has been logged and we'll look into it.
              </CardDescription>
              {this.state.errorId && (
                <div className="text-xs text-muted-foreground mt-2">
                  Error ID: {this.state.errorId}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                <Button 
                  onClick={this.handleReset}
                  className="w-full"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  variant="outline"
                  onClick={this.handleRefresh}
                  className="w-full"
                  size="sm"
                >
                  Refresh Page
                </Button>
                <Button 
                  variant="ghost"
                  onClick={this.handleGoHome}
                  className="w-full"
                  size="sm"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Show Error Details (Development Only)
                  </summary>
                  <div className="mt-3 p-3 bg-muted rounded-md">
                    <div className="text-xs font-mono">
                      <div className="font-semibold text-destructive mb-2">
                        {this.state.error.name}: {this.state.error.message}
                      </div>
                      {this.state.error.stack && (
                        <pre className="whitespace-pre-wrap text-muted-foreground text-xs overflow-auto max-h-40">
                          {this.state.error.stack}
                        </pre>
                      )}
                      {this.state.errorInfo?.componentStack && (
                        <div className="mt-3">
                          <div className="font-semibold mb-1">Component Stack:</div>
                          <pre className="whitespace-pre-wrap text-muted-foreground text-xs overflow-auto max-h-32">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}