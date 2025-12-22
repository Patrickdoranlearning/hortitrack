'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Mail, Printer, FileText } from 'lucide-react';
import { useCompanyName } from '@/lib/org/context';
import type { InvoiceWithCustomer } from '@/app/sales/invoices/InvoicesClient';

interface InvoiceDetailDialogProps {
  invoice: InvoiceWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InvoiceDetailDialog({ invoice, open, onOpenChange }: InvoiceDetailDialogProps) {
  const companyName = useCompanyName();

  if (!invoice) return null;

  const customerEmail = invoice.customer?.email;
  const customerName = invoice.customer?.name || 'Customer';

  const handleEmailInvoice = () => {
    const subject = encodeURIComponent(`Invoice ${invoice.invoice_number} from ${companyName}`);
    const body = encodeURIComponent(
      `Dear ${customerName},\n\nPlease find attached invoice ${invoice.invoice_number}.\n\nInvoice Details:\n- Invoice Number: ${invoice.invoice_number}\n- Issue Date: ${invoice.issue_date ? format(new Date(invoice.issue_date), 'PPP') : 'N/A'}\n- Due Date: ${invoice.due_date ? format(new Date(invoice.due_date), 'PPP') : 'N/A'}\n- Total: €${invoice.total_inc_vat.toFixed(2)}\n\nThank you for your business.\n\nKind regards,\n${companyName}`
    );
    const mailto = customerEmail
      ? `mailto:${customerEmail}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
    window.open(mailto, '_blank');
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
              <span>€{invoice.subtotal_ex_vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VAT</span>
              <span>€{invoice.vat_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Total</span>
              <span>€{invoice.total_inc_vat.toFixed(2)}</span>
            </div>
            {invoice.amount_credited > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Amount Credited</span>
                <span>-€{invoice.amount_credited.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Balance Due</span>
              <span>€{invoice.balance_due.toFixed(2)}</span>
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
            <Button onClick={handleEmailInvoice} className="flex-1">
              <Mail className="h-4 w-4 mr-2" />
              Email Invoice
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}




