"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/ui/templates/PageFrame";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import MultiParentTransplantBuilder from "@/components/batches/MultiParentTransplantBuilder";

export default function MultiTransplantClient() {
  return (
    <PageFrame moduleKey="production">
      <div className="space-y-6">
        <ModulePageHeader
          title="Multi-parent Transplant"
          description="Combine units from several parent batches into one finished product."
          actionsSlot={
            <Button variant="outline" asChild>
              <Link href="/production/batches">View All Batches</Link>
            </Button>
          }
        />
        <MultiParentTransplantBuilder />
      </div>
    </PageFrame>
  );
}



