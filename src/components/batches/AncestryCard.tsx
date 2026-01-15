"use client";
import * as React from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { fetchJson } from "@/lib/http";

type Link = { id: string; batch_number: string; proportion: number };

type AncestryData = { parents: Link[]; children: Link[] };

const fetcher = async (url: string): Promise<AncestryData> => {
  const { data } = await fetchJson<AncestryData>(url);
  return { parents: data?.parents || [], children: data?.children || [] };
};

export default function AncestryCard({ batchId }: { batchId: string }) {
  const { data, error } = useSWR(
    batchId ? `/api/production/batches/${batchId}/ancestry` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const parents = data?.parents || [];
  const children = data?.children || [];
  const err = error?.message || null;

  return (
    <Card className="p-4 space-y-3">
      <div className="font-semibold">Ancestry</div>
      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground mb-2">Parents</div>
          {parents.length === 0 && <div className="text-muted-foreground">None</div>}
          <ul className="space-y-1">
            {parents.map(p => (
              <li key={p.id} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{p.batch_number}</span>
                <span className="text-muted-foreground">{(p.proportion * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-muted-foreground mb-2">Children</div>
          {children.length === 0 && <div className="text-muted-foreground">None</div>}
          <ul className="space-y-1">
            {children.map(c => (
              <li key={c.id} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{c.batch_number}</span>
                <span className="text-muted-foreground">{(c.proportion * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
