import { redirect } from "next/navigation";
import { getPickItemsForMultipleLists, startPickList } from "@/server/sales/picking";
import CombinedPickingClient from "./CombinedPickingClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function CombinedPickingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const idsParam = params.ids;

  if (!idsParam) {
    redirect("/dispatch/picker");
  }

  const pickListIds = idsParam.split(",").filter(Boolean);

  if (pickListIds.length < 2) {
    redirect("/dispatch/picker");
  }

  // Start all pick lists that aren't already started
  for (const id of pickListIds) {
    try {
      await startPickList(id);
    } catch {
      // Ignore errors - list may already be started
    }
  }

  const { items, pickLists } = await getPickItemsForMultipleLists(pickListIds);

  return (
    <div className="container py-6 space-y-6">
      <CombinedPickingClient
        initialItems={items}
        pickLists={pickLists}
      />
    </div>
  );
}
