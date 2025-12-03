import { ReferenceDataProvider } from "@/contexts/ReferenceDataContext";
import MultiTransplantClient from "./MultiTransplantClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Multi-Parent Transplant | Hortitrack",
  description: "Assemble a product from multiple parent batches in one flow.",
};

export default function MultiTransplantPage() {
  return (
    <ReferenceDataProvider>
      <MultiTransplantClient />
    </ReferenceDataProvider>
  );
}

