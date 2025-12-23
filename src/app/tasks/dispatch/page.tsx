import { PageFrame } from '@/ui/templates';
import Link from "next/link";
import { ArrowLeft, Truck, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModulePageHeader } from '@/ui/templates';

export const dynamic = "force-dynamic";

export default function DispatchTasksPage() {
  return (
    <PageFrame moduleKey="tasks">
      <div className="space-y-6">
        <ModulePageHeader
          title="Dispatch Tasks"
          description="Picking, packing, and loading tasks."
          actionsSlot={
            <Link href="/tasks">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Overview
              </Button>
            </Link>
          }
        />

        <Card className="border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
              <Construction className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Dispatch tasks will integrate with the Dispatch module to help you manage
              picking lists, packing assignments, and delivery loading.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex flex-wrap gap-2 justify-center text-sm text-muted-foreground">
              <span className="px-3 py-1 rounded-full bg-muted">Pick Lists</span>
              <span className="px-3 py-1 rounded-full bg-muted">Packing Tasks</span>
              <span className="px-3 py-1 rounded-full bg-muted">Loading Assignments</span>
              <span className="px-3 py-1 rounded-full bg-muted">QC Checks</span>
            </div>
            <div className="mt-6">
              <Link href="/dispatch">
                <Button variant="outline">
                  <Truck className="mr-2 h-4 w-4" />
                  Go to Dispatch Module
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  );
}


