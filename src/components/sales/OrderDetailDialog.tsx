'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { generateInvoice, getOrderDetails } from '@/app/sales/actions';
import { useToast } from '@/components/ui/use-toast';
import { SalesOrder, Invoice } from '@/lib/sales/types';
import { Printer, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface OrderDetailDialogProps {
    orderId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface OrderItem {
    id: string;
    description: string | null;
    quantity: number;
    unit_price_ex_vat: number;
    line_total_ex_vat: number;
    line_vat_amount: number;
}

interface OrderWithItems extends SalesOrder {
    invoices?: Invoice[];
    order_items?: OrderItem[];
}

export default function OrderDetailDialog({ orderId, open, onOpenChange }: OrderDetailDialogProps) {
    const [activeTab, setActiveTab] = useState('order');
    const [order, setOrder] = useState<OrderWithItems | null>(null);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (open && orderId) {
            setLoading(true);
            getOrderDetails(orderId).then((res) => {
                if (res.order) {
                    setOrder(res.order as OrderWithItems);
                } else {
                    toast({
                        title: "Error",
                        description: "Failed to load order details",
                        variant: "destructive",
                    });
                }
                setLoading(false);
            });
        } else {
            setOrder(null);
        }
    }, [open, orderId, toast]);

    const handlePrintDocket = () => {
        if (orderId) {
            window.open(`/sales/orders/${orderId}/docket`, '_blank');
        }
    };

    if (!orderId) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Order Details #{order?.order_number || orderId.slice(0, 7)}</DialogTitle>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrintDocket}
                                className="gap-2"
                            >
                                <Printer className="h-4 w-4" />
                                Print Docket
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <TabsList>
                        <TabsTrigger value="order">Order</TabsTrigger>
                        <TabsTrigger value="pick">Pick</TabsTrigger>
                        <TabsTrigger value="invoice">Invoice</TabsTrigger>
                        <TabsTrigger value="qc">QC</TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-y-auto mt-4">
                        {loading ? (
                            <div className="p-4 text-center">Loading...</div>
                        ) : (
                            <>
                                <TabsContent value="order">
                                    <div className="p-4 space-y-4">
                                        {/* Order Summary */}
                                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Order Number</p>
                                                <p className="font-medium">{order?.order_number}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Status</p>
                                                <p className="font-medium capitalize">{order?.status}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Total</p>
                                                <p className="font-medium">€{(order?.total_inc_vat || 0).toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Delivery Date</p>
                                                <p className="font-medium">
                                                    {order?.requested_delivery_date || 'Not specified'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Order Items */}
                                        <div>
                                            <h3 className="font-semibold mb-3">Order Items</h3>
                                            {order?.order_items && order.order_items.length > 0 ? (
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b text-left">
                                                            <th className="pb-2">Description</th>
                                                            <th className="pb-2 text-right">Qty</th>
                                                            <th className="pb-2 text-right">Unit Price</th>
                                                            <th className="pb-2 text-right">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {order.order_items.map((item) => (
                                                            <tr key={item.id} className="border-b">
                                                                <td className="py-2">{item.description || 'Product'}</td>
                                                                <td className="py-2 text-right">{item.quantity}</td>
                                                                <td className="py-2 text-right">
                                                                    €{item.unit_price_ex_vat.toFixed(2)}
                                                                </td>
                                                                <td className="py-2 text-right">
                                                                    €{item.line_total_ex_vat.toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="border-t">
                                                            <td colSpan={3} className="py-2 text-right font-medium">
                                                                Subtotal:
                                                            </td>
                                                            <td className="py-2 text-right">
                                                                €{(order?.subtotal_ex_vat || 0).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td colSpan={3} className="py-1 text-right text-muted-foreground">
                                                                VAT:
                                                            </td>
                                                            <td className="py-1 text-right text-muted-foreground">
                                                                €{(order?.vat_amount || 0).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                        <tr className="font-semibold">
                                                            <td colSpan={3} className="py-2 text-right">
                                                                Total:
                                                            </td>
                                                            <td className="py-2 text-right">
                                                                €{(order?.total_inc_vat || 0).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            ) : (
                                                <p className="text-muted-foreground">No items found</p>
                                            )}
                                        </div>

                                        {/* Notes */}
                                        {order?.notes && (
                                            <div>
                                                <h3 className="font-semibold mb-2">Notes</h3>
                                                <p className="text-sm text-muted-foreground">{order.notes}</p>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-3 pt-4 border-t">
                                            <Button
                                                variant="outline"
                                                onClick={handlePrintDocket}
                                                className="gap-2"
                                            >
                                                <Printer className="h-4 w-4" />
                                                Print Delivery Docket
                                            </Button>
                                            <Button asChild variant="outline" className="gap-2">
                                                <Link href={`/sales/orders/${orderId}/docket`} target="_blank">
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open Docket
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="pick">
                                    <div className="p-4">
                                        <h3 className="font-semibold mb-2">Picking Status</h3>
                                        <p className="text-muted-foreground">Status: {order?.status}</p>
                                    </div>
                                </TabsContent>

                                <TabsContent value="invoice">
                                    <div className="p-4">
                                        <h3 className="font-semibold mb-2">Invoice & Credit</h3>
                                        {order?.invoices && order.invoices.length > 0 ? (
                                            <div className="space-y-4">
                                                {order.invoices.map(inv => (
                                                    <div key={inv.id} className="border p-4 rounded">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="h-4 w-4" />
                                                            <span className="font-bold">Invoice #{inv.invoice_number}</span>
                                                        </div>
                                                        <div className="mt-2 text-sm text-muted-foreground">
                                                            Status: {inv.status}
                                                        </div>
                                                        <div className="text-sm">
                                                            Total: €{inv.total_inc_vat.toFixed(2)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <p className="text-muted-foreground">No invoice generated.</p>
                                                <Button
                                                    onClick={async () => {
                                                        if (!orderId) return;
                                                        try {
                                                            const result = await generateInvoice(orderId);
                                                            if (result.error) {
                                                                toast({
                                                                    title: "Error",
                                                                    description: result.error,
                                                                    variant: "destructive",
                                                                });
                                                            } else {
                                                                toast({
                                                                    title: "Success",
                                                                    description: "Invoice generated successfully!",
                                                                });
                                                                // Refresh details
                                                                const updated = await getOrderDetails(orderId);
                                                                if (updated.order) setOrder(updated.order as OrderWithItems);
                                                            }
                                                        } catch (e) {
                                                            console.error(e);
                                                            toast({
                                                                title: "Error",
                                                                description: "Failed to generate invoice",
                                                                variant: "destructive",
                                                            });
                                                        }
                                                    }}
                                                >
                                                    Generate Invoice
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="qc">
                                    <div className="p-4">
                                        <h3 className="font-semibold mb-2">Quality Control</h3>
                                        <p className="text-muted-foreground">No issues reported.</p>
                                    </div>
                                </TabsContent>
                            </>
                        )}
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
