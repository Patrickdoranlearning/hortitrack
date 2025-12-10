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

type EventRow = {
  id: string;
  type: string;
  created_at: string;
  by_user_id: string;
  payload: any;
  at?: string | null;
};

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
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead className="w-[200px]">When</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="font-medium">{ev.type}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(ev.at || ev.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {ev.payload ? (
                      <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
