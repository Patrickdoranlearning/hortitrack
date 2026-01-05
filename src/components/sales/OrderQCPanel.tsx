'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, Plus, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { addQCNote } from '@/app/sales/orders/[orderId]/actions';

interface OrderQCPanelProps {
  orderId: string;
}

const ISSUE_TYPES = [
  { value: 'quality', label: 'Quality Issue' },
  { value: 'quantity', label: 'Quantity Discrepancy' },
  { value: 'damage', label: 'Damage' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'packaging', label: 'Packaging Issue' },
  { value: 'other', label: 'Other' },
];

const SEVERITIES = [
  { value: 'low', label: 'Low', icon: CheckCircle2, color: 'text-green-500' },
  { value: 'medium', label: 'Medium', icon: AlertTriangle, color: 'text-yellow-500' },
  { value: 'high', label: 'High', icon: XCircle, color: 'text-red-500' },
];

export default function OrderQCPanel({ orderId }: OrderQCPanelProps) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issueType, setIssueType] = useState<string>('');
  const [severity, setSeverity] = useState<string>('low');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!issueType || !description.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addQCNote(orderId, {
        issue_type: issueType,
        description: description.trim(),
        severity,
      });

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'QC Note Added',
          description: 'Quality control note has been recorded',
        });
        // Reset form
        setIssueType('');
        setSeverity('low');
        setDescription('');
        setIsAdding(false);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add QC note',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Add QC Note */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Quality Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isAdding ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="issueType">Issue Type *</Label>
                <Select value={issueType} onValueChange={setIssueType}>
                  <SelectTrigger id="issueType">
                    <SelectValue placeholder="Select issue type" />
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

              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger id="severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((sev) => {
                      const Icon = sev.icon;
                      return (
                        <SelectItem key={sev.value} value={sev.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${sev.color}`} />
                            {sev.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Add Note'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAdding(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Record any quality control issues or notes for this order
              </p>
              <Button onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add QC Note
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QC Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>QC Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Visual Inspection</p>
                <p className="text-sm text-muted-foreground">
                  Check for any visible damage, wilting, or disease
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Quantity Verification</p>
                <p className="text-sm text-muted-foreground">
                  Confirm all items match the order quantities
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Variety Check</p>
                <p className="text-sm text-muted-foreground">
                  Verify correct plant varieties are being shipped
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Packaging</p>
                <p className="text-sm text-muted-foreground">
                  Ensure proper packaging for transport
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Labeling</p>
                <p className="text-sm text-muted-foreground">
                  Check all items are properly labeled
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}





