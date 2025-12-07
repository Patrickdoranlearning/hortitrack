'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Mail } from 'lucide-react';
import type { InvoiceWithCustomer } from '@/app/sales/invoices/InvoicesClient';

interface InvoiceCardProps {
  invoice: InvoiceWithCustomer;
  onOpen: () => void;
}

export default function InvoiceCard({ invoice, onOpen }: InvoiceCardProps) {
  const customerName = invoice.customer?.name || 'Unknown Customer';
  const customerEmail = invoice.customer?.email;

  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const subject = encodeURIComponent(`Invoice ${invoice.invoice_number} from Doran Nurseries`);
    const body = encodeURIComponent(
      `Dear ${customerName},\n\nPlease find attached invoice ${invoice.invoice_number}.\n\nTotal: €${invoice.total_inc_vat.toFixed(2)}\nDue Date: ${invoice.due_date ? format(new Date(invoice.due_date), 'PPP') : 'N/A'}\n\nThank you for your business.\n\nKind regards,\nDoran Nurseries`
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
    <Card
      className="p-4 flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onOpen}
    >
      <div>
        <div className="flex justify-between items-start">
          <div className="font-bold text-lg">#{invoice.invoice_number}</div>
          <Badge variant={getStatusVariant(invoice.status)}>
            {invoice.status}
          </Badge>
        </div>
        <div className="text-sm font-medium mt-1">{customerName}</div>
        <div className="text-xl font-semibold mt-2">
          €{invoice.total_inc_vat.toFixed(2)}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {invoice.issue_date ? format(new Date(invoice.issue_date), 'PPP') : 'No date'}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEmailClick}
          title={customerEmail ? `Email to ${customerEmail}` : 'Email invoice'}
        >
          <Mail className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
