'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getCareRecommendationsAction } from '@/app/actions';
import type { Batch } from '@/lib/types';
import type { CareRecommendationsOutput } from '@/ai/flows/care-recommendations';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CareRecommendationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
}

export function CareRecommendationsDialog({
  open,
  onOpenChange,
  batch,
}: CareRecommendationsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] =
    useState<CareRecommendationsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && batch) {
      setLoading(true);
      setError(null);
      setRecommendations(null);

      const fetchRecommendations = async () => {
        const result = await getCareRecommendationsAction(batch);
        if (result.success) {
          setRecommendations(result.data);
        } else {
          setError(result.error);
          toast({
            variant: "destructive",
            title: "AI Error",
            description: result.error,
          });
        }
        setLoading(false);
      };

      fetchRecommendations();
    }
  }, [open, batch, toast]);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
        // Reset state on close
        setRecommendations(null);
        setError(null);
        setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline text-2xl">
            <Sparkles className="text-primary" />
            AI Care for {batch?.plantFamily} - {batch?.plantVariety}
          </DialogTitle>
          <DialogDescription>
            AI-powered recommendations based on batch info and local conditions.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loading && <RecommendationsSkeleton />}
          {error && <ErrorAlert message={error} />}
          {recommendations && <RecommendationsList recommendations={recommendations.careActivities} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecommendationsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-5/6" />
      <Skeleton className="h-5 w-4/5" />
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function RecommendationsList({ recommendations }: { recommendations: string[] }) {
    return (
        <ul className="space-y-3">
            {recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                    <span>{rec}</span>
                </li>
            ))}
        </ul>
    )
}
