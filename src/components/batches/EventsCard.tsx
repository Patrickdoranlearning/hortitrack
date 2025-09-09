"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";

type EventRow = {
  id: string;
  type: string;
  created_at: string;
  by_user_id: string;
  payload: any;
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
      <div className="space-y-2">
        {items.length === 0 && <div className="text-sm text-muted-foreground">No events yet.</div>}
        {items.map(ev => (
          <div key={ev.id} className="rounded-md border p-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="font-medium">{ev.type}</span>
              <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</span>
            </div>
            {ev.payload && (
              <pre className="mt-2 text-xs overflow-auto bg-muted p-2 rounded">{JSON.stringify(ev.payload, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
