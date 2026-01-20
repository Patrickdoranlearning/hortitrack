'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg text-center">
            <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2 text-2xl font-headline text-destructive">
                    <AlertTriangle />
                    Application Error
                </CardTitle>
                <CardDescription>Something went wrong during rendering.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                    An unexpected client-side exception has occurred. You can try to recover from the error by clicking the button below.
                </p>
                <pre className="mt-4 whitespace-pre-wrap rounded-md bg-muted p-4 text-left text-xs text-muted-foreground">
                    {error.message}
                </pre>
                <Button
                    onClick={() => reset()}
                    className="mt-6"
                >
                    Try again
                </Button>
            </CardContent>
        </Card>
    </div>
  )
}
