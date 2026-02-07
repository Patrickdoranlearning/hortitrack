import { createClient } from "@/lib/supabase/server";
import PassportsCard from "@/components/batches/PassportsCard";
import AncestryCard from "@/components/batches/AncestryCard";
import BatchGalleryCard from "@/components/batches/BatchGalleryCard.lazy";
import { BatchPageActions } from "@/components/batches/BatchPageActions";
import { StockLedgerCard } from "@/components/batches/StockLedgerCard";
import { PlantHealthCard } from "@/components/batches/PlantHealthCard";
import { BatchMaterialsCard } from "@/components/batches/BatchMaterialsCard";
import { ModulePageHeader } from '@/ui/templates';
import { PageFrame } from '@/ui/templates';
import type { Batch } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InteractiveDistributionBarServer } from "./InteractiveDistributionBarServer";

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
    <PageFrame moduleKey="production">
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Variety</h3>
                <p>{(batch as any).plant_varieties?.name}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Size</h3>
                <p>{(batch as any).plant_sizes?.name}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Location</h3>
                <p>{(batch as any).nursery_locations?.name}</p>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Quantity</h3>
                <p className="font-semibold text-lg">{batch.quantity?.toLocaleString()}</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Stock Distribution</h3>
              <InteractiveDistributionBarServer batchId={batch.id} />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <StockLedgerCard batchId={batch.id} />
            <AncestryCard batchId={batch.id} />
          </div>
          <div className="space-y-4">
            <BatchMaterialsCard batchId={batch.id} />
            <PlantHealthCard batchId={batch.id} />
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
