"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export function PrintLabelsButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    try {
      setLoading(true);
      const res = await fetch(`/api/sales/orders/${orderId}/labels/print`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.error?.message || "Print failed");
      toast.success(`${j.data.printed} line(s) sent to printer`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return <Button onClick={onClick} disabled={loading}>{loading ? "Printing…" : "Print Labels"}</Button>;
}
