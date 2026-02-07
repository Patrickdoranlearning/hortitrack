import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ErrorStateProps {
  title?: string;
  message: string;
  error?: string; // Technical error details (dev only)
  compact?: boolean;
}

/**
 * Server-side error display component
 * Use this for displaying errors in server components (pages, layouts)
 *
 * For client-side React errors, use ErrorBoundary instead
 *
 * @example
 * // In a server component
 * const { data, error } = await query;
 * if (error) {
 *   return (
 *     <ErrorState
 *       title="Unable to Load Data"
 *       message="We're having trouble loading this page. Please try again."
 *       error={process.env.NODE_ENV === 'development' ? error.message : undefined}
 *     />
 *   );
 * }
 */
export function ErrorState({ title = "Something went wrong", message, error, compact = false }: ErrorStateProps) {
  if (compact) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
        {error && process.env.NODE_ENV === 'development' && (
          <pre className="mt-2 rounded-md bg-destructive/10 p-2 text-xs overflow-auto max-h-32">
            {error}
          </pre>
        )}
      </Alert>
    );
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-destructive">
          <AlertTriangle className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {message}
        </p>
        {error && process.env.NODE_ENV === 'development' && (
          <pre className="rounded-md bg-muted p-3 text-xs text-muted-foreground overflow-auto max-h-32">
            {error}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
