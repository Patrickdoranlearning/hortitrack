"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Compact mode for inline error display */
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Component-level error boundary for catching and handling React errors.
 * Use this to wrap complex components like wizards, dialogs, and forms
 * to prevent the entire app from crashing.
 *
 * @example
 * <ErrorBoundary>
 *   <ComplexWizard />
 * </ErrorBoundary>
 *
 * @example
 * <ErrorBoundary compact>
 *   <InlineComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to console in development
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Compact mode for inline display
      if (this.props.compact) {
        return (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Something went wrong</p>
              <p className="text-xs text-muted-foreground truncate">
                {this.state.error?.message || "An unexpected error occurred"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={this.handleReset}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        );
      }

      // Full card display for dialogs/wizards
      return (
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An error occurred while rendering this component. You can try again or refresh the page.
            </p>
            {this.state.error && (
              <pre className="rounded-md bg-muted p-3 text-xs text-muted-foreground overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={this.handleReset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
              <Button variant="ghost" onClick={() => window.location.reload()}>
                Refresh page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-friendly wrapper for error boundary.
 * Wraps children in an error boundary with optional configuration.
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, "children">
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}
