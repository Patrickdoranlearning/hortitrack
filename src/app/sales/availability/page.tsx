import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { getSaleableProducts } from '@/server/sales/queries.server';

export default async function SalesAvailabilityPage() {
    const products = await getSaleableProducts();

    return (
        <PageFrame companyName="Doran Nurseries" moduleKey="sales">
            <div className="space-y-6">
                <ModulePageHeader
                    title="Live Availability"
                    description="What can be sold right now based on ready batches"
                />

                <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b text-sm font-semibold text-muted-foreground">
                        <div className="col-span-4">Product</div>
                        <div className="col-span-2">Category</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-2 text-right">Available Qty</div>
                        <div className="col-span-2 text-right">Batches</div>
                    </div>

                    {products.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground text-sm">
                            No saleable inventory right now.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {products.map((p) => (
                                <div key={p.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center">
                                    <div className="col-span-4">
                                        <div className="font-medium">
                                            {p.plantVariety} • {p.size}
                                        </div>
                                        {p.barcode && (
                                            <div className="text-xs text-muted-foreground">SKU: {p.barcode}</div>
                                        )}
                                    </div>
                                    <div className="col-span-2 text-sm text-muted-foreground">{p.category ?? '—'}</div>
                                    <div className="col-span-2">
                                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                                            {p.status || 'Available'}
                                        </span>
                                    </div>
                                    <div className="col-span-2 text-right font-semibold">{p.totalQuantity}</div>
                                    <div className="col-span-2 text-right text-sm text-muted-foreground">
                                        {p.availableBatches.length}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageFrame>
    );
}
