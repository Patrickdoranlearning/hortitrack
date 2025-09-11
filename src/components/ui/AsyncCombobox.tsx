"use client";

import * as React from "react";
import { Controller, type Control } from "react-hook-form";
import { Combobox } from "@/components/ui/combobox";

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
  const [loading, setLoading] = React.useState(true);

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
      } finally {
        if (!cancelled) setLoading(false);
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
        <Combobox
          options={items.map((it) => ({
            value: String(it[valueField]),
            label: String(it[labelField] ?? it[valueField]),
          }))}
          value={field.value}
          onChange={field.onChange}
          placeholder={loading ? `Loading ${resource}...` : placeholder}
          disabled={loading}
        />
      )}
    />
  );
}
