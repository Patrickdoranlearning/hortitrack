import { createClient } from "@/lib/supabase/server";
import dynamic from "next/dynamic";
import EventsCard from "@/components/batches/EventsCard";
import PassportsCard from "@/components/batches/PassportsCard";
import AncestryCard from "@/components/batches/AncestryCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Lazy load gallery to avoid slowing down initial page load
const BatchGalleryCard = dynamic(
  () => import("@/components/batches/BatchGalleryCard"),
  { 
    loading: () => (
      <Card>
        <CardHeader><CardTitle className="text-base">Photos</CardTitle></CardHeader>
        <CardContent><div className="text-sm text-muted-foreground">Loading...</div></CardContent>
      </Card>
    ),
    ssr: false 
  }
);

export default async function Page({ params }: { params: { batchId: string } }) {
  const supabase = await createClient();
  const { data: batch, error } = await supabase
    .from("batches")
    .select("*, plant_varieties(name, category), plant_sizes(name), nursery_locations(name)")
    .eq("id", params.batchId)
    .single();

  if (error || !batch) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold">Batch not found</h1>
        <p className="text-muted-foreground">{error?.message}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Batch {batch.batch_number}</span>
            <Badge>{batch.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold">Variety</h3>
              <p>{(batch as any).plant_varieties?.name}</p>
            </div>
            <div>
              <h3 className="font-semibold">Size</h3>
              <p>{(batch as any).plant_sizes?.name}</p>
            </div>
            <div>
              <h3 className="font-semibold">Location</h3>
              <p>{(batch as any).nursery_locations?.name}</p>
            </div>
            <div>
              <h3 className="font-semibold">Quantity</h3>
              <p>{batch.quantity}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <EventsCard batchId={batch.id} />
          <AncestryCard batchId={batch.id} />
        </div>
        <div className="space-y-4">
          <BatchGalleryCard
            batchId={batch.id}
            varietyId={batch.plant_variety_id}
          />
          <PassportsCard batchId={batch.id} />
        </div>
      </div>
    </div>
  );
}
