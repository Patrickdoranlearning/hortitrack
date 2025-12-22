'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  FileText, 
  Send,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { createCreditNoteAction, issueCreditNoteAction } from '@/app/sales/credit-notes/actions';
import type { OrderItem } from './OrderDetailPage';

interface CreditNoteWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  customerId: string;
  customerName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  orderItems: OrderItem[];
  onCreditNoteCreated: () => void;
}

interface CreditLineItem {
  orderItemId: string;
  skuId: string | null;
  selected: boolean;
  quantity: number;
  maxQuantity: number;
  unitPrice: number;
  vatRate: number;
  description: string;
}

type WizardStep = 'items' | 'review' | 'complete';

const CREDIT_REASONS = [
  { value: 'damaged', label: 'Damaged Goods' },
  { value: 'incorrect', label: 'Incorrect Items Sent' },
  { value: 'quality', label: 'Quality Issue' },
  { value: 'short', label: 'Short Delivery' },
  { value: 'cancelled', label: 'Order Cancelled' },
  { value: 'pricing', label: 'Pricing Error' },
  { value: 'other', label: 'Other' },
];

export default function CreditNoteWizard({
  open,
  onOpenChange,
  orderId,
  customerId,
  customerName,
  invoiceId,
  invoiceNumber,
  orderItems,
  onCreditNoteCreated,
}: CreditNoteWizardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>('items');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCreditNoteId, setCreatedCreditNoteId] = useState<string | null>(null);
  const [createdCreditNumber, setCreatedCreditNumber] = useState<string | null>(null);
  
  // Form state
  const [reasonType, setReasonType] = useState('');
  const [notes, setNotes] = useState('');
  const [issueImmediately, setIssueImmediately] = useState(true);
  
  const [creditItems, setCreditItems] = useState<CreditLineItem[]>(() =>
    orderItems.map((item) => ({
      orderItemId: item.id,
      skuId: item.sku_id,
      selected: false,
      quantity: item.quantity,
      maxQuantity: item.quantity,
      unitPrice: item.unit_price_ex_vat,
      vatRate: item.vat_rate,
      description: getItemDescription(item),
    }))
  );

  function getItemDescription(item: OrderItem): string {
    if (item.product?.name) return item.product.name;
    if (item.description) return item.description;
    const variety = item.sku?.plant_varieties?.name || '';
    const size = item.sku?.plant_sizes?.name || '';
    return `${variety} ${size}`.trim() || 'Product';
  }

  const handleToggleItem = (index: number) => {
    setCreditItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    setCreditItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantity: Math.max(0, Math.min(quantity, item.maxQuantity)) }
          : item
      )
    );
  };

  const selectedItems = useMemo(() => 
    creditItems.filter((item) => item.selected && item.quantity > 0),
    [creditItems]
  );

  const totals = useMemo(() => {
    const subtotal = selectedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice, 
      0
    );
    const vat = selectedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice * (item.vatRate / 100), 
      0
    );
    return {
      subtotal,
      vat,
      total: subtotal + vat,
    };
  }, [selectedItems]);

  const canProceedFromItems = selectedItems.length > 0;
  const canProceedFromReview = reasonType !== '' && (reasonType !== 'other' || notes.trim() !== '');

  const handleNext = () => {
    if (step === 'items' && canProceedFromItems) {
      setStep('review');
    }
  };

  const handleBack = () => {
    if (step === 'review') {
      setStep('items');
    }
  };

  const handleSubmit = async () => {
    if (!canProceedFromReview) return;

    setIsSubmitting(true);
    try {
      // Build the reason text
      const reasonLabel = CREDIT_REASONS.find(r => r.value === reasonType)?.label || reasonType;
      const fullNotes = notes.trim() 
        ? `${reasonLabel}: ${notes.trim()}`
        : reasonLabel;

      // Create the credit note
      const result = await createCreditNoteAction({
        customerId,
        invoiceId,
        notes: fullNotes,
        items: selectedItems.map(item => ({
          skuId: item.skuId,
          description: item.description,
          quantity: item.quantity,
          unitPriceExVat: item.unitPrice,
          vatRate: item.vatRate,
        })),
      });

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      setCreatedCreditNoteId(result.creditNoteId!);
      setCreatedCreditNumber(result.creditNumber!);

      // If issue immediately is checked, issue the credit note
      if (issueImmediately && result.creditNoteId) {
        const issueResult = await issueCreditNoteAction(result.creditNoteId);
        if (issueResult.error) {
          toast({
            title: 'Warning',
            description: `Credit note created but could not be issued: ${issueResult.error}`,
            variant: 'destructive',
          });
        }
      }

      setStep('complete');
      toast({
        title: 'Credit Note Created',
        description: `Credit note ${result.creditNumber} for €${totals.total.toFixed(2)} has been created`,
      });
      onCreditNoteCreated();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create credit note',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setStep('items');
    setReasonType('');
    setNotes('');
    setIssueImmediately(true);
    setCreatedCreditNoteId(null);
    setCreatedCreditNumber(null);
    setCreditItems(
      orderItems.map((item) => ({
        orderItemId: item.id,
        skuId: item.sku_id,
        selected: false,
        quantity: item.quantity,
        maxQuantity: item.quantity,
        unitPrice: item.unit_price_ex_vat,
        vatRate: item.vat_rate,
        description: getItemDescription(item),
      }))
    );
    onOpenChange(false);
  };

  const handleViewCreditNote = () => {
    if (createdCreditNoteId) {
      router.push(`/sales/credit-notes/${createdCreditNoteId}`);
    }
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Credit Note
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4 border-b">
          {(['items', 'review', 'complete'] as WizardStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s 
                    ? 'bg-primary text-primary-foreground' 
                    : step === 'complete' || (step === 'review' && s === 'items')
                    ? 'bg-green-100 text-green-700'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step === 'complete' || (step === 'review' && s === 'items') ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-sm ${step === s ? 'font-medium' : 'text-muted-foreground'}`}>
                {s === 'items' ? 'Select Items' : s === 'review' ? 'Review' : 'Complete'}
              </span>
              {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="py-4">
          {/* Step 1: Select Items */}
          {step === 'items' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Select Items to Credit</h3>
                  <p className="text-sm text-muted-foreground">
                    Customer: {customerName}
                    {invoiceNumber && ` • Invoice: ${invoiceNumber}`}
                  </p>
                </div>
                <Badge variant="outline">
                  {selectedItems.length} of {orderItems.length} selected
                </Badge>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Credit</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-[100px] text-right">Qty</TableHead>
                      <TableHead className="w-[100px] text-right">Price</TableHead>
                      <TableHead className="w-[80px] text-right">VAT</TableHead>
                      <TableHead className="w-[100px] text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item, index) => {
                      const creditItem = creditItems[index];
                      const lineTotal = creditItem.selected 
                        ? creditItem.quantity * creditItem.unitPrice * (1 + creditItem.vatRate / 100)
                        : 0;
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={creditItem.selected}
                              onCheckedChange={() => handleToggleItem(index)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {creditItem.description}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="1"
                              max={creditItem.maxQuantity}
                              value={creditItem.quantity}
                              onChange={(e) =>
                                handleQuantityChange(index, parseInt(e.target.value) || 0)
                              }
                              disabled={!creditItem.selected}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            €{creditItem.unitPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {creditItem.vatRate}%
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {creditItem.selected ? `€${lineTotal.toFixed(2)}` : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Running Total */}
              <Card className="bg-muted/50">
                <CardContent className="py-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Credit Total:</span>
                    <span className="text-2xl font-bold">€{totals.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>Subtotal: €{totals.subtotal.toFixed(2)}</span>
                    <span>VAT: €{totals.vat.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              {/* Reason Selection */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Credit *</Label>
                <Select value={reasonType} onValueChange={setReasonType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDIT_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">
                  Additional Notes {reasonType === 'other' && '*'}
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional details..."
                  rows={3}
                />
              </div>

              {/* Summary */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Credit Note Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span>{customerName}</span>
                  </div>
                  {invoiceNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Original Invoice:</span>
                      <span>{invoiceNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span>{selectedItems.length} line(s)</span>
                  </div>
                </div>
                
                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal (ex VAT):</span>
                    <span>€{totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT:</span>
                    <span>€{totals.vat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg pt-2 border-t">
                    <span>Total Credit:</span>
                    <span className="text-red-600">-€{totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Issue Option */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <Checkbox
                  id="issueImmediately"
                  checked={issueImmediately}
                  onCheckedChange={(checked) => setIssueImmediately(checked as boolean)}
                />
                <div>
                  <Label htmlFor="issueImmediately" className="font-medium cursor-pointer">
                    Issue credit note immediately
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    If unchecked, the credit note will be saved as a draft
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 'complete' && (
            <div className="text-center py-8 space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Credit Note Created</h3>
                <p className="text-muted-foreground mt-1">
                  Credit note <span className="font-mono font-medium">{createdCreditNumber}</span> has been {issueImmediately ? 'created and issued' : 'saved as draft'}
                </p>
              </div>
              
              <Card className="max-w-sm mx-auto">
                <CardContent className="py-4">
                  <div className="text-3xl font-bold text-red-600">
                    -€{totals.total.toFixed(2)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedItems.length} item(s) credited
                  </p>
                </CardContent>
              </Card>

              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button onClick={handleViewCreditNote}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Credit Note
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        {step !== 'complete' && (
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={step === 'items' ? handleClose : handleBack}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {step === 'items' ? 'Cancel' : 'Back'}
            </Button>

            {step === 'items' ? (
              <Button
                onClick={handleNext}
                disabled={!canProceedFromItems}
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceedFromReview || isSubmitting}
                className={issueImmediately ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : issueImmediately ? (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Create & Issue
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Save as Draft
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


