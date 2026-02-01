"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary for Worker App
 *
 * Catches JavaScript errors in the component tree and displays
 * a user-friendly error screen with recovery options.
 */
export class WorkerErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development, would send to monitoring in prod
    console.error("Worker app error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // In production, you would report this to an error tracking service
    // e.g., Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleRefresh = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = "/worker";
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col min-h-screen bg-background">
          <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur safe-area-inset-top">
            <div className="flex h-14 items-center justify-between px-4">
              <h1 className="text-lg font-semibold">HortiTrack Worker</h1>
            </div>
          </header>

          <main className="flex-1 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardContent className="p-6 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>

                <h2 className="text-xl font-semibold mb-2">
                  Something went wrong
                </h2>

                <p className="text-muted-foreground mb-6">
                  An unexpected error occurred. Your work has been saved if you
                  were working offline.
                </p>

                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="text-left text-sm mb-6 p-3 bg-muted rounded-lg overflow-auto max-h-40">
                    <summary className="cursor-pointer font-medium mb-2">
                      Error Details
                    </summary>
                    <pre className="text-xs text-red-600 whitespace-pre-wrap">
                      {this.state.error.message}
                      {"\n\n"}
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={this.handleReset}
                    className="w-full"
                    variant="default"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>

                  <Button
                    onClick={this.handleRefresh}
                    className="w-full"
                    variant="outline"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Page
                  </Button>

                  <Button
                    onClick={this.handleGoHome}
                    className="w-full"
                    variant="ghost"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Go to Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}
