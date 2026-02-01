'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function TasksError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report the error to Sentry with additional context
    Sentry.captureException(error, {
      tags: {
        module: 'tasks',
      },
    });
    // Log to console for debugging
    console.error('[Tasks Module Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-xl font-headline text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Unable to Load Tasks
          </CardTitle>
          <CardDescription>
            There was a problem loading the tasks module.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This could be due to a temporary connection issue. Please try again.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
          <Button onClick={() => reset()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
