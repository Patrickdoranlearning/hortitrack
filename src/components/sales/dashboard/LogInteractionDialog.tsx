'use client';

import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { emitMutation } from '@/lib/events/mutation-events';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { logInteraction } from '@/app/sales/actions';
import { createFollowUpAction } from '@/app/sales/customers/actions';
import { toast } from '@/lib/toast';
import { Phone, Mail, MapPin, MessageCircle, MoreHorizontal, ChevronDown, CalendarClock } from 'lucide-react';

interface LogInteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}

const INTERACTION_TYPES = [
  { value: 'call', label: 'Phone Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'visit', label: 'Site Visit', icon: MapPin },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
] as const;

const OUTCOMES = [
  { value: 'order_placed', label: 'Order Placed' },
  { value: 'will_order_later', label: 'Will Order Later' },
  { value: 'fully_stocked', label: 'Fully Stocked' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'left_voicemail', label: 'Left Voicemail' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'follow_up_needed', label: 'Follow Up Needed' },
  { value: 'other', label: 'Other' },
];

export function LogInteractionDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
}: LogInteractionDialogProps) {
  const [type, setType] = useState<'call' | 'email' | 'visit' | 'whatsapp' | 'other'>('call');
  const [outcome, setOutcome] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Follow-up state
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [followUpTitle, setFollowUpTitle] = useState('');

  // Auto-enable follow-up when outcome is "follow_up_needed"
  const handleOutcomeChange = (value: string) => {
    setOutcome(value);
    if (value === 'follow_up_needed' && !scheduleFollowUp) {
      setScheduleFollowUp(true);
    }
  };

  // Generate default follow-up title from notes
  const generateFollowUpTitle = () => {
    if (followUpTitle) return followUpTitle;
    const preview = notes.trim().slice(0, 50);
    return preview ? `Follow up: ${preview}${notes.length > 50 ? '...' : ''}` : 'Follow up with customer';
  };

  const resetForm = () => {
    setType('call');
    setOutcome('');
    setNotes('');
    setScheduleFollowUp(false);
    setFollowUpDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    setFollowUpTitle('');
  };

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error('Please add some notes about the interaction');
      return;
    }

    if (scheduleFollowUp && !followUpDate) {
      toast.error('Please select a follow-up date');
      return;
    }

    setIsSubmitting(true);
    try {
      // Log the interaction first
      const result = await logInteraction(customerId, type, notes, outcome || undefined);
      if (result.error) {
        toast.error(result.error);
        setIsSubmitting(false);
        return;
      }

      // Create follow-up if scheduled
      if (scheduleFollowUp) {
        const followUpResult = await createFollowUpAction({
          customerId,
          dueDate: followUpDate,
          title: generateFollowUpTitle(),
          description: notes.trim(),
          sourceInteractionId: result.interaction?.id || null,
        });

        if (followUpResult.error) {
          toast.error(`Interaction logged, but failed to create follow-up: ${followUpResult.error}`);
        } else {
          toast.success('Interaction logged and follow-up scheduled');
          if (followUpResult._mutated) {
            emitMutation(followUpResult._mutated);
          }
        }
      } else {
        toast.success('Interaction logged successfully');
      }

      // Emit mutation event for cache invalidation
      if (result._mutated) {
        emitMutation(result._mutated);
      }

      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to log interaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Interaction</DialogTitle>
          <DialogDescription>
            Record your contact with {customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Interaction Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-2">
              {INTERACTION_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.value;
                return (
                  <Button
                    key={t.value}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setType(t.value)}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Outcome */}
          <div className="space-y-2">
            <Label>Outcome</Label>
            <Select value={outcome} onValueChange={handleOutcomeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select outcome..." />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="What did you discuss? Any follow-up needed?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Schedule Follow-Up Section */}
          <Collapsible open={scheduleFollowUp} onOpenChange={setScheduleFollowUp}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Schedule Follow-Up</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={scheduleFollowUp}
                    onCheckedChange={setScheduleFollowUp}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${scheduleFollowUp ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="followUpDate">Due Date</Label>
                <Input
                  id="followUpDate"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="followUpTitle">Title (optional)</Label>
                <Input
                  id="followUpTitle"
                  placeholder={generateFollowUpTitle()}
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to auto-generate from notes
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !notes.trim()}>
            {isSubmitting ? 'Saving...' : scheduleFollowUp ? 'Save & Schedule' : 'Save Interaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LogInteractionDialog;
