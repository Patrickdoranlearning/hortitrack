"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function PrintLabelsButton({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    try {
      setLoading(true);
      const res = await fetch(`/api/sales/orders/${orderId}/labels/print`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error?.message || "Print failed");
      toast({ title: "Labels sent", description: `${j.data.printed} line(s)` });
    } catch (e: any) {
      toast({ title: "Print error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return <Button onClick={onClick} disabled={loading}>{loading ? "Printing…" : "Print Labels"}</Button>;
}
