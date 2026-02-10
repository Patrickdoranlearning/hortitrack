'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface QCFeedbackItem {
  id: string;
  issue_type: string;
  notes?: string;
  action_required?: string;
  created_at: string;
  picker_acknowledged_at?: string;
  pick_lists?: {
    order?: {
      order_number: string;
      customers?: { name: string };
    };
  };
  pick_items?: {
    variety?: string;
  };
  created_by_profile?: { display_name: string };
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  wrong_item: 'Wrong Item',
  wrong_qty: 'Wrong Quantity',
  quality_issue: 'Quality Issue',
  missing_label: 'Missing Label',
  damaged: 'Damaged',
  other: 'Other Issue',
};

const ACTION_LABELS: Record<string, string> = {
  repick: 'Needs Re-pick',
  relabel: 'Needs Re-label',
  accept: 'Accepted with note',
};

export function PickerFeedbackBadge() {
  const [feedback, setFeedback] = useState<QCFeedbackItem[]>([]);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFeedback = async () => {
    try {
      const res = await fetch('/api/dispatch/qc/feedback?unacknowledged=true');
      const data = await res.json();
      if (data.ok) {
        setFeedback(data.feedback || []);
        setUnacknowledgedCount(data.unacknowledgedCount || 0);
      }
    } catch {
      // Feedback fetch failed silently
    } finally {
      setIsLoading(false);
    }
  };

  const acknowledgeFeedback = async (feedbackId: string) => {
    try {
      const res = await fetch(`/api/dispatch/qc/feedback/${feedbackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge' }),
      });
      if (res.ok) {
        fetchFeedback(); // Refresh the list
      }
    } catch {
      // Acknowledge failed silently
    }
  };

  useEffect(() => {
    fetchFeedback();
    // Refresh every 30 seconds
    const interval = setInterval(fetchFeedback, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
        >
          <Bell className={cn(
            'h-5 w-5',
            unacknowledgedCount > 0 && 'text-orange-600'
          )} />
          {unacknowledgedCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-semibold">QC Feedback</h4>
          <p className="text-xs text-muted-foreground">
            {unacknowledgedCount > 0
              ? `${unacknowledgedCount} items need your attention`
              : 'No new feedback'}
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {feedback.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No feedback to display
            </div>
          ) : (
            feedback.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'p-3 border-b last:border-b-0 hover:bg-muted/50',
                  !item.picker_acknowledged_at && 'bg-orange-50'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        #{item.pick_lists?.order?.order_number}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {ISSUE_TYPE_LABELS[item.issue_type] || item.issue_type}
                      </Badge>
                    </div>
                    {item.pick_lists?.order?.customers?.name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {item.pick_lists.order.customers.name}
                      </p>
                    )}
                    {item.pick_items?.variety && (
                      <p className="text-xs text-muted-foreground">
                        Item: {item.pick_items.variety}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs mt-1">{item.notes}</p>
                    )}
                    {item.action_required && (
                      <Badge
                        variant={item.action_required === 'repick' ? 'destructive' : 'secondary'}
                        className="mt-1 text-xs"
                      >
                        {ACTION_LABELS[item.action_required] || item.action_required}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      From: {item.created_by_profile?.display_name || 'Manager'}
                    </p>
                  </div>
                  {!item.picker_acknowledged_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs shrink-0"
                      onClick={() => acknowledgeFeedback(item.id)}
                    >
                      Got it
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
