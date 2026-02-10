'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
import { toast } from '@/lib/toast';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Package,
  User,
  Calendar,
  Phone,
  MapPin,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { submitQCCheck, rejectForRepick } from '../actions';
import type { QCOrderDetails, QCPickItem } from './page';
import QCChecklist from '@/components/dispatch/QCChecklist';
import QCItemCard from '@/components/dispatch/QCItemCard';
import { CreateQCFeedbackDialog } from '@/components/dispatch/manager/CreateQCFeedbackDialog';

interface QCReviewClientProps {
  order: QCOrderDetails;
  userId: string;
}

export interface QCChecklistState {
  qtyCorrect: boolean;
  varietyCorrect: boolean;
  qualityAcceptable: boolean;
  sizeCorrect: boolean;
  labellingOk: boolean;
}

export interface ItemIssue {
  itemId: string;
  issue: string;
  notes: string;
}

export default function QCReviewClient({ order, userId }: QCReviewClientProps) {
  const router = useRouter();

  const [checklist, setChecklist] = useState<QCChecklistState>({
    qtyCorrect: false,
    varietyCorrect: false,
    qualityAcceptable: false,
    sizeCorrect: false,
    labellingOk: false,
  });
  
  const [itemIssues, setItemIssues] = useState<ItemIssue[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const allChecked = Object.values(checklist).every(Boolean);
  const hasIssues = itemIssues.length > 0;

  const handleChecklistChange = (key: keyof QCChecklistState, value: boolean) => {
    setChecklist(prev => ({ ...prev, [key]: value }));
  };

  const handleItemIssue = (itemId: string, issue: string, notes: string) => {
    setItemIssues(prev => {
      const existing = prev.findIndex(i => i.itemId === itemId);
      if (existing >= 0) {
        if (!issue && !notes) {
          // Remove issue if cleared
          return prev.filter(i => i.itemId !== itemId);
        }
        const updated = [...prev];
        updated[existing] = { itemId, issue, notes };
        return updated;
      }
      if (issue || notes) {
        return [...prev, { itemId, issue, notes }];
      }
      return prev;
    });
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const result = await submitQCCheck({
        pickListId: order.pickListId,
        orderId: order.orderId,
        checklist,
        passed: true,
        failedItems: [],
        failureReason: null,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Order ${order.orderNumber} has passed QC and is ready for dispatch.`);
        router.push('/dispatch/qc');
      }
    } catch (error) {
      toast.error('Failed to submit QC approval');
    } finally {
      setIsSubmitting(false);
      setShowApproveDialog(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim() && itemIssues.length === 0) {
      toast.error('Please provide a reason or mark specific item issues');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await rejectForRepick({
        pickListId: order.pickListId,
        orderId: order.orderId,
        failedItems: itemIssues,
        failureReason: rejectReason,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Order ${order.orderNumber} has been returned to the picking queue.`);
        router.push('/dispatch/qc');
      }
    } catch (error) {
      toast.error('Failed to reject and return for re-pick');
    } finally {
      setIsSubmitting(false);
      setShowRejectDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dispatch/qc">
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back to Queue</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold truncate">QC Review: {order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Verify all items before approving for dispatch
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm sm:text-lg px-3 sm:px-4 py-1 sm:py-2 self-start sm:self-auto">
          {order.items.length} Items • {order.items.reduce((sum, i) => sum + i.pickedQty, 0)} Units
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order Info & Checklist */}
        <div className="space-y-6">
          {/* Order Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{order.customerName}</p>
                  {order.customerPhone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {order.customerPhone}
                    </p>
                  )}
                </div>
              </div>
              
              {order.deliveryDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Delivery Date</p>
                    <p className="font-medium">{format(new Date(order.deliveryDate), 'PPP')}</p>
                  </div>
                </div>
              )}

              {order.pickerName && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Picked By</p>
                    <p className="font-medium">{order.pickerName}</p>
                    {order.pickCompletedAt && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.pickCompletedAt), 'PPp')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {order.notes && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QC Checklist Card */}
          <QCChecklist
            checklist={checklist}
            onChange={handleChecklistChange}
          />

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Button
                className="w-full gap-2"
                size="lg"
                disabled={!allChecked || hasIssues || isSubmitting}
                onClick={() => setShowApproveDialog(true)}
              >
                <CheckCircle2 className="h-5 w-5" />
                Approve & Ready for Dispatch
              </Button>
              
              <Button
                variant="destructive"
                className="w-full gap-2"
                size="lg"
                disabled={isSubmitting}
                onClick={() => setShowRejectDialog(true)}
              >
                <XCircle className="h-5 w-5" />
                Reject & Return for Re-pick
              </Button>

              <Separator className="my-2" />

              {/* Send feedback to picker without rejecting */}
              <CreateQCFeedbackDialog
                pickListId={order.pickListId}
                pickItems={order.items.map(item => ({
                  id: item.id,
                  sku: item.sku,
                  variety: item.variety,
                  product_name: item.productName,
                  requested_qty: item.requestedQty,
                }))}
                trigger={
                  <Button variant="outline" className="w-full gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Send Feedback to Picker
                  </Button>
                }
              />

              {hasIssues && (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {itemIssues.length} item{itemIssues.length > 1 ? 's' : ''} flagged with issues
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Items List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Picked Items</CardTitle>
              <CardDescription>
                Review each item and flag any issues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item) => (
                <QCItemCard
                  key={item.id}
                  item={item}
                  issue={itemIssues.find(i => i.itemId === item.id)}
                  onIssueChange={(issue, notes) => handleItemIssue(item.id, issue, notes)}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Order for Dispatch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark order {order.orderNumber} as QC passed and ready for dispatch.
              Make sure you have physically verified all items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve for Dispatch'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return Order for Re-pick?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send order {order.orderNumber} back to the picking queue for corrections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">Reason for rejection (optional if items flagged)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Describe what needs to be corrected..."
              className="mt-2"
              rows={3}
            />
            {itemIssues.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {itemIssues.length} item{itemIssues.length > 1 ? 's' : ''} flagged with specific issues
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Return for Re-pick'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}







