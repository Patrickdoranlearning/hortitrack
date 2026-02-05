'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Beaker, FlaskConical, MapPin, Leaf } from 'lucide-react';
import { toast } from 'sonner';
import type { TaskGroup } from '@/app/actions/ipm-tasks';
import { createJob } from '@/app/actions/ipm-tasks';

type Props = {
  group: TaskGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateJobSheet({ group, open, onOpenChange, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  // Reset form when group changes
  const defaultName = group
    ? group.isTankMix
      ? group.tankMixProducts?.join(' + ')
      : group.productName
    : '';

  const handleCreate = async () => {
    if (!group) return;

    setLoading(true);
    const result = await createJob({
      groupKey: group.groupKey,
      calendarWeek: group.calendarWeek,
      scheduledDate: group.weekStartDate,
      name: name || defaultName,
    });

    if (result.success) {
      toast.success('Job created');
      setName('');
      onCreated();
    } else {
      toast.error(result.error || 'Failed to create job');
    }
    setLoading(false);
  };

  if (!group) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Create Application Job
          </SheetTitle>
          <SheetDescription>
            Create a job from this task group for assignment to an applicator
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Task group summary */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {group.isTankMix ? (
                <Beaker className="h-4 w-4 text-purple-600" />
              ) : (
                <FlaskConical className="h-4 w-4 text-primary" />
              )}
              <span className="font-medium">
                {group.isTankMix ? group.tankMixProducts?.join(' + ') : group.productName}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {group.locations.length} locations
              </span>
              <span className="flex items-center gap-1">
                <Leaf className="h-3 w-3" />
                {group.totalBatches} batches
              </span>
            </div>
            {group.rate && (
              <p className="mt-2 text-sm text-muted-foreground">
                {group.method} @ {group.rate} {group.rateUnit}
              </p>
            )}
          </div>

          {/* Locations preview */}
          <div>
            <Label className="text-sm text-muted-foreground">Locations to spray</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {group.locations.slice(0, 5).map((loc) => (
                <Badge key={loc.id} variant="secondary">
                  {loc.name} ({loc.batchCount})
                </Badge>
              ))}
              {group.locations.length > 5 && (
                <Badge variant="outline">+{group.locations.length - 5} more</Badge>
              )}
            </div>
          </div>

          {/* Job name (optional) */}
          <div className="space-y-2">
            <Label>Job Name (optional)</Label>
            <Input
              placeholder={defaultName}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the product name
            </p>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Job
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
