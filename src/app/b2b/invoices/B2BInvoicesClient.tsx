'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  amount_credited: number | null;
  balance_due: number | null;
  notes: string | null;
  created_at: string;
  order_id: string | null;
  orders: { order_number: string } | null;
};

type B2BInvoicesClientProps = {
  invoices: Invoice[];
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  issued: { label: 'Issued', variant: 'secondary' },
  paid: { label: 'Paid', variant: 'default' },
  void: { label: 'Void', variant: 'destructive' },
  overdue: { label: 'Overdue', variant: 'destructive' },
};

export function B2BInvoicesClient({ invoices }: B2BInvoicesClientProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    if (search && !invoice.invoice_number.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all' && invoice.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const handleDownloadPDF = (invoice: Invoice) => {
    // Open PDF in new tab - API will return either invoice or order confirmation
    window.open(`/api/b2b/invoices/${invoice.id}/pdf`, '_blank');
  };

  // Determine what document type will be downloaded
  const getDownloadLabel = (invoice: Invoice) => {
    // If invoice is draft or has no invoice number, it will be an order confirmation
    if (invoice.status === 'draft' || !invoice.invoice_number) {
      return 'Download Order Confirmation';
    }
    return 'Download Invoice';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground">
          View and download your invoices
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by invoice number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {search || statusFilter !== 'all'
                ? 'No invoices found matching your filters.'
                : 'No invoices yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredInvoices.map((invoice) => {
            const statusConfig = STATUS_CONFIG[invoice.status] || { label: invoice.status, variant: 'outline' };

            return (
              <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">
                        {invoice.invoice_number || `Order ${invoice.orders?.order_number || 'Pending'}`}
                      </CardTitle>
                      <CardDescription>
                        {invoice.invoice_number ? (
                          <>
                            Issued on {format(new Date(invoice.issue_date), 'dd/MM/yyyy')}
                            {invoice.due_date && (
                              <> • Due {format(new Date(invoice.due_date), 'dd/MM/yyyy')}</>
                            )}
                          </>
                        ) : (
                          <>
                            Order placed {format(new Date(invoice.created_at), 'dd/MM/yyyy')}
                            {invoice.orders?.order_number && (
                              <> • Ref: {invoice.orders.order_number}</>
                            )}
                          </>
                        )}
                      </CardDescription>
                    </div>
                    <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Subtotal (ex VAT)</p>
                      <p className="font-medium">€{invoice.subtotal_ex_vat.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">VAT</p>
                      <p className="font-medium">€{invoice.vat_amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total (inc VAT)</p>
                      <p className="font-medium text-lg">€{invoice.total_inc_vat.toFixed(2)}</p>
                    </div>
                  </div>

                  {invoice.notes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">Notes</p>
                      <p className="text-sm">{invoice.notes}</p>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleDownloadPDF(invoice)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {getDownloadLabel(invoice)}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
