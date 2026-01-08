import { DocumentDesigner } from "@/components/documents/DocumentDesigner";
import { ModulePageHeader } from '@/ui/templates';
import { PageFrame } from '@/ui/templates';

export const dynamic = "force-dynamic";

export default function DocumentDesignerPage() {
  return (
    <PageFrame moduleKey="sales">
      <div className="space-y-4">
        <ModulePageHeader
          title="Document Designer"
          description="Create and manage document templates for invoices, delivery dockets, and more"
        />
        <DocumentDesigner />
      </div>
    </PageFrame>
  );
}







