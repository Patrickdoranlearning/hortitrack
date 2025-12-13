"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type EventRow = {
  id: string;
  type: string;
  created_at: string;
  by_user_id: string;
  payload: any;
  at?: string | null;
};

// Event type metadata for display
const EVENT_TYPE_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  STATUS_CHANGE: { label: "Status Change", variant: "default" },
  PLAN_SPLIT: { label: "Plan Split", variant: "secondary" },
  batch_actualized: { label: "Actualized", variant: "default" },
  PICKED: { label: "Picked (Sale)", variant: "destructive" },
  TRANSPLANT_TO: { label: "Transplant Out", variant: "secondary" },
  TRANSPLANT_FROM: { label: "Transplant In", variant: "default" },
  LOSS: { label: "Loss", variant: "destructive" },
  ADJUSTMENT: { label: "Adjustment", variant: "outline" },
  GRADING: { label: "Grading", variant: "outline" },
  MOVE: { label: "Move", variant: "outline" },
  CHECKIN: { label: "Check In", variant: "default" },
  CREATE: { label: "Created", variant: "default" },
  PHOTO_ADDED: { label: "Photo Added", variant: "outline" },
  FLAG_CREATED: { label: "Flag Created", variant: "destructive" },
  FLAG_RESOLVED: { label: "Flag Resolved", variant: "default" },
};

// Format payload into human-readable details
function formatEventDetails(type: string, payload: any): { summary: string; quantity?: number } {
  if (!payload) return { summary: "—" };

  // Handle string payloads (double-encoded JSON)
  let data = payload;
  if (typeof payload === "string") {
    try {
      data = JSON.parse(payload);
    } catch {
      return { summary: payload };
    }
  }

  switch (type.toUpperCase()) {
    case "STATUS_CHANGE":
      if (data.status && data.status_display_name) {
        return { summary: `Changed to "${data.status_display_name}"` };
      }
      if (data.status) {
        return { summary: `Changed to "${data.status}"` };
      }
      if (data.newStatus && data.previousStatus) {
        return { summary: `${data.previousStatus} → ${data.newStatus}` };
      }
      break;

    case "PLAN_SPLIT":
      const parts: string[] = [];
      if (data.units_planned) parts.push(`${data.units_planned} units planned`);
      if (data.target_ready_date) parts.push(`Target: ${new Date(data.target_ready_date).toLocaleDateString()}`);
      if (data.parent_batch_id) parts.push(`From parent batch`);
      return { summary: parts.join(" • ") || "Plan created", quantity: data.units_planned };

    case "BATCH_ACTUALIZED":
      const actualParts: string[] = [];
      if (data.quantityActual) actualParts.push(`${data.quantityActual} units`);
      if (data.newStatus) actualParts.push(`Status: ${data.newStatus}`);
      return { summary: actualParts.join(" • ") || "Batch actualized", quantity: data.quantityActual };

    case "PICKED":
      const pickedParts: string[] = [];
      if (data.units_picked) pickedParts.push(`${data.units_picked} units picked for sale`);
      if (data.notes) pickedParts.push(data.notes);
      return { summary: pickedParts.join(" • ") || "Units picked", quantity: -data.units_picked };

    case "TRANSPLANT_TO":
      return {
        summary: `${data.qty || data.quantity || "?"} units transplanted out`,
        quantity: -(data.qty || data.quantity || 0)
      };

    case "TRANSPLANT_FROM":
      return {
        summary: `${data.qty || data.quantity || "?"} units transplanted in`,
        quantity: data.qty || data.quantity || 0
      };

    case "LOSS":
      const lossQty = Math.abs(data.qty || data.quantity || 0);
      return {
        summary: `${lossQty} units lost${data.reason ? `: ${data.reason}` : ""}`,
        quantity: -lossQty
      };

    case "ADJUSTMENT":
      const adjQty = data.qty || data.quantity || data.diff || 0;
      return {
        summary: `Quantity adjusted by ${adjQty > 0 ? "+" : ""}${adjQty}${data.reason ? `: ${data.reason}` : ""}`,
        quantity: adjQty
      };

    case "GRADING":
      return { summary: data.grade ? `Graded: ${data.grade}` : "Grading performed" };

    case "MOVE":
      if (data.from && data.to) {
        return { summary: `Moved from ${data.from} to ${data.to}` };
      }
      if (data.location || data.locationName) {
        return { summary: `Moved to ${data.location || data.locationName}` };
      }
      break;

    case "CHECKIN":
      return { summary: data.notes || "Checked in", quantity: data.quantity };

    case "CREATE":
      return { summary: `Batch created${data.quantity ? ` with ${data.quantity} units` : ""}`, quantity: data.quantity };

    case "PHOTO_ADDED":
      return { summary: data.caption || "Photo added" };

    case "FLAG_CREATED":
      return { summary: data.title || data.reason || "Issue flagged" };

    case "FLAG_RESOLVED":
      return { summary: data.resolution || "Issue resolved" };
  }

  // Fallback: try to extract meaningful info from common fields
  const fallbackParts: string[] = [];
  if (data.notes) fallbackParts.push(data.notes);
  if (data.reason) fallbackParts.push(data.reason);
  if (data.quantity || data.qty) {
    const q = data.quantity || data.qty;
    fallbackParts.push(`Qty: ${q}`);
    return { summary: fallbackParts.join(" • ") || "Event recorded", quantity: q };
  }

  if (fallbackParts.length > 0) {
    return { summary: fallbackParts.join(" • ") };
  }

  // Last resort: show truncated JSON
  const jsonStr = JSON.stringify(data);
  if (jsonStr.length > 100) {
    return { summary: jsonStr.substring(0, 100) + "..." };
  }
  return { summary: jsonStr };
}

export default function EventsCard({ batchId }: { batchId: string }) {
  const [items, setItems] = React.useState<EventRow[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(`/api/production/batches/${batchId}/events`);
        const j = await r.json();
        if (!cancel) {
          if (!r.ok) throw new Error(j?.error || r.statusText);
          setItems(j.items || []);
        }
      } catch (e: any) { if (!cancel) setErr(e?.message ?? String(e)); }
    })();
    return () => { cancel = true; };
  }, [batchId]);

  return (
    <Card className="p-4 space-y-3">
      <div className="font-semibold">Events</div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No events yet.</div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">Type</TableHead>
                <TableHead className="w-[140px]">When</TableHead>
                <TableHead className="w-[80px] text-right">Qty</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((ev) => {
                const meta = EVENT_TYPE_META[ev.type] || EVENT_TYPE_META[ev.type.toUpperCase()] || { label: ev.type, variant: "outline" as const };
                const { summary, quantity } = formatEventDetails(ev.type, ev.payload);

                return (
                  <TableRow key={ev.id}>
                    <TableCell>
                      <Badge variant={meta.variant} className="text-xs">
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(ev.at || ev.created_at).toLocaleDateString()}
                      <br />
                      <span className="text-[10px]">
                        {new Date(ev.at || ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {quantity !== undefined && quantity !== 0 ? (
                        <span className={quantity > 0 ? "text-green-600" : "text-red-600"}>
                          {quantity > 0 ? "+" : ""}{quantity}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {summary}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
