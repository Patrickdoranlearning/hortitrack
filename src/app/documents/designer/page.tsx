import { DocumentDesigner } from "@/components/documents/DocumentDesigner";

export const dynamic = "force-dynamic";

export default function DocumentDesignerPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <DocumentDesigner />
    </div>
  );
}

