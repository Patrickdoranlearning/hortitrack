"use client";

import * as React from "react";
import type { HistoryLog } from "@/server/batches/history";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const TYPE_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  irrigation: { label: "Irrigation", variant: "outline" },
  pest:       { label: "Pest Control", variant: "destructive" },
  fertilize:  { label: "Fertilizing", variant: "secondary" },
  pruning:    { label: "Pruning", variant: "outline" },
  grading:    { label: "Grading", variant: "outline" },
  move:       { label: "Move", variant: "secondary" },
  stage:      { label: "Stage", variant: "default" },
  treatment:  { label: "Treatment", variant: "destructive" },
  scout_flag: { label: "Scout Flag", variant: "destructive" },
  measurement:{ label: "Measurement", variant: "outline" },
  clearance:  { label: "Clearance", variant: "default" },
  health:     { label: "Health Log", variant: "secondary" },
  action:     { label: "Action", variant: "outline" },
  // Quantity-related events
  picked:     { label: "Picked (Sale)", variant: "destructive" },
  loss:       { label: "Loss", variant: "destructive" },
  transplant_to: { label: "Transplant Out", variant: "secondary" },
  transplant_from: { label: "Transplant In", variant: "default" },
  adjustment: { label: "Adjustment", variant: "outline" },
  status_change: { label: "Status Change", variant: "default" },
  create:     { label: "Created", variant: "default" },
  checkin:    { label: "Check In", variant: "default" },
};

export function HistoryLog({ logs }: { logs: HistoryLog[] }) {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<string>("");

  const filtered = logs.filter(l => {
    const t = type ? l.type === type : true;
    const s = q ? (l.title?.toLowerCase().includes(q.toLowerCase()) || l.details?.toLowerCase().includes(q.toLowerCase())) : true;
    return t && s;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          placeholder="Search notes..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm flex-1 min-w-[150px]"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
        >
          <option value="">All types</option>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="text-xs text-muted-foreground">{filtered.length} of {logs.length}</div>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">Date</TableHead>
              <TableHead className="w-[110px]">Type</TableHead>
              <TableHead className="w-[70px] text-right">Qty</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[80px] text-right">By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No history entries found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => {
                const meta = TYPE_META[l.type] || { label: l.type || "Action", variant: "outline" as const };
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.at).toLocaleDateString()}
                      <br />
                      <span className="text-[10px]">{new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant} className="text-xs">
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {l.quantity !== undefined && l.quantity !== null && l.quantity !== 0 ? (
                        <span className={l.quantity > 0 ? "text-green-600" : "text-red-600"}>
                          {l.quantity > 0 ? "+" : ""}{l.quantity}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{l.title}</div>
                        {l.details && (
                          <div className="text-xs text-muted-foreground line-clamp-2">{l.details}</div>
                        )}
                        {l.media?.length ? (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {l.media.map((m, i) => (
                              <a
                                key={i}
                                href={m.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {m.name ?? `file-${i + 1}`}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {l.userName ?? l.userId ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
