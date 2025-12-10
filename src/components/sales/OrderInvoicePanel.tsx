'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Printer, Plus, ExternalLink, Receipt } from 'lucide-react';
import { generateInvoice } from '@/app/sales/actions';
import CreditNoteDialog from './CreditNoteDialog';
import type { OrderItem, OrderInvoice } from './OrderDetailPage';

interface OrderInvoicePanelProps {
  orderId: string;
  orderItems: OrderItem[];
  invoices: OrderInvoice[];
  orderStatus: string;
  subtotal: number;
  vat: number;
  total: number;
  onInvoiceGenerated: () => void;
}

export default function OrderInvoicePanel({
  orderId,
  orderItems,
  invoices,
  orderStatus,
  subtotal,
  vat,
  total,
  onInvoiceGenerated,
}: OrderInvoicePanelProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [creditNoteDialogOpen, setCreditNoteDialogOpen] = useState(false);

  const hasInvoice = invoices.length > 0;
  const latestInvoice = invoices[0];
  const canGenerateInvoice = !hasInvoice && ['confirmed', 'picking', 'ready', 'dispatched', 'delivered'].includes(orderStatus);

  const handleGenerateInvoice = async () => {
    setIsGenerating(true);
    try {
      const result = await generateInvoice(orderId);
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Invoice Generated',
          description: `Invoice ${result.invoice?.invoice_number} has been created`,
        });
        onInvoiceGenerated();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to generate invoice',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
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
      case 'cancelled':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getItemDescription = (item: OrderItem) => {
    if (item.product?.name) return item.product.name;
    if (item.description) return item.description;
    const variety = item.sku?.plant_varieties?.name || '';
    const size = item.sku?.plant_sizes?.name || '';
    return `${variety} ${size}`.trim() || 'Product';
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Invoice Preview / Generation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice
              </span>
              {hasInvoice && (
                <Badge variant={getStatusVariant(latestInvoice.status)} className="capitalize">
                  {latestInvoice.status}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasInvoice ? (
              <div className="space-y-4">
                {/* Invoice Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Number</p>
                    <p className="font-semibold">{latestInvoice.invoice_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Issue Date</p>
                    <p className="font-medium">
                      {format(new Date(latestInvoice.issue_date), 'PPP')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {latestInvoice.due_date 
                        ? format(new Date(latestInvoice.due_date), 'PPP')
                        : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Balance Due</p>
                    <p className="font-semibold text-lg">
                      €{latestInvoice.balance_due.toFixed(2)}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Invoice Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>€{latestInvoice.subtotal_ex_vat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT</span>
                    <span>€{latestInvoice.vat_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>€{latestInvoice.total_inc_vat.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/sales/orders/${orderId}/invoice`} target="_blank">
                      <Printer className="h-4 w-4 mr-2" />
                      Print Invoice
                    </Link>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCreditNoteDialogOpen(true)}
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Create Credit Note
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No invoice has been generated for this order
                </p>
                {canGenerateInvoice ? (
                  <Button onClick={handleGenerateInvoice} disabled={isGenerating}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isGenerating ? 'Generating...' : 'Generate Invoice'}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Order must be confirmed to generate an invoice
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Invoice Line Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orderItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No items in this order
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right w-[60px]">Qty</TableHead>
                    <TableHead className="text-right w-[100px]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {getItemDescription(item)}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        €{item.line_total_ex_vat.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="text-right">Subtotal</TableCell>
                    <TableCell className="text-right">€{subtotal.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={2} className="text-right text-muted-foreground">VAT</TableCell>
                    <TableCell className="text-right text-muted-foreground">€{vat.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={2} className="text-right font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">€{total.toFixed(2)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Credit Note Dialog */}
      <CreditNoteDialog
        open={creditNoteDialogOpen}
        onOpenChange={setCreditNoteDialogOpen}
        orderId={orderId}
        orderItems={orderItems}
        onCreditNoteCreated={onInvoiceGenerated}
      />
    </>
  );
}



