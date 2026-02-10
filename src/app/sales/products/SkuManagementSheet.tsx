"use client";

import { useState, useTransition } from "react";
import { emitMutation } from "@/lib/events/mutation-events";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Search, Check, AlertCircle } from "lucide-react";
import { toast } from "@/lib/toast";
import { createSkuAction, updateSkuConfigAction } from "./actions";
import type { ProductManagementPayload, ProductSkuOption } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skus: ProductSkuOption[];
  plantVarieties: ProductManagementPayload["plantVarieties"];
  plantSizes: ProductManagementPayload["plantSizes"];
  onSkuCreated?: (sku: ProductSkuOption) => void;
};

const defaultForm = {
  code: "",
  displayName: "",
  description: "",
  barcode: "",
  vatRate: "13.5",
};

export default function SkuManagementSheet({
  open,
  onOpenChange,
  skus,
  plantVarieties = [],
  plantSizes = [],
  onSkuCreated,
}: Props) {
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [pending, startTransition] = useTransition();
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);

  // Filter SKUs based on search
  const filteredSkus = skus.filter((sku) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      sku.code.toLowerCase().includes(query) ||
      sku.label.toLowerCase().includes(query) ||
      sku.displayName?.toLowerCase().includes(query)
    );
  });

  const handleCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.displayName.trim()) {
      toast.error("Display name required");
      return;
    }
    if (!form.barcode.trim()) {
      toast.error("Barcode required");
      return;
    }
    startTransition(async () => {
      const result = await createSkuAction({
        code: form.code.trim() || undefined,
        displayName: form.displayName.trim(),
        description: form.description.trim() || undefined,
        barcode: form.barcode.trim(),
        vatRate: Number(form.vatRate),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("SKU created successfully");
      const displayName = result.data.display_name || result.data.code;
      const newSku: ProductSkuOption = {
        id: result.data.id,
        code: result.data.code,
        label:
          displayName !== result.data.code
            ? `${displayName} • ${result.data.code}`
            : result.data.code,
        plantVarietyId: null,
        sizeId: null,
        defaultVatRate: result.data.default_vat_rate ?? null,
        displayName: result.data.display_name ?? null,
      };
      onSkuCreated?.(newSku);
      setForm(defaultForm);
      setActiveTab("list");
      emitMutation({ resource: 'products', action: 'create' });
    });
  };

  const handleUpdateSkuConfig = (
    skuId: string,
    varietyId: string | null,
    sizeId: string | null
  ) => {
    setEditingSkuId(skuId);
    startTransition(async () => {
      const result = await updateSkuConfigAction({
        skuId,
        plantVarietyId: varietyId,
        sizeId: sizeId,
      });
      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success("SKU updated");
        emitMutation({ resource: 'products', action: 'update', id: skuId });
      }
      setEditingSkuId(null);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>SKU Management</SheetTitle>
          <SheetDescription>
            View, create, and configure SKUs for trolley calculation and batch
            linking.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="mt-6"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">SKU List ({skus.length})</TabsTrigger>
            <TabsTrigger value="create">
              <Plus className="mr-1.5 h-4 w-4" />
              New SKU
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search SKUs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* SKU Table */}
            {filteredSkus.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {searchQuery
                  ? "No SKUs match your search."
                  : "No SKUs created yet."}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Variety</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="w-[80px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSkus.map((sku) => {
                      const isEditing = editingSkuId === sku.id;
                      const isConfigured = sku.plantVarietyId && sku.sizeId;
                      const varietyName = plantVarieties?.find(
                        (v) => v.id === sku.plantVarietyId
                      )?.name;
                      const sizeName = plantSizes?.find(
                        (s) => s.id === sku.sizeId
                      )?.name;

                      return (
                        <TableRow key={sku.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sku.code}</p>
                              {sku.displayName && sku.displayName !== sku.code && (
                                <p className="text-xs text-muted-foreground">
                                  {sku.displayName}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={sku.plantVarietyId || "__none__"}
                              onValueChange={(value) => {
                                const newVarietyId =
                                  value === "__none__" ? null : value;
                                handleUpdateSkuConfig(
                                  sku.id,
                                  newVarietyId,
                                  sku.sizeId
                                );
                              }}
                              disabled={isEditing}
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue placeholder="Select...">
                                  {isEditing ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : varietyName ? (
                                    <span className="truncate">
                                      {varietyName}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      Not set
                                    </span>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                <SelectItem value="__none__">Not set</SelectItem>
                                {plantVarieties?.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={sku.sizeId || "__none__"}
                              onValueChange={(value) => {
                                const newSizeId =
                                  value === "__none__" ? null : value;
                                handleUpdateSkuConfig(
                                  sku.id,
                                  sku.plantVarietyId,
                                  newSizeId
                                );
                              }}
                              disabled={isEditing}
                            >
                              <SelectTrigger className="h-8 w-[120px]">
                                <SelectValue placeholder="Select...">
                                  {isEditing ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : sizeName ? (
                                    <span className="truncate">{sizeName}</span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      Not set
                                    </span>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Not set</SelectItem>
                                {plantSizes?.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {isConfigured ? (
                              <Badge
                                variant="outline"
                                className="text-green-700 border-green-300"
                              >
                                <Check className="mr-1 h-3 w-3" />
                                OK
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-amber-700 border-amber-300"
                              >
                                <AlertCircle className="mr-1 h-3 w-3" />
                                Setup
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Summary */}
            {skus.length > 0 && (
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>
                  {skus.filter((s) => s.plantVarietyId && s.sizeId).length} of{" "}
                  {skus.length} configured
                </span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="create">
            <form className="space-y-4" onSubmit={handleCreateSubmit}>
              <div className="space-y-1.5">
                <Label>SKU code (optional)</Label>
                <Input
                  placeholder="auto-generated if empty"
                  value={form.code}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for auto-generated code like SKU-0001
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Display name *</Label>
                <Input
                  placeholder="e.g., 1.5L Mixed Heather"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, displayName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  placeholder="Optional description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Barcode *</Label>
                  <Input
                    required
                    placeholder="Scan or type barcode"
                    value={form.barcode}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, barcode: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Default VAT rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={form.vatRate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, vatRate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm(defaultForm);
                    setActiveTab("list");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create SKU
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
