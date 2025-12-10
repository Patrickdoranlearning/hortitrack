'use client';

import { useState } from 'react';
import InvoiceCard from '@/components/sales/InvoiceCard';
import InvoiceDetailDialog from '@/components/sales/InvoiceDetailDialog';

export interface InvoiceWithCustomer {
  id: string;
  org_id: string;
  customer_id: string;
  order_id: string | null;
  invoice_number: string;
  currency: string;
  issue_date: string;
  due_date: string | null;
  status: string;
  notes: string | null;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  amount_credited: number;
  balance_due: number;
  created_at: string;
  updated_at: string;
  customer?: {
    name: string;
    email: string | null;
  } | null;
}

interface InvoicesClientProps {
  initialInvoices: InvoiceWithCustomer[];
}

export default function InvoicesClient({ initialInvoices }: InvoicesClientProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithCustomer | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpenInvoice = (invoice: InvoiceWithCustomer) => {
    setSelectedInvoice(invoice);
    setIsDialogOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {initialInvoices.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No invoices found. Generate an invoice from an order to get started.
          </div>
        ) : (
          initialInvoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              onOpen={() => handleOpenInvoice(invoice)}
            />
          ))
        )}
      </div>

      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}



