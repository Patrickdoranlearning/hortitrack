import { notFound, redirect } from 'next/navigation';
import { getUserAndOrg } from '@/server/auth/org';
import { getSupabaseServerApp } from '@/server/db/supabaseServerApp';
import { format } from 'date-fns';
import PrintButton from './PrintButton';

interface PageProps {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ picker?: string }>;
}

interface PrintItem {
  id: string;
  productName: string;
  size: string;
  totalQty: number;
  locationHint: string | null;
  sizeCategoryName: string;
  sizeCategoryColor: string | null;
}

export default async function PrintPickListPage({ params, searchParams }: PageProps) {
  const { batchId } = await params;
  const { picker: pickerUserId } = await searchParams;

  let orgId: string;

  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
  } catch {
    redirect('/login?next=/dispatch/bulk-picking');
  }

  const supabase = await getSupabaseServerApp();

  // Fetch the batch
  const { data: batch, error: batchError } = await supabase
    .from('bulk_pick_batches')
    .select('id, batch_number, batch_date, status')
    .eq('id', batchId)
    .eq('org_id', orgId)
    .single();

  if (batchError || !batch) {
    notFound();
  }

  // Build query for items - optionally filtered by picker
  let itemsQuery = supabase
    .from('bulk_pick_items')
    .select(`
      id,
      total_qty,
      location_hint,
      assigned_to,
      size_category_id,
      sku:skus(
        sku_code,
        plant_variety:plant_varieties(name),
        plant_size:plant_sizes(name)
      ),
      size_category:picking_size_categories(id, name, color)
    `)
    .eq('bulk_batch_id', batchId);

  if (pickerUserId) {
    itemsQuery = itemsQuery.eq('assigned_to', pickerUserId);
  }

  const { data: items, error: itemsError } = await itemsQuery;

  if (itemsError) {
    notFound();
  }

  // Fetch picker name if filtering by picker
  let pickerName: string | null = null;
  if (pickerUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, display_name')
      .eq('id', pickerUserId)
      .single();
    pickerName = profile?.full_name || profile?.display_name || null;
  }

  // Transform items
  const transformedItems: PrintItem[] = (items || []).map((item: Record<string, unknown>) => {
    const sku = item.sku as { sku_code?: string; plant_variety?: { name?: string }; plant_size?: { name?: string } } | null;
    const sizeCategory = item.size_category as { id?: string; name?: string; color?: string } | null;

    return {
      id: item.id as string,
      productName: sku?.plant_variety?.name || 'Unknown',
      size: sku?.plant_size?.name || '',
      totalQty: item.total_qty as number,
      locationHint: (item.location_hint as string) || null,
      sizeCategoryName: sizeCategory?.name || 'Uncategorized',
      sizeCategoryColor: sizeCategory?.color || null,
    };
  });

  // Group items by size category
  const groupedItems = transformedItems.reduce<Record<string, PrintItem[]>>((acc, item) => {
    const key = item.sizeCategoryName;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});

  // Sort items within each group by location then product name
  for (const group of Object.values(groupedItems)) {
    group.sort((a, b) => {
      const locA = a.locationHint || '\uffff';
      const locB = b.locationHint || '\uffff';
      const locCompare = locA.localeCompare(locB);
      if (locCompare !== 0) return locCompare;
      return a.productName.localeCompare(b.productName);
    });
  }

  const totalItems = transformedItems.length;
  const totalUnits = transformedItems.reduce((sum, i) => sum + i.totalQty, 0);
  const categoryNames = Object.keys(groupedItems).sort();
  const batchDate = format(new Date(batch.batch_date as string), 'dd/MM/yyyy');

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-page {
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-break-before {
            page-break-before: always;
          }
          table {
            font-size: 11px;
          }
          th, td {
            padding: 4px 8px !important;
          }
        }
        @media screen {
          .print-page {
            max-width: 800px;
            margin: 0 auto;
            padding: 24px;
          }
        }
      `}</style>

      <div className="print-page">
        {/* Print Button - screen only */}
        <div className="no-print flex items-center justify-between mb-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            Ready to print. Click the button or use Ctrl+P / Cmd+P.
          </p>
          <PrintButton />
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{batch.batch_number}</h1>
              <p className="text-sm text-muted-foreground">Pick List</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">Date: {batchDate}</p>
              {pickerName && (
                <p className="text-muted-foreground">Picker: {pickerName}</p>
              )}
            </div>
          </div>
          <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
            <span>{totalItems} items</span>
            <span>{totalUnits} units</span>
            {categoryNames.length > 0 && (
              <span>Categories: {categoryNames.join(', ')}</span>
            )}
          </div>
          <hr className="mt-3" />
        </div>

        {/* Items grouped by category */}
        {categoryNames.map((categoryName, catIdx) => {
          const categoryItems = groupedItems[categoryName];
          const categoryUnits = categoryItems.reduce((s, i) => s + i.totalQty, 0);

          return (
            <div key={categoryName} className={catIdx > 0 ? 'mt-6 print-break-before' : ''}>
              <h2 className="text-lg font-semibold mb-2">
                {categoryName}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({categoryItems.length} items, {categoryUnits} units)
                </span>
              </h2>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground/20">
                    <th className="text-left py-2 px-2 font-semibold">Product Name</th>
                    <th className="text-left py-2 px-2 font-semibold">Size</th>
                    <th className="text-center py-2 px-2 font-semibold">Qty</th>
                    <th className="text-left py-2 px-2 font-semibold">Location</th>
                    <th className="text-center py-2 px-2 font-semibold w-16">Picked</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryItems.map((item) => (
                    <tr key={item.id} className="border-b border-foreground/10">
                      <td className="py-2 px-2 font-medium">{item.productName}</td>
                      <td className="py-2 px-2 text-muted-foreground">{item.size}</td>
                      <td className="py-2 px-2 text-center font-semibold">{item.totalQty}</td>
                      <td className="py-2 px-2 text-muted-foreground">{item.locationHint || '-'}</td>
                      <td className="py-2 px-2 text-center">
                        <div className="inline-block w-5 h-5 border-2 border-foreground/30 rounded" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t-2 border-foreground/20">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">Total: {totalItems} items, {totalUnits} units</span>
            <span className="text-muted-foreground">
              Printed: {format(new Date(), 'dd/MM/yyyy HH:mm')}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

