
'use client';

import { Card } from '@/components/ui/card';
import { Invoice } from '@/lib/sales/types';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface InvoiceCardProps {
    invoice: Invoice;
    onOpen: () => void;
}

export default function InvoiceCard({ invoice, onOpen }: InvoiceCardProps) {
    return (
        <Card
            className="p-4 flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow"
            onClick={onOpen}
        >
            <div>
                <div className="flex justify-between items-start">
                    <div className="font-bold text-lg">#{invoice.invoice_number}</div>
                    <Badge variant={invoice.status === 'issued' ? 'default' : 'secondary'}>
                        {invoice.status}
                    </Badge>
                </div>
                <div className="text-sm text-muted-foreground">{invoice.customer_id}</div>
                <div className="text-sm text-muted-foreground">
                    €{invoice.total_inc_vat.toFixed(2)}
                </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
                Issued: {invoice.issue_date ? format(new Date(invoice.issue_date), 'PPP') : 'No date'}
            </div>
        </Card>
    );
}
