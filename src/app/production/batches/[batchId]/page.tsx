import { createClient } from "@/lib/supabase/server";
import EventsCard from "@/components/batches/EventsCard";
import PassportsCard from "@/components/batches/PassportsCard";
import AncestryCard from "@/components/batches/AncestryCard";
import BatchGalleryCard from "@/components/batches/BatchGalleryCard.lazy";
import { BatchPageActions } from "@/components/batches/BatchPageActions";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import { PageFrame } from "@/ui/templates/PageFrame";
import type { Batch } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function Page(props: PageProps) {
  const { params } = props;
  const { batchId } = await params;
  const supabase = await createClient();
  const { data: batch, error } = await supabase
    .from("batches")
    .select("*, plant_varieties(name, category), plant_sizes(name), nursery_locations(name)")
    .eq("id", batchId)
    .single();

  if (error || !batch) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold">Batch not found</h1>
        <p className="text-muted-foreground">{error?.message}</p>
      </div>
    );
  }

  const subtitle = [
    (batch as any).plant_varieties?.name,
    (batch as any).plant_sizes?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  const batchModel: Batch = {
    id: batch.id,
    orgId: (batch as any).org_id ?? "",
    batchNumber: batch.batch_number,
    plantVarietyId: batch.plant_variety_id,
    sizeId: (batch as any).plant_size_id ?? (batch as any).size_id ?? "",
    locationId: (batch as any).nursery_location_id ?? (batch as any).location_id ?? "",
    initialQuantity: (batch as any).initial_quantity ?? batch.quantity ?? 0,
    quantity: batch.quantity ?? 0,
    status: (batch as any).status ?? "Unknown",
    ageWeeks: (batch as any).age_weeks ?? null,
    plantedAt: (batch as any).planted_at ?? undefined,
    readyAt: (batch as any).ready_at ?? undefined,
    archivedAt: (batch as any).archived_at ?? undefined,
    logHistory: (batch as any).log_history ?? [],
    plantVariety: (batch as any).plant_varieties,
    size: (batch as any).plant_sizes,
    location: (batch as any).nursery_locations,
    parentBatchId: (batch as any).parent_batch_id ?? null,
  } as Batch;

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <div className="space-y-4">
        <ModulePageHeader
          title={`Batch ${batch.batch_number}`}
          description={subtitle}
          actionsSlot={
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{batch.status}</Badge>
              <BatchPageActions batch={batchModel} />
            </div>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Batch overview</span>
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
    </PageFrame>
  );
}
