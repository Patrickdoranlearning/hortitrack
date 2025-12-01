'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Batch } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PrinterIcon, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode.react';

export default function PrintBatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batchId');
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) {
      setError('Batch ID is missing.');
      setLoading(false);
      return;
    }

    const fetchBatch = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from('batches').select('*').eq('id', batchId).single();

        if (error) throw error;

        if (data) {
          // Map snake_case to camelCase
          const b: Batch = {
            id: data.id,
            batchNumber: data.batch_number,
            plantVariety: data.plant_variety,
            plantFamily: data.plant_family,
            category: data.category,
            plantingDate: data.planting_date,
            quantity: data.quantity,
            size: data.size,
            location: data.location_id, // or name
            status: data.status,
            supplier: data.supplier_name,
            growerPhotoUrl: data.grower_photo_url,
            salesPhotoUrl: data.sales_photo_url,
            // ... other fields
          } as Batch;
          setBatch(b);
        } else {
          setError('Batch not found.');
        }
      } catch (err) {
        console.error('Error fetching batch:', err);
        setError('Failed to load batch data.');
      } finally {
        setLoading(false);
      }
    };

    fetchBatch();
  }, [batchId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen text-lg">Loading batch data...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-lg text-red-500">{error}</div>;
  }

  if (!batch) {
    return <div className="flex justify-center items-center h-screen text-lg">No batch data available.</div>;
  }

  // Define the base URL for the batch detail page
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const batchDetailPageUrl = `${baseUrl}/batches?batchId=${batch.id}`;

  return (
    <div className="p-8 print:p-0">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Batches
        </Button>
        <Button onClick={handlePrint}>
          <PrinterIcon className="mr-2 h-4 w-4" />
          Print Label
        </Button>
      </div>

      <div className="border p-8 rounded-lg shadow-lg bg-white max-w-2xl mx-auto print:shadow-none print:border-0 print:p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-4">Batch #{batch.batchNumber}</h1>
            <p className="text-lg"><strong>Variety:</strong> {batch.plantVariety}</p>
            <p className="text-lg"><strong>Family:</strong> {batch.plantFamily}</p>
            <p className="text-lg"><strong>Category:</strong> {batch.category}</p>
            <p className="text-lg"><strong>Planting Date:</strong> {new Date(batch.plantingDate).toLocaleDateString()}</p>
            <p className="text-lg"><strong>Current Quantity:</strong> {batch.quantity}</p>
            <p className="text-lg"><strong>Size:</strong> {batch.size}</p>
            <p className="text-lg"><strong>Location:</strong> {batch.location}</p>
            <p className="text-lg"><strong>Status:</strong> {batch.status}</p>
            {batch.supplier && <p className="text-lg"><strong>Supplier:</strong> {batch.supplier}</p>}
          </div>
          <div className="flex flex-col items-center justify-center">
            {batchDetailPageUrl && (
              <>
                <QRCode value={batchDetailPageUrl} size={256} level="H" className="mb-4" />
                <p className="text-sm text-gray-600 text-center">Scan for Batch Details</p>
              </>
            )}
          </div>
        </div>
        {(batch.growerPhotoUrl || batch.salesPhotoUrl) && (
          <div className="mt-6 border-t pt-4">
            <h2 className="text-xl font-semibold mb-3">Photos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {batch.growerPhotoUrl && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Grower Photo</h3>
                  <img src={batch.growerPhotoUrl} alt="Grower" className="w-full h-auto rounded-md object-cover" />
                </div>
              )}
              {batch.salesPhotoUrl && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Sales Photo</h3>
                  <img src={batch.salesPhotoUrl} alt="Sales" className="w-full h-auto rounded-md object-cover" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
