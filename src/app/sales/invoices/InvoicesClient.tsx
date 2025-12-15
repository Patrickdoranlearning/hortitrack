'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ViewToggle, useViewToggle } from '@/components/ui/view-toggle';
import InvoiceDetailDialog from '@/components/sales/InvoiceDetailDialog';
import {
  MoreHorizontal,
  Printer,
  Mail,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';

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

const STATUS_TABS = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'draft', label: 'Draft', statuses: ['draft'] },
  { id: 'issued', label: 'Issued', statuses: ['issued'] },
  { id: 'paid', label: 'Paid', statuses: ['paid'] },
  { id: 'overdue', label: 'Overdue', statuses: ['overdue'] },
];

const STATUS_STYLES: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  draft: { variant: 'outline', className: 'border-gray-300 text-gray-600' },
  issued: { variant: 'default', className: 'bg-blue-500 hover:bg-blue-600' },
  paid: { variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
  overdue: { variant: 'destructive' },
  void: { variant: 'secondary', className: 'bg-gray-200 text-gray-600' },
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || { variant: 'outline' as const };
  return (
    <Badge variant={style.variant} className={style.className}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function InvoicesClient({ initialInvoices }: InvoicesClientProps) {
  const router = useRouter();
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithCustomer | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const { value: viewMode, setValue: setViewMode } = useViewToggle('sales-invoices-view', 'table');

  const handleOpenInvoice = (invoice: InvoiceWithCustomer) => {
    setSelectedInvoice(invoice);
    setIsDialogOpen(true);
  };

  const handlePrintInvoice = (invoice: InvoiceWithCustomer, e: React.MouseEvent) => {
    e.stopPropagation();
    if (invoice.order_id) {
      router.push(`/sales/orders/${invoice.order_id}/invoice`);
    }
  };

  // Filter invoices based on active tab
  const filteredInvoices = activeTab === 'all'
    ? initialInvoices
    : initialInvoices.filter(inv => {
        const tab = STATUS_TABS.find(t => t.id === activeTab);
        return tab?.statuses?.includes(inv.status);
      });

  // Check if invoice is overdue
  const isOverdue = (invoice: InvoiceWithCustomer) => {
    if (invoice.status === 'paid' || invoice.status === 'void') return false;
    if (!invoice.due_date) return false;
    return new Date(invoice.due_date) < new Date();
  };

  return (
    <>
      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            <div className="text-sm text-muted-foreground mb-4">
              {activeTab === tab.id ? filteredInvoices.length : '...'} invoices
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* View Toggle */}
      <div className="flex justify-end mb-4">
        <ViewToggle
          value={viewMode}
          onChange={setViewMode}
          storageKey="sales-invoices-view"
        />
      </div>

      {/* Invoices - Empty State */}
      {filteredInvoices.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed">
          <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-muted-foreground">
            No invoices found. Generate an invoice from an order to get started.
          </p>
        </div>
      ) : viewMode === 'card' ? (
        /* Card View */
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredInvoices.map((invoice) => {
            const customerName = invoice.customer?.name || 'Unknown Customer';
            const overdue = isOverdue(invoice);

            return (
              <Card
                key={invoice.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleOpenInvoice(invoice)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold">#{invoice.invoice_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(invoice.issue_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <InvoiceStatusBadge status={overdue ? 'overdue' : invoice.status} />
                  </div>

                  <div className="space-y-2">
                    <div className="font-medium truncate" title={customerName}>
                      {customerName}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total: </span>
                        <span className="font-semibold">€{invoice.total_inc_vat.toFixed(2)}</span>
                      </div>
                      <div className="text-sm">
                        {invoice.balance_due > 0 ? (
                          <span className={overdue ? 'text-red-600 font-semibold' : 'font-semibold'}>
                            Due: €{invoice.balance_due.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-green-600 font-semibold">Paid</span>
                        )}
                      </div>
                    </div>

                    {invoice.due_date && (
                      <div className="text-xs text-muted-foreground">
                        Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t">
                    {invoice.order_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={(e) => handlePrintInvoice(invoice, e)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                    {invoice.customer?.email && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Email invoice to', invoice.customer?.email);
                        }}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Issue Date</TableHead>
                <TableHead className="hidden md:table-cell">Due Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Balance</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => {
                const customerName = invoice.customer?.name || 'Unknown Customer';
                const overdue = isOverdue(invoice);

                return (
                  <TableRow
                    key={invoice.id}
                    className="cursor-pointer"
                    onClick={() => handleOpenInvoice(invoice)}
                  >
                    <TableCell>
                      <InvoiceStatusBadge status={overdue ? 'overdue' : invoice.status} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">#{invoice.invoice_number}</div>
                      {invoice.order_id && (
                        <div className="text-xs text-muted-foreground">
                          Order linked
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium truncate max-w-[200px]" title={customerName}>
                        {customerName}
                      </div>
                      {invoice.customer?.email && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {invoice.customer.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {format(new Date(invoice.issue_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {invoice.due_date ? (
                        <span className={overdue ? 'text-red-600 font-medium' : ''}>
                          {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      €{invoice.total_inc_vat.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {invoice.balance_due > 0 ? (
                        <span className={overdue ? 'text-red-600 font-medium' : 'font-medium'}>
                          €{invoice.balance_due.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-green-600">Paid</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleOpenInvoice(invoice);
                          }}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {invoice.order_id && (
                            <DropdownMenuItem onClick={(e) => handlePrintInvoice(invoice, e)}>
                              <Printer className="mr-2 h-4 w-4" />
                              Print Invoice
                            </DropdownMenuItem>
                          )}
                          {invoice.customer?.email && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              // TODO: Implement email sending
                              console.log('Email invoice to', invoice.customer?.email);
                            }}>
                              <Mail className="mr-2 h-4 w-4" />
                              Email Invoice
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary Stats */}
      {filteredInvoices.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <div>
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-4">
            <span>
              Total: <strong className="text-foreground">
                €{filteredInvoices.reduce((sum, inv) => sum + inv.total_inc_vat, 0).toFixed(2)}
              </strong>
            </span>
            <span>
              Outstanding: <strong className="text-foreground">
                €{filteredInvoices.reduce((sum, inv) => sum + inv.balance_due, 0).toFixed(2)}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Invoice Detail Dialog */}
      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
