'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createMilestoneAction } from '@/app/sales/customers/actions';
import { emitMutation } from '@/lib/events/mutation-events';
import { toast } from 'sonner';
import { Calendar, Gift, Star, Repeat, FileText, Tag } from 'lucide-react';
import type { MilestoneType } from '@/app/sales/customers/[customerId]/types';

interface AddMilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  onCreated?: () => void;
}

const MILESTONE_TYPES: Array<{
  value: MilestoneType;
  label: string;
  icon: typeof Calendar;
  defaultTitle: string;
  defaultRecurring: boolean;
}> = [
  {
    value: 'anniversary',
    label: 'Anniversary',
    icon: Gift,
    defaultTitle: 'Customer Anniversary',
    defaultRecurring: true,
  },
  {
    value: 'contract_renewal',
    label: 'Contract Renewal',
    icon: FileText,
    defaultTitle: 'Contract Renewal',
    defaultRecurring: true,
  },
  {
    value: 'seasonal_peak',
    label: 'Seasonal Peak',
    icon: Star,
    defaultTitle: 'Seasonal Peak Order Period',
    defaultRecurring: true,
  },
  {
    value: 'custom',
    label: 'Custom',
    icon: Tag,
    defaultTitle: '',
    defaultRecurring: false,
  },
];

export function AddMilestoneDialog({
  open,
  onOpenChange,
  customerId,
  onCreated,
}: AddMilestoneDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [milestoneType, setMilestoneType] = useState<MilestoneType>('custom');
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [recurring, setRecurring] = useState(false);

  const selectedTypeConfig = MILESTONE_TYPES.find((t) => t.value === milestoneType);

  const handleTypeChange = (value: MilestoneType) => {
    setMilestoneType(value);
    const config = MILESTONE_TYPES.find((t) => t.value === value);
    if (config) {
      // Auto-fill title if empty or was previously auto-filled
      if (!title || MILESTONE_TYPES.some((t) => t.defaultTitle === title)) {
        setTitle(config.defaultTitle);
      }
      setRecurring(config.defaultRecurring);
    }
  };

  const resetForm = () => {
    setMilestoneType('custom');
    setTitle('');
    setEventDate(format(new Date(), 'yyyy-MM-dd'));
    setDescription('');
    setRecurring(false);
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!eventDate) {
      toast.error('Please select a date');
      return;
    }

    startTransition(async () => {
      const result = await createMilestoneAction({
        customerId,
        milestoneType,
        title: title.trim(),
        eventDate,
        description: description.trim() || null,
        recurring,
      });

      if (result.success) {
        toast.success('Milestone created');
        if (result._mutated) {
          emitMutation(result._mutated);
        }
        resetForm();
        onOpenChange(false);
        onCreated?.();
      } else {
        toast.error(result.error || 'Failed to create milestone');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Milestone</DialogTitle>
          <DialogDescription>
            Track important dates and events for this customer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Milestone Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={milestoneType} onValueChange={(v) => handleTypeChange(v as MilestoneType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {MILESTONE_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="milestoneTitle">Title</Label>
            <Input
              id="milestoneTitle"
              placeholder={selectedTypeConfig?.defaultTitle || 'Enter milestone title'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="eventDate">Date</Label>
            <Input
              id="eventDate"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="milestoneDescription">Description (optional)</Label>
            <Textarea
              id="milestoneDescription"
              placeholder="Add notes about this milestone..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="recurring"
              checked={recurring}
              onCheckedChange={(checked) => setRecurring(checked === true)}
            />
            <Label htmlFor="recurring" className="flex items-center gap-2 cursor-pointer">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              Recurring annually
            </Label>
          </div>
          <p className="text-xs text-muted-foreground -mt-2 ml-6">
            Show this milestone every year on the same date
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()}>
            {isPending ? 'Creating...' : 'Create Milestone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddMilestoneDialog;
