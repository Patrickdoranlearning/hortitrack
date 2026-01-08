"use client";

import { PageFrame } from '@/ui/templates';
import Link from "next/link";
import { ArrowLeft, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModulePageHeader } from '@/ui/templates';
import { DispatchKanban } from "./DispatchKanban";

export default function DispatchTasksPage() {
  return (
    <PageFrame moduleKey="tasks">
      <div className="space-y-6">
        <ModulePageHeader
          title="Dispatch Tasks"
          description="Picking, packing, and loading tasks organized by workflow stage."
          actionsSlot={
            <div className="flex items-center gap-2">
              <Link href="/dispatch/manager">
                <Button variant="outline" size="sm">
                  <Truck className="mr-2 h-4 w-4" />
                  Dispatch Manager
                </Button>
              </Link>
              <Link href="/tasks">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Overview
                </Button>
              </Link>
            </div>
          }
        />

        <DispatchKanban />
      </div>
    </PageFrame>
  );
}
