'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { generateInvoice, getOrderDetails } from '@/app/sales/actions';
import { useToast } from '@/components/ui/use-toast';
import { SalesOrder, Invoice } from '@/lib/sales/types';

interface OrderDetailDialogProps {
    orderId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function OrderDetailDialog({ orderId, open, onOpenChange }: OrderDetailDialogProps) {
    const [activeTab, setActiveTab] = useState('order');
    const [order, setOrder] = useState<SalesOrder & { invoices?: Invoice[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (open && orderId) {
            setLoading(true);
            getOrderDetails(orderId).then((res) => {
                if (res.order) {
                    setOrder(res.order as any); // Type casting for now due to joins
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

    if (!orderId) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Order Details #{order?.order_number || orderId.slice(0, 7)}</DialogTitle>
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
                                    <div className="p-4">
                                        <h3 className="font-semibold mb-2">Order Items</h3>
                                        {/* TODO: Render items */}
                                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">
                                            {JSON.stringify(order, null, 2)}
                                        </pre>
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
                                                        <div className="font-bold">Invoice #{inv.invoice_number}</div>
                                                        <div>Status: {inv.status}</div>
                                                        <div>Total: €{inv.total_inc_vat.toFixed(2)}</div>
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
                                                                if (updated.order) setOrder(updated.order as any);
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
