'use client';

import { useState, useEffect, useTransition } from 'react';
import { format, parseISO, differenceInDays, isToday } from 'date-fns';
import { Calendar, Gift, Star, FileText, Tag, Plus, Repeat, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getUpcomingMilestonesAction, deleteMilestoneAction } from '@/app/sales/customers/actions';
import { AddMilestoneDialog } from './AddMilestoneDialog';
import { emitMutation } from '@/lib/events/mutation-events';
import { toast } from 'sonner';
import type { CustomerMilestone, MilestoneType } from '@/app/sales/customers/[customerId]/types';

interface MilestonesCardProps {
  customerId: string;
  initialMilestones?: CustomerMilestone[];
}

const TYPE_CONFIG: Record<MilestoneType, { icon: typeof Calendar; color: string }> = {
  anniversary: { icon: Gift, color: 'text-amber-600' },
  first_order: { icon: Star, color: 'text-green-600' },
  contract_renewal: { icon: FileText, color: 'text-blue-600' },
  seasonal_peak: { icon: Star, color: 'text-purple-600' },
  custom: { icon: Tag, color: 'text-gray-600' },
};

function getDaysUntilBadge(eventDate: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } | null {
  const date = parseISO(eventDate);
  const days = differenceInDays(date, new Date());

  if (isToday(date)) {
    return { label: 'Today!', variant: 'destructive' };
  }

  if (days <= 7 && days > 0) {
    return { label: `In ${days} day${days === 1 ? '' : 's'}`, variant: 'secondary' };
  }

  return null;
}

function MilestoneItem({
  milestone,
  onDelete,
}: {
  milestone: CustomerMilestone;
  onDelete: (id: string) => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const config = TYPE_CONFIG[milestone.milestoneType] || TYPE_CONFIG.custom;
  const Icon = config.icon;
  const badge = getDaysUntilBadge(milestone.eventDate);

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteMilestoneAction(milestone.id);
      if (result.success) {
        toast.success('Milestone deleted');
        if (result._mutated) {
          emitMutation(result._mutated);
        }
        onDelete(milestone.id);
      } else {
        toast.error(result.error || 'Failed to delete milestone');
      }
      setShowDeleteConfirm(false);
    });
  };

  return (
    <>
      <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
        <div className={`flex-shrink-0 mt-0.5 ${config.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{milestone.title}</span>
            {badge && (
              <Badge variant={badge.variant} className="text-xs">
                {badge.label}
              </Badge>
            )}
            {milestone.recurring && (
              <Repeat className="h-3 w-3 text-muted-foreground" title="Recurring annually" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(milestone.eventDate), 'dd MMM yyyy')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{milestone.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function MilestonesCard({ customerId, initialMilestones = [] }: MilestonesCardProps) {
  const [milestones, setMilestones] = useState<CustomerMilestone[]>(initialMilestones);
  const [isLoading, setIsLoading] = useState(initialMilestones.length === 0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    if (initialMilestones.length === 0) {
      loadMilestones();
    }
  }, [customerId, initialMilestones.length]);

  const loadMilestones = async () => {
    setIsLoading(true);
    try {
      const result = await getUpcomingMilestonesAction(customerId, 90);
      if (result.success) {
        setMilestones(result.milestones);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (milestoneId: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
  };

  const handleCreated = () => {
    loadMilestones();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Milestones
              </CardTitle>
              <CardDescription>Next 90 days</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : milestones.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming milestones</p>
              <Button
                variant="link"
                size="sm"
                className="mt-1"
                onClick={() => setAddDialogOpen(true)}
              >
                Add first milestone
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {milestones.map((milestone) => (
                <MilestoneItem
                  key={milestone.id}
                  milestone={milestone}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddMilestoneDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        customerId={customerId}
        onCreated={handleCreated}
      />
    </>
  );
}

export default MilestonesCard;
