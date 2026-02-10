import { notFound, redirect } from "next/navigation";
import { getDeliveryRunWithItems } from "@/server/dispatch/queries.server";
import { getHauliersWithVehicles } from "@/server/dispatch/queries.server";
import LoadDetailClient from "./LoadDetailClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ loadId: string }>;
}

export default async function LoadDetailPage({ params }: PageProps) {
  const { loadId } = await params;

  let loadData;
  let hauliers;

  try {
    [loadData, hauliers] = await Promise.all([
      getDeliveryRunWithItems(loadId),
      getHauliersWithVehicles(),
    ]);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      redirect("/login?next=/dispatch/manager/orders");
    }
    notFound();
  }

  if (!loadData) {
    notFound();
  }

  // Find haulier and vehicle info
  const haulier = loadData.haulierId
    ? hauliers.find((h) => h.id === loadData.haulierId)
    : null;
  const vehicle = loadData.vehicleId && haulier
    ? haulier.vehicles?.find((v) => v.id === loadData.vehicleId)
    : null;

  return (
    <LoadDetailClient
      load={loadData}
      haulierName={haulier?.name}
      vehicleName={vehicle?.name}
      vehicleCapacity={vehicle?.trolleyCapacity ?? haulier?.trolleyCapacity ?? 20}
    />
  );
}
