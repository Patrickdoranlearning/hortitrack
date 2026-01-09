'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PickItem {
  id: string;
  sku?: string;
  variety?: string;
  product_name?: string;
  requested_qty: number;
}

interface CreateQCFeedbackDialogProps {
  pickListId: string;
  pickItems?: PickItem[];
  onFeedbackCreated?: () => void;
  trigger?: React.ReactNode;
}

const ISSUE_TYPES = [
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'wrong_qty', label: 'Wrong Quantity' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'missing_label', label: 'Missing Label' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'other', label: 'Other' },
];

const ACTION_OPTIONS = [
  { value: 'repick', label: 'Needs Re-pick' },
  { value: 'relabel', label: 'Needs Re-label' },
  { value: 'accept', label: 'Accept with Note' },
];

export function CreateQCFeedbackDialog({
  pickListId,
  pickItems = [],
  onFeedbackCreated,
  trigger,
}: CreateQCFeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [issueType, setIssueType] = useState<string>('');
  const [actionRequired, setActionRequired] = useState<string>('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!issueType) {
      toast.error('Please select an issue type');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/dispatch/qc/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickListId,
          pickItemId: (selectedItem === '__all__' || !selectedItem) ? undefined : selectedItem,
          issueType,
          notes: notes || undefined,
          actionRequired: actionRequired || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success('Feedback sent to picker');
        setOpen(false);
        resetForm();
        onFeedbackCreated?.();
      } else {
        toast.error(data.error || 'Failed to create feedback');
      }
    } catch (error) {
      console.error('Failed to create feedback:', error);
      toast.error('Failed to create feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedItem('');
    setIssueType('');
    setActionRequired('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Report Issue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Report QC Issue
          </DialogTitle>
          <DialogDescription>
            Create feedback for the picker about this pick list. They will be
            notified immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Optional: Select specific item */}
          {pickItems.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="item">Item (Optional)</Label>
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger id="item">
                  <SelectValue placeholder="Select specific item..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">General (All Items)</SelectItem>
                  {pickItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.variety || item.product_name || item.sku} ×{item.requested_qty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Issue Type */}
          <div className="grid gap-2">
            <Label htmlFor="issueType">Issue Type *</Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger id="issueType">
                <SelectValue placeholder="Select issue type..." />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Required */}
          <div className="grid gap-2">
            <Label htmlFor="action">Action Required</Label>
            <Select value={actionRequired} onValueChange={setActionRequired}>
              <SelectTrigger id="action">
                <SelectValue placeholder="Select action..." />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((action) => (
                  <SelectItem key={action.value} value={action.value}>
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add details about the issue..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Feedback'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
