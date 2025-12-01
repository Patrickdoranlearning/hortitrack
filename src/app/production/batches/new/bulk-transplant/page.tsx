import { ReferenceDataProvider } from "@/contexts/ReferenceDataContext";
import BulkTransplantClient from "./BulkTransplantClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bulk Transplant | Hortitrack",
  description: "Create multiple transplant batches at once via CSV upload or manual entry",
};

export default function BulkTransplantPage() {
  return (
    <ReferenceDataProvider>
      <BulkTransplantClient />
    </ReferenceDataProvider>
  );
}

