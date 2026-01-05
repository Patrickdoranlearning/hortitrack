'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { logInteraction } from '@/app/sales/actions';
import { toast } from 'sonner';
import { Phone, Mail, MapPin, MessageCircle, MoreHorizontal } from 'lucide-react';

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
  const router = useRouter();
  const [type, setType] = useState<'call' | 'email' | 'visit' | 'whatsapp' | 'other'>('call');
  const [outcome, setOutcome] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error('Please add some notes about the interaction');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await logInteraction(customerId, type, notes, outcome || undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Interaction logged successfully');
        // Reset form
        setType('call');
        setOutcome('');
        setNotes('');
        onOpenChange(false);
        router.refresh();
      }
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
            <Select value={outcome} onValueChange={setOutcome}>
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !notes.trim()}>
            {isSubmitting ? 'Saving...' : 'Save Interaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LogInteractionDialog;


