"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/ui/templates/PageFrame";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import BulkTransplantWizard from "@/components/batches/BulkTransplantWizard";

export default function BulkTransplantClient() {
  const handleComplete = React.useCallback(() => {
    // User can navigate away when done or continue adding more
  }, []);

  return (
    <PageFrame moduleKey="production">
      <div className="space-y-6">
        <ModulePageHeader
          title="Bulk Transplant"
          description="Create multiple transplant batches from existing parent batches at once"
          actionsSlot={
            <Button variant="outline" asChild>
              <Link href="/production/batches">View All Batches</Link>
            </Button>
          }
        />
        <BulkTransplantWizard onComplete={handleComplete} />
      </div>
    </PageFrame>
  );
}

