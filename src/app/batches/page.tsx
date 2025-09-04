import { getBatchesAction } from "@/app/actions";
import BatchesClient from "./BatchesClient";
export const dynamic = "force-dynamic";

export default async function Page() {
  const { data: batches, error } = await getBatchesAction();

  if (error) {
    throw new Error(`Failed to load batches: ${error}`);
  }

  return <BatchesClient initialBatches={batches || []} />;
}
