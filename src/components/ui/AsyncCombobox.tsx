"use client";

import * as React from "react";
import { Controller, type Control } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Item = Record<string, any>;

export default function AsyncCombobox<TFormValues>({
  name,
  control,
  resource,               // "varieties" | "sizes" | "locations" | "suppliers"
  valueField = "id",
  labelField = "name",
  placeholder = "Select…",
  onLoaded,
}: {
  name: string;
  control: Control<TFormValues>;
  resource: "varieties" | "sizes" | "locations" | "suppliers";
  valueField?: string;
  labelField?: string;
  placeholder?: string;
  onLoaded?: (items: Item[]) => void;
}) {
  const [items, setItems] = React.useState<Item[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/lookups/${resource}`);
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;

        if (r.status === 401) {
          setError("Sign in required to load this list.");
          setItems([]);
          return;
        }
        if (!r.ok) {
          setError(j?.error || r.statusText || "Failed to load");
          setItems([]);
          return;
        }
        setItems(j?.items ?? []);
        onLoaded?.(j?.items ?? []);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? String(e));
          setItems([]);
        }
        console.error(`[AsyncCombobox:${resource}] load error`, e);
      }
    })();
    return () => { cancelled = true; };
  }, [resource]);

  if (error) {
    return <div className="text-sm text-red-600">Failed to load {resource}: {error}</div>;
  }

  return (
    <Controller
      control={control}
      name={name as any}
      render={({ field }) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            {items.map((it) => (
              <SelectItem key={String(it[valueField])} value={String(it[valueField])}>
                {String(it[labelField] ?? it[valueField])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
