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
import { Move, PlusCircle, RefreshCw, Save, Palette } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PageFrame } from '@/ui/templates';
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

type EditableOption = AttributeOptionInput & { attributeKey: AttributeKey; source?: "custom" | "default"; localId?: string; category?: string | null };

const BEHAVIOR_OPTIONS: { value: AttributeOption["behavior"]; label: string }[] = [
  { value: "growing", label: "Growing" },
  { value: "available", label: "Available for sale" },
  { value: "waste", label: "Waste / dumped" },
  { value: "archived", label: "Archived" },
];

// Preset colors for routes
const COLOR_PRESETS = [
  { color: "#ef4444", label: "Red" },
  { color: "#f97316", label: "Orange" },
  { color: "#eab308", label: "Yellow" },
  { color: "#22c55e", label: "Green" },
  { color: "#14b8a6", label: "Teal" },
  { color: "#3b82f6", label: "Blue" },
  { color: "#8b5cf6", label: "Purple" },
  { color: "#ec4899", label: "Pink" },
  { color: "#6b7280", label: "Gray" },
  { color: "#78716c", label: "Stone" },
  { color: "#0ea5e9", label: "Sky" },
  { color: "#a855f7", label: "Violet" },
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
        category: opt.category ?? null,
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
      category: meta.allowCategory ? (meta.categoryOptions?.[0] ?? null) : null,
      source: "custom",
    };
    setItems((prev) => [...prev, next]);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // UUID regex to validate real database IDs vs default placeholders
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Filter out options with empty display labels and validate
      const validItems = items.filter((opt) => opt.displayLabel && opt.displayLabel.trim().length > 0);
      if (validItems.length === 0) {
        throw new Error("At least one option with a display label is required");
      }

      const payload = validItems.map((opt, idx) => ({
        // Only send id if it's a valid UUID (not default placeholder IDs like "default-delivery_route-DUBLIN")
        id: opt.id && UUID_RE.test(opt.id) ? opt.id : undefined,
        systemCode: opt.systemCode?.trim() || undefined,
        displayLabel: opt.displayLabel.trim(),
        isActive: opt.isActive,
        behavior: opt.behavior,
        color: opt.color,
        category: opt.category,
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
    <PageFrame moduleKey="settings">
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
                        {meta.allowColor && (
                          <div className="mt-3">
                            <Label className="text-xs text-muted-foreground">Color</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full md:w-64 justify-start gap-2"
                                  >
                                    {opt.color ? (
                                      <>
                                        <div
                                          className="h-4 w-4 rounded border"
                                          style={{ backgroundColor: opt.color }}
                                        />
                                        <span>{opt.color}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Palette className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Choose color</span>
                                      </>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3" align="start">
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-6 gap-2">
                                      {COLOR_PRESETS.map((preset) => (
                                        <button
                                          key={preset.color}
                                          type="button"
                                          title={preset.label}
                                          className={`h-8 w-8 rounded-md border-2 transition-all hover:scale-110 ${
                                            opt.color === preset.color
                                              ? 'border-primary ring-2 ring-primary ring-offset-2'
                                              : 'border-transparent'
                                          }`}
                                          style={{ backgroundColor: preset.color }}
                                          onClick={() => {
                                            const next = [...items];
                                            next[idx] = { ...opt, color: preset.color };
                                            setItems(next);
                                            setDirty(true);
                                          }}
                                        />
                                      ))}
                                    </div>
                                    <Separator />
                                    <div className="flex items-center gap-2">
                                      <Label className="text-xs">Custom:</Label>
                                      <Input
                                        type="color"
                                        value={opt.color || "#3b82f6"}
                                        onChange={(e) => {
                                          const next = [...items];
                                          next[idx] = { ...opt, color: e.target.value };
                                          setItems(next);
                                          setDirty(true);
                                        }}
                                        className="h-8 w-12 p-1 cursor-pointer"
                                      />
                                      {opt.color && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const next = [...items];
                                            next[idx] = { ...opt, color: null };
                                            setItems(next);
                                            setDirty(true);
                                          }}
                                        >
                                          Clear
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        )}
                        {meta.allowCategory && meta.categoryOptions && (
                          <div className="mt-3">
                            <Label className="text-xs text-muted-foreground">Category</Label>
                            <Select
                              value={opt.category ?? ""}
                              onValueChange={(val) => {
                                const next = [...items];
                                next[idx] = { ...opt, category: val || null };
                                setItems(next);
                                setDirty(true);
                              }}
                            >
                              <SelectTrigger className="w-full md:w-64 mt-1">
                                <SelectValue placeholder="Choose category" />
                              </SelectTrigger>
                              <SelectContent>
                                {meta.categoryOptions.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
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

