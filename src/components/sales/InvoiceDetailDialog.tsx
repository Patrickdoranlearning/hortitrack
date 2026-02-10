'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Mail, Printer, FileText, Loader2 } from 'lucide-react';
import { useCompanyName } from '@/lib/org/context';
import { toast } from '@/lib/toast';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';
import type { InvoiceWithCustomer } from '@/app/sales/invoices/InvoicesClient';

interface InvoiceDetailDialogProps {
  invoice: InvoiceWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InvoiceDetailDialog({ invoice, open, onOpenChange }: InvoiceDetailDialogProps) {
  const companyName = useCompanyName();
  const [sendingEmail, setSendingEmail] = useState(false);

  if (!invoice) return null;

  const currency = (invoice.currency as CurrencyCode) || 'EUR';
  const customerEmail = invoice.customer?.email;
  const customerName = invoice.customer?.name || 'Customer';

  const handleEmailInvoice = async () => {
    if (!customerEmail) {
      toast.error('Please add an email address for this customer first.');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await fetch(`/api/sales/invoices/${invoice.id}/send-email`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      toast.success(`Invoice emailed to ${customerEmail}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSendingEmail(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'issued':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="h-5 w-5" />
            Invoice #{invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{customerName}</p>
              {customerEmail && (
                <p className="text-sm text-muted-foreground">{customerEmail}</p>
              )}
            </div>
            <div className="text-right">
              <Badge variant={getStatusVariant(invoice.status)} className="mb-2">
                {invoice.status}
              </Badge>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <p className="text-sm text-muted-foreground">Issue Date</p>
              <p className="font-medium">
                {invoice.issue_date ? format(new Date(invoice.issue_date), 'PPP') : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">
                {invoice.due_date ? format(new Date(invoice.due_date), 'PPP') : 'N/A'}
              </p>
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal (ex VAT)</span>
              <span>{formatCurrency(invoice.subtotal_ex_vat, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VAT</span>
              <span>{formatCurrency(invoice.vat_amount, currency)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Total</span>
              <span>{formatCurrency(invoice.total_inc_vat, currency)}</span>
            </div>
            {invoice.amount_credited > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Amount Credited</span>
                <span>-{formatCurrency(invoice.amount_credited, currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Balance Due</span>
              <span>{formatCurrency(invoice.balance_due, currency)}</span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{invoice.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="border-t pt-4 flex gap-3">
            <Button
              onClick={handleEmailInvoice}
              className="flex-1"
              disabled={sendingEmail || !customerEmail}
            >
              {sendingEmail ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {sendingEmail ? 'Sending...' : 'Email Invoice'}
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
          {!customerEmail && (
            <p className="text-sm text-muted-foreground text-center">
              Add an email address to this customer to enable email sending.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
