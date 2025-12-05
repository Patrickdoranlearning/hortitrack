"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Move, PlusCircle, RefreshCw, Save } from "lucide-react";
import { PageFrame } from "@/ui/templates/PageFrame";
import {
  ATTRIBUTE_META,
  type AttributeKey,
  type AttributeOption,
  type AttributeOptionInput,
  attributeKeys,
  defaultOptionsFor,
  normalizeSystemCode,
} from "@/lib/attributeOptions";
import { useAttributeOptions } from "@/hooks/useAttributeOptions";
import { useToast } from "@/hooks/use-toast";

type EditableOption = AttributeOptionInput & { attributeKey: AttributeKey; source?: "custom" | "default"; localId?: string };

const BEHAVIOR_OPTIONS: { value: AttributeOption["behavior"]; label: string }[] = [
  { value: "growing", label: "Growing" },
  { value: "available", label: "Available for sale" },
  { value: "waste", label: "Waste / dumped" },
  { value: "archived", label: "Archived" },
];

export default function DropdownManagerPage() {
  const [selectedKey, setSelectedKey] = React.useState<AttributeKey>("production_status");
  const { options: remoteOptions, source, loading, error, refresh } = useAttributeOptions(selectedKey, { includeInactive: true });
  const [items, setItems] = React.useState<EditableOption[]>([]);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const { toast } = useToast();

  // Sync local state when switching dropdown type or server data changes
  React.useEffect(() => {
    const next = (remoteOptions.length ? remoteOptions : defaultOptionsFor(selectedKey, true)).map(
      (opt): EditableOption => ({
        id: opt.id,
        attributeKey: selectedKey,
        systemCode: opt.systemCode,
        displayLabel: opt.displayLabel,
        isActive: opt.isActive,
        sortOrder: opt.sortOrder,
        behavior: opt.behavior,
        color: opt.color ?? null,
        source: opt.source,
        localId: opt.id ?? `${opt.systemCode}-${opt.sortOrder}`,
      })
    );
    // Prevent update if nothing materially changed (rudimentary check to stop loops)
    setItems(prev => {
      if (prev.length === next.length && prev.every((p, i) => p.localId === next[i].localId && p.displayLabel === next[i].displayLabel)) {
        return prev;
      }
      return next;
    });
    setDirty(false);
  }, [remoteOptions, selectedKey]);

  const meta = ATTRIBUTE_META[selectedKey];

  const handleReorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setDirty(true);
  };

  const handleAdd = () => {
    const systemCode = normalizeSystemCode(`NEW_${items.length + 1}`);
    const displayLabel = "New option";
    const next: EditableOption = {
      localId: `${systemCode}-${Date.now()}`,
      attributeKey: selectedKey,
      systemCode,
      displayLabel,
      isActive: true,
      sortOrder: items.length + 1,
      behavior: meta.requiresBehavior ? "growing" : null,
      color: null,
      source: "custom",
    };
    setItems((prev) => [...prev, next]);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = items.map((opt, idx) => ({
        id: opt.id, // only send persisted IDs
        systemCode: opt.systemCode,
        displayLabel: opt.displayLabel,
        isActive: opt.isActive,
        behavior: opt.behavior,
        color: opt.color,
        sortOrder: idx + 1,
      }));

      const res = await fetch(`/api/options/${selectedKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Save failed");
      }
      await refresh();
      setDirty(false);
      toast({ title: "Saved", description: "Dropdown options updated." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const next = defaultOptionsFor(selectedKey, true).map((opt) => ({
      ...opt,
      localId: opt.id,
    }));
    setItems(next);
    setDirty(true);
  };

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="settings">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-headline text-3xl">Dropdown Manager</h1>
          <p className="text-muted-foreground">
            Rename, reorder, hide, or add options per tenant. System codes stay stable; labels are editable.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Dropdowns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {attributeKeys().map((key) => {
                const metaItem = ATTRIBUTE_META[key];
                return (
                  <Button
                    key={key}
                    variant={key === selectedKey ? "default" : "ghost"}
                    className="w-full justify-between"
                    onClick={() => setSelectedKey(key)}
                  >
                    <span>{metaItem.label}</span>
                    {source === "default" && key === selectedKey ? <Badge variant="secondary">Default</Badge> : null}
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-lg">{meta.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{meta.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} disabled={saving}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset to defaults
                </Button>
                <Button onClick={handleSave} disabled={saving || !dirty || loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save changes
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading options…</p>
              ) : error ? (
                <p className="text-sm text-red-500">Failed to load options.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {items.map((opt, idx) => (
                      <div
                        key={opt.id ?? opt.localId ?? `${opt.systemCode}-${idx}`}
                        className="rounded-md border p-3 bg-card"
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null) {
                            handleReorder(dragIndex, idx);
                            setDragIndex(null);
                          }
                        }}
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                          <div className="flex items-center gap-2">
                            <Move className="h-4 w-4 text-muted-foreground" />
                            <div className="text-xs text-muted-foreground">#{idx + 1}</div>
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">Display label</Label>
                            <Input
                              value={opt.displayLabel}
                              onChange={(e) => {
                                const next = [...items];
                                next[idx] = { ...opt, displayLabel: e.target.value };
                                setItems(next);
                                setDirty(true);
                              }}
                            />
                            <div className="text-[11px] text-muted-foreground">
                              System key: <span className="font-mono">{opt.systemCode}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">Active</Label>
                            <Switch
                              checked={opt.isActive}
                              onCheckedChange={(checked) => {
                                const next = [...items];
                                next[idx] = { ...opt, isActive: checked };
                                setItems(next);
                                setDirty(true);
                              }}
                            />
                          </div>
                        </div>
                        {meta.requiresBehavior && (
                          <div className="mt-3">
                            <Label className="text-xs text-muted-foreground">System behavior</Label>
                            <Select
                              value={opt.behavior ?? "growing"}
                              onValueChange={(val) => {
                                const next = [...items];
                                next[idx] = { ...opt, behavior: val as any };
                                setItems(next);
                                setDirty(true);
                              }}
                            >
                              <SelectTrigger className="w-full md:w-64 mt-1">
                                <SelectValue placeholder="Choose behavior" />
                              </SelectTrigger>
                              <SelectContent>
                                {BEHAVIOR_OPTIONS.map((b) => (
                                  <SelectItem key={b.value} value={b.value ?? "growing"}>
                                    {b.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <Button variant="outline" onClick={handleAdd}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add option
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageFrame>
  );
}

