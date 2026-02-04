'use client';

import { useState, useEffect, useTransition } from 'react';
import { format, parseISO, isToday, isPast, isTomorrow, differenceInDays } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCustomerFollowUpsAction, completeFollowUpAction } from '@/app/sales/customers/actions';
import { emitMutation } from '@/lib/events/mutation-events';
import { toast } from 'sonner';
import type { CustomerFollowUp } from '@/app/sales/customers/[customerId]/types';

interface FollowUpBannerProps {
  customerId: string;
  initialFollowUps?: CustomerFollowUp[];
}

function getDueDateStatus(dueDate: string): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; urgent: boolean } {
  const date = parseISO(dueDate);

  if (isPast(date) && !isToday(date)) {
    const daysOverdue = differenceInDays(new Date(), date);
    return {
      label: daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`,
      variant: 'destructive',
      urgent: true,
    };
  }

  if (isToday(date)) {
    return { label: 'Due today', variant: 'destructive', urgent: true };
  }

  if (isTomorrow(date)) {
    return { label: 'Due tomorrow', variant: 'secondary', urgent: false };
  }

  const daysUntil = differenceInDays(date, new Date());
  if (daysUntil <= 7) {
    return { label: `Due in ${daysUntil} days`, variant: 'secondary', urgent: false };
  }

  return { label: format(date, 'dd MMM'), variant: 'outline', urgent: false };
}

function FollowUpItem({
  followUp,
  onComplete
}: {
  followUp: CustomerFollowUp;
  onComplete: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const status = getDueDateStatus(followUp.dueDate);

  const handleComplete = () => {
    startTransition(async () => {
      const result = await completeFollowUpAction(followUp.id);
      if (result.success) {
        toast.success('Follow-up completed');
        if (result._mutated) {
          emitMutation(result._mutated);
        }
        onComplete(followUp.id);
      } else {
        toast.error(result.error || 'Failed to complete follow-up');
      }
    });
  };

  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
      status.urgent ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/30'
    }`}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {status.urgent ? (
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        ) : (
          <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{followUp.title}</span>
            <Badge variant={status.variant} className="text-xs">
              {status.label}
            </Badge>
          </div>
          {followUp.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {followUp.description}
            </p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleComplete}
        disabled={isPending}
        className="flex-shrink-0"
      >
        {isPending ? (
          <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Done
          </>
        )}
      </Button>
    </div>
  );
}

export function FollowUpBanner({ customerId, initialFollowUps = [] }: FollowUpBannerProps) {
  const [followUps, setFollowUps] = useState<CustomerFollowUp[]>(initialFollowUps);
  const [isLoading, setIsLoading] = useState(initialFollowUps.length === 0);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (initialFollowUps.length === 0) {
      loadFollowUps();
    }
  }, [customerId, initialFollowUps.length]);

  const loadFollowUps = async () => {
    setIsLoading(true);
    try {
      const result = await getCustomerFollowUpsAction(customerId, false);
      if (result.success) {
        setFollowUps(result.followUps);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = (followUpId: string) => {
    setFollowUps((prev) => prev.filter((f) => f.id !== followUpId));
  };

  // Don't render if no follow-ups
  if (!isLoading && followUps.length === 0) {
    return null;
  }

  // Count urgent items
  const urgentCount = followUps.filter((f) => getDueDateStatus(f.dueDate).urgent).length;

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm text-muted-foreground">Loading follow-ups...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={urgentCount > 0 ? 'border-destructive/50' : ''}>
      <CardContent className="py-3">
        {/* Header */}
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            {urgentCount > 0 ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-medium">
              {followUps.length} Pending Follow-Up{followUps.length !== 1 ? 's' : ''}
            </span>
            {urgentCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {urgentCount} overdue
              </Badge>
            )}
          </div>
          <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>

        {/* Expanded list */}
        {isExpanded && (
          <div className="mt-3 space-y-2">
            {followUps.map((followUp) => (
              <FollowUpItem
                key={followUp.id}
                followUp={followUp}
                onComplete={handleComplete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FollowUpBanner;
