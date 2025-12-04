'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import bwipjs from 'bwip-js';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { PrinterIcon, ArrowLeft, MapPin, Package, Sprout } from 'lucide-react';

type LocationWithBatches = {
  id: string;
  name: string;
  nurserySite?: string;
  type?: string;
  siteId?: string;
  covered?: boolean;
  area?: number;
  batchCount: number;
  totalQuantity: number;
  batches: Array<{
    id: string;
    batchNumber: string;
    plantVariety?: string;
    plantFamily?: string;
    quantity: number;
    plantedAt?: string;
    size?: string;
  }>;
};

export default function PrintLocationPage() {
  const router = useRouter();
  const params = useParams<{ locationId: string }>();
  const locationId = params?.locationId;
  const [location, setLocation] = useState<LocationWithBatches | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dmRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!locationId) {
      setError('Location ID is missing.');
      setLoading(false);
      return;
    }

    const fetchLocation = async () => {
      try {
        const supabase = createClient();
        
        // Fetch location
        const { data: loc, error: locError } = await supabase
          .from('nursery_locations')
          .select('*')
          .eq('id', locationId)
          .single();

        if (locError || !loc) {
          setError('Location not found.');
          setLoading(false);
          return;
        }

        // Fetch batches in this location
        const { data: batches } = await supabase
          .from('batches')
          .select(`
            id,
            batch_number,
            quantity,
            planted_at,
            plant_sizes (
              name
            ),
            plant_varieties (
              name,
              family
            )
          `)
          .eq('location_id', locationId)
          .not('status', 'eq', 'Archived')
          .gt('quantity', 0);

        const mappedBatches = (batches || []).map((b: any) => ({
          id: b.id,
          batchNumber: b.batch_number,
          plantVariety: b.plant_varieties?.name,
          plantFamily: b.plant_varieties?.family,
          quantity: b.quantity,
          plantedAt: b.planted_at,
          size: b.plant_sizes?.name,
        }));

        const totalQuantity = mappedBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);

        setLocation({
          id: loc.id,
          name: loc.name,
          nurserySite: loc.nursery_site,
          type: loc.type,
          siteId: loc.site_id,
          covered: loc.covered,
          area: loc.area,
          batchCount: mappedBatches.length,
          totalQuantity,
          batches: mappedBatches,
        });
      } catch (err) {
        console.error('Error fetching location:', err);
        setError('Failed to load location data.');
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [locationId]);

  // Generate DataMatrix when location loads
  useEffect(() => {
    if (!dmRef.current || !location) return;
    try {
      bwipjs.toCanvas(dmRef.current, {
        bcid: 'datamatrix',
        text: `ht:loc:${location.id}`,
        scale: 4,
        includetext: false,
      });
    } catch (e) {
      console.error('DataMatrix render failed:', e);
    }
  }, [location]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-lg">
        Loading location data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-lg text-red-500">
        {error}
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex justify-center items-center h-screen text-lg">
        No location data available.
      </div>
    );
  }

  // Get top varieties
  const varietyCounts: Record<string, { name: string; count: number }> = {};
  location.batches.forEach((batch) => {
    const name = batch.plantVariety || 'Unknown';
    if (!varietyCounts[name]) {
      varietyCounts[name] = { name, count: 0 };
    }
    varietyCounts[name].count += batch.quantity;
  });
  const topVarieties = Object.values(varietyCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const formatWeekYear = (date?: string) => {
    if (!date) return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${String(weekNo).padStart(2, '0')}/${String(target.getUTCFullYear()).slice(-2)}`;
  };

  return (
    <div className="p-8 print:p-0">
      {/* Screen controls */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Locations
        </Button>
        <Button onClick={handlePrint}>
          <PrinterIcon className="mr-2 h-4 w-4" />
          Print Label
        </Button>
      </div>

      {/* Printable label - A5 landscape size (210x148mm) */}
      <div
        className="border rounded-lg shadow-lg bg-white max-w-5xl mx-auto print:shadow-none print:border-0 print:max-w-none print:w-full"
        style={{ padding: '32px' }}
      >
        {/* Header row: DataMatrix + Location info */}
        <div className="grid gap-6 mb-8 md:grid-cols-[auto_1fr] items-center">
          <div className="flex-shrink-0">
            <canvas ref={dmRef} style={{ width: '140px', height: '140px' }} />
            <p className="text-sm text-gray-500 text-center mt-2">Scan for live location data</p>
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Location Overview</p>
            <h1 className="text-5xl font-bold mb-4">{location.name}</h1>
            <p className="text-2xl text-gray-600">
              {location.nurserySite || 'Main'} • {location.type || 'Section'}
            </p>
            <div className="flex flex-wrap items-center gap-6 mt-6 text-xl">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-blue-600" />
                <span><strong className="text-3xl">{location.batchCount}</strong> batches</span>
              </div>
              <div className="flex items-center gap-3">
                <Sprout className="h-6 w-6 text-emerald-600" />
                <span><strong className="text-3xl">{location.totalQuantity.toLocaleString()}</strong> plants</span>
              </div>
              {location.area && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-6 w-6 text-amber-600" />
                  <span><strong className="text-3xl">{location.area}</strong> m²</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t mb-6" />

        {/* Contents section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-500 uppercase tracking-[0.3em]">
            Contents Overview
          </h2>
          {topVarieties.length > 0 ? (
            <div className="grid gap-y-3 gap-x-10 md:grid-cols-2 text-xl">
              {topVarieties.map((v) => (
                <div key={v.name} className="flex justify-between">
                  <span className="truncate font-medium">{v.name}</span>
                  <span className="font-semibold text-2xl">{v.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">No plants in this location</p>
          )}
          {topVarieties.length < location.batches.length && (
            <p className="text-base text-gray-400 mt-1">
              + {location.batches.length - topVarieties.length} more varieties
            </p>
          )}
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-semibold text-gray-500 uppercase tracking-[0.3em] mb-4">
            Batch Detail
          </h2>
          {location.batches.length > 0 ? (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse text-lg">
                <thead className="bg-gray-50 text-left uppercase text-gray-500 text-sm tracking-widest">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Variety</th>
                    <th className="py-3 px-4 font-semibold">Family</th>
                    <th className="py-3 px-4 font-semibold">Size</th>
                    <th className="py-3 px-4 font-semibold text-right">Quantity</th>
                    <th className="py-3 px-4 font-semibold text-right">Potting Date (WW/YY)</th>
                  </tr>
                </thead>
                <tbody>
                  {location.batches
                    .slice()
                    .sort((a, b) => (a.plantVariety || '').localeCompare(b.plantVariety || ''))
                    .map((batch) => (
                      <tr key={batch.id} className="border-t text-base">
                        <td className="py-3 px-4">
                          <div className="font-semibold">{batch.plantVariety || '—'}</div>
                          <div className="text-xs text-gray-400 font-mono">#{batch.batchNumber}</div>
                        </td>
                        <td className="py-3 px-4">{batch.plantFamily || '—'}</td>
                        <td className="py-3 px-4">{batch.size || '—'}</td>
                        <td className="py-3 px-4 text-right font-semibold">{(batch.quantity ?? 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-semibold">{formatWeekYear(batch.plantedAt)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 italic">No batches currently assigned to this location.</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t mt-8 pt-4 flex justify-between text-base text-gray-500">
          <span>Printed: {new Date().toLocaleDateString()}</span>
          {location.siteId && <span>Site ID: {location.siteId}</span>}
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
        }
      `}</style>
    </div>
  );
}

