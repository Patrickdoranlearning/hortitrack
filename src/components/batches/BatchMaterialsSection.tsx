"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, AlertTriangle, ChevronDown, ChevronUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaterialSearchCombobox, type MaterialSearchResult } from "@/components/materials/MaterialSearchCombobox";
import type { PlannedMaterialInput } from "@/app/production/forms/propagation-schema";

type ConsumptionPreviewItem = {
  materialId: string;
  materialName: string;
  partNumber: string;
  baseUom: string;
  quantityRequired: number;
  quantityAvailable: number;
  isShortage: boolean;
};

interface BatchMaterialsSectionProps {
  sizeId: string;
  quantity: number;
  materials: PlannedMaterialInput[];
  onChange: (materials: PlannedMaterialInput[]) => void;
}

export function BatchMaterialsSection({
  sizeId,
  quantity,
  materials,
  onChange,
}: BatchMaterialsSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [stockLevels, setStockLevels] = useState<Map<string, { available: number; shortage: boolean }>>(new Map());

  // Fetch consumption preview when sizeId or quantity changes
  const fetchPreview = useCallback(async () => {
    if (!sizeId || !quantity || quantity <= 0) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        sizeId,
        quantity: String(quantity),
      });
      const res = await fetch(`/api/materials/consumption/preview?${params}`);
      if (!res.ok) return;

      const data: ConsumptionPreviewItem[] = await res.json();

      // Auto-populate materials if none exist yet
      if (materials.length === 0 && data.length > 0) {
        const suggested: PlannedMaterialInput[] = data.map((item) => ({
          material_id: item.materialId,
          name: item.materialName,
          part_number: item.partNumber,
          category_code: "",
          base_uom: item.baseUom,
          quantity: item.quantityRequired,
        }));
        onChange(suggested);
      }

      // Update stock levels
      const newStockLevels = new Map<string, { available: number; shortage: boolean }>();
      for (const item of data) {
        newStockLevels.set(item.materialId, {
          available: item.quantityAvailable,
          shortage: item.isShortage,
        });
      }
      setStockLevels(newStockLevels);
    } catch {
      // Silently fail preview
    } finally {
      setLoading(false);
    }
  }, [sizeId, quantity, materials.length, onChange]);

  useEffect(() => {
    fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeId, quantity]);

  const handleAddMaterial = (result: MaterialSearchResult | null) => {
    if (!result) return;
    // Don't add duplicates
    if (materials.some((m) => m.material_id === result.id)) {
      setAddingMaterial(false);
      return;
    }

    const newMaterial: PlannedMaterialInput = {
      material_id: result.id,
      name: result.name,
      part_number: result.part_number,
      category_code: result.parent_group ?? "",
      base_uom: result.base_uom,
      quantity: quantity > 0 ? quantity : 1,
    };

    onChange([...materials, newMaterial]);
    setAddingMaterial(false);
  };

  const handleRemoveMaterial = (materialId: string) => {
    onChange(materials.filter((m) => m.material_id !== materialId));
  };

  const handleQuantityChange = (materialId: string, newQty: number) => {
    onChange(
      materials.map((m) =>
        m.material_id === materialId ? { ...m, quantity: newQty } : m
      )
    );
  };

  const hasShortages = materials.some((m) => {
    const stock = stockLevels.get(m.material_id);
    return stock && stock.available < m.quantity;
  });

  return (
    <Card className="col-span-2">
      <CardHeader
        className="pb-3 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Materials
            {materials.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {materials.length}
              </Badge>
            )}
            {hasShortages && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Stock shortage
              </Badge>
            )}
          </CardTitle>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-0 space-y-3">
          {loading && materials.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Loading suggested materials...
            </p>
          )}

          {/* Material rows */}
          {materials.map((mat) => {
            const stock = stockLevels.get(mat.material_id);
            const isShortage = stock ? stock.available < mat.quantity : false;

            return (
              <div
                key={mat.material_id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {mat.name}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {mat.part_number}
                    </Badge>
                  </div>
                  {stock && (
                    <p
                      className={`text-xs mt-0.5 ${
                        isShortage
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {isShortage && (
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                      )}
                      Available: {stock.available.toLocaleString()} {mat.base_uom}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={mat.quantity}
                    onChange={(e) =>
                      handleQuantityChange(
                        mat.material_id,
                        Math.max(1, Number(e.target.value) || 1)
                      )
                    }
                    className="w-24 text-right"
                  />
                  <span className="text-xs text-muted-foreground w-10">
                    {mat.base_uom}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveMaterial(mat.material_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Add material */}
          {addingMaterial ? (
            <div className="space-y-2">
              <MaterialSearchCombobox
                sizeId={sizeId}
                value={null}
                onChange={handleAddMaterial}
                placeholder="Search materials..."
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAddingMaterial(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setAddingMaterial(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Material
            </Button>
          )}

          {materials.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground text-center py-2">
              {sizeId
                ? "No materials linked to this size. Add materials manually."
                : "Select a size to auto-suggest materials."}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
