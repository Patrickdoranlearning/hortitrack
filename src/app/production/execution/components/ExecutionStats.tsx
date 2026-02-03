"use client";

import * as React from "react";
import { Layers, Leaf, FolderKanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  totalBatches: number;
  totalPlants: number;
  groupCount: number;
  byStatus: Record<string, number>;
};

const statusColors: Record<string, string> = {
  Incoming: "bg-green-100 text-green-800",
  Planned: "bg-purple-100 text-purple-800",
  "Plugs/Liners": "bg-amber-100 text-amber-800",
};

export function ExecutionStats({ totalBatches, totalPlants, groupCount, byStatus }: Props) {
  const statusEntries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {/* Total Batches */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalBatches}</p>
              <p className="text-sm text-muted-foreground">Total Batches</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Plants */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <Leaf className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPlants.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Plants</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Groups */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{groupCount}</p>
              <p className="text-sm text-muted-foreground">Active Groups</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By Status */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground mb-2">By Status</p>
          <div className="flex flex-wrap gap-2">
            {statusEntries.length === 0 ? (
              <span className="text-sm text-muted-foreground">No batches</span>
            ) : (
              statusEntries.map(([status, count]) => (
                <Badge
                  key={status}
                  variant="secondary"
                  className={statusColors[status] ?? ""}
                >
                  {status}: {count}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
