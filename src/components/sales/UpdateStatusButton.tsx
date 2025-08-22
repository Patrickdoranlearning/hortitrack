"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const FLOW = ["confirmed", "picking", "ready", "dispatched", "delivered"] as const;

export function UpdateStatusButton({ orderId, current }: { orderId: string; current: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const idx = FLOW.indexOf(current as any);
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;

  async function setStatus(status: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/sales/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", status }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error?.message || "Update failed");
      toast({ title: "Status updated", description: `Now ${status}` });
      // simple refresh
      window.location.reload();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      {next && <Button onClick={() => setStatus(next)} disabled={loading}>Mark {next}</Button>}
      <Button variant="destructive" onClick={() => setStatus("void")} disabled={loading}>Void</Button>
    </div>
  );
}
