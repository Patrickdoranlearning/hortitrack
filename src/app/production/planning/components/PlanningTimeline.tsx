"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import type { PlanningSnapshot, PlanningBatch } from "@/lib/planning/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-IE", { month: "short", day: "numeric", year: "numeric" });

type Props = {
  snapshot?: PlanningSnapshot;
};

export function PlanningTimeline({ snapshot }: Props) {
  const data = snapshot?.buckets ?? [];
  const ghosts = (snapshot?.batches ?? [])
    .filter((batch) => batch.isGhost)
    .sort((a, b) => (a.readyDate ?? "").localeCompare(b.readyDate ?? ""))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(value) => numberFormatter.format(value)} />
            <Tooltip
              contentStyle={{ borderRadius: "0.5rem" }}
              formatter={(value: number, key: string) => [
                numberFormatter.format(value),
                key === "physical" ? "On site" : key === "incoming" ? "Incoming" : "Planned",
              ]}
            />
            <Legend />
            <Area type="monotone" dataKey="physical" stackId="1" stroke="#16a34a" fill="#86efac" />
            <Area type="monotone" dataKey="incoming" stackId="1" stroke="#f97316" fill="#fed7aa" />
            <Area type="monotone" dataKey="planned" stackId="1" stroke="#6366f1" fill="#c7d2fe" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Upcoming ghost batches</h3>
          <Badge variant="outline">{ghosts.length} showing</Badge>
        </div>
        <div className="space-y-3">
          {ghosts.length === 0 && (
            <p className="text-sm text-muted-foreground border rounded-md px-3 py-2">
              No incoming or planned batches in the next few months.
            </p>
          )}
          {ghosts.map((batch) => (
            <div
              key={batch.id}
              className={cn(
                "rounded-lg border p-3 flex items-center justify-between",
                batch.status === "Incoming" ? "bg-orange-50 border-orange-200" : "bg-indigo-50 border-indigo-200"
              )}
            >
              <div>
                <div className="text-sm font-medium">
                  {batch.varietyName ?? "Unnamed variety"} · {batch.sizeName ?? "Size"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Ready {formatDate(batch.readyDate)} · {batch.quantity} plants
                </div>
              </div>
              <Badge variant="secondary">{batch.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "TBC";
  try {
    return dateFormatter.format(new Date(value));
  } catch {
    return value;
  }
}




