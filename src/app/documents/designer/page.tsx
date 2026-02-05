import { TemplatePicker } from "@/components/documents/TemplatePicker";
import { ModulePageHeader } from '@/ui/templates';
import { PageFrame } from '@/ui/templates';

export const dynamic = "force-dynamic";

export default function DocumentDesignerPage() {
  return (
    <PageFrame moduleKey="sales">
      <div className="space-y-4">
        <ModulePageHeader
          title="Document Templates"
          description="Choose a style for your business documents"
        />
        <TemplatePicker />
      </div>
    </PageFrame>
  );
}
