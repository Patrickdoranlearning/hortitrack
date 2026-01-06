'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Check,
  ChevronsUpDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Package,
  Layers,
  SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReferenceData } from '@/contexts/ReferenceDataContext';
import type { PlannedPropagationEntry } from './PlanPropagationStep';
import type { PlannedTransplantEntry } from './ConfigureTransplantsStep';

// Material from reference data
type MaterialRef = NonNullable<ReferenceData['materials']>[number];

export type PlannedMaterialEntry = {
  id: string;          // temp ID for UI
  batchTempId: string; // links to batch in wizard state
  materialId: string;
  materialName: string;
  categoryName: string;
  parentGroup: string;
  quantity: number;
  uom: string;
  notes?: string;
};

export type ConfigureMaterialsStepData = {
  materials: PlannedMaterialEntry[];
  skipMaterials: boolean;
};

type ConfigureMaterialsStepProps = {
  referenceData: ReferenceData;
  // Either propagation or transplant batches from previous step
  propagationBatches?: PlannedPropagationEntry[];
  transplantBatches?: PlannedTransplantEntry[];
  initialData: ConfigureMaterialsStepData | null;
  onComplete: (data: ConfigureMaterialsStepData) => void;
  onBack: () => void;
};

export function ConfigureMaterialsStep({
  referenceData,
  propagationBatches,
  transplantBatches,
  initialData,
  onComplete,
  onBack,
}: ConfigureMaterialsStepProps) {
  const [materials, setMaterials] = useState<PlannedMaterialEntry[]>(
    initialData?.materials ?? []
  );

  // Determine batch list based on what was passed
  const batches = useMemo(() => {
    if (propagationBatches && propagationBatches.length > 0) {
      return propagationBatches.map((b) => ({
        id: b.id,
        name: b.varietyName,
        sizeName: b.sizeName,
        sizeId: b.sizeId,
        quantity: b.expectedQuantity,
        family: b.varietyFamily,
      }));
    }
    if (transplantBatches && transplantBatches.length > 0) {
      return transplantBatches.map((t) => ({
        id: t.id,
        name: `${t.sourceBatchNumber} → ${t.targetSizeName}`,
        sizeName: t.targetSizeName,
        sizeId: t.targetSizeId,
        quantity: t.quantity,
        family: t.varietyFamily,
      }));
    }
    return [];
  }, [propagationBatches, transplantBatches]);

  // Get available materials from reference data
  const availableMaterials = useMemo(() => {
    return referenceData.materials ?? [];
  }, [referenceData.materials]);

  // Group materials by parent group
  const materialsByGroup = useMemo(() => {
    const groups: Record<string, MaterialRef[]> = {
      Containers: [],
      'Growing Media': [],
    };
    availableMaterials.forEach((m) => {
      const group = m.parent_group ?? 'Other';
      if (groups[group]) {
        groups[group].push(m);
      }
    });
    return groups;
  }, [availableMaterials]);

  // State for adding new material
  const [addingForBatchId, setAddingForBatchId] = useState<string | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [materialQuantity, setMaterialQuantity] = useState<number>(1);
  const [materialPopoverOpen, setMaterialPopoverOpen] = useState(false);

  // Get materials already added for a batch
  const getMaterialsForBatch = useCallback(
    (batchId: string) => materials.filter((m) => m.batchTempId === batchId),
    [materials]
  );

  // Get suggested materials based on batch size (using linked_size_id)
  const getSuggestedMaterials = useCallback(
    (sizeId: string) => {
      return availableMaterials.filter((m) => m.linked_size_id === sizeId);
    },
    [availableMaterials]
  );

  // Add material to a batch
  const handleAddMaterial = useCallback(() => {
    if (!addingForBatchId || !selectedMaterialId || materialQuantity <= 0) return;

    const material = availableMaterials.find((m) => m.id === selectedMaterialId);
    if (!material) return;

    // Check if this material already exists for this batch
    const existing = materials.find(
      (m) => m.batchTempId === addingForBatchId && m.materialId === selectedMaterialId
    );
    if (existing) {
      // Update quantity instead
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === existing.id
            ? { ...m, quantity: m.quantity + materialQuantity }
            : m
        )
      );
    } else {
      const entry: PlannedMaterialEntry = {
        id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        batchTempId: addingForBatchId,
        materialId: material.id,
        materialName: material.name,
        categoryName: material.category_name ?? 'Unknown',
        parentGroup: material.parent_group ?? 'Other',
        quantity: materialQuantity,
        uom: material.base_uom,
      };
      setMaterials((prev) => [...prev, entry]);
    }

    // Reset form
    setSelectedMaterialId('');
    setMaterialQuantity(1);
    setAddingForBatchId(null);
  }, [addingForBatchId, selectedMaterialId, materialQuantity, availableMaterials, materials]);

  // Remove material
  const removeMaterial = useCallback((materialEntryId: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== materialEntryId));
  }, []);

  // Update material quantity
  const updateMaterialQuantity = useCallback((materialEntryId: string, quantity: number) => {
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === materialEntryId ? { ...m, quantity: Math.max(1, quantity) } : m
      )
    );
  }, []);

  // Handle skip (no materials needed)
  const handleSkip = () => {
    onComplete({ materials: [], skipMaterials: true });
  };

  // Handle continue with materials
  const handleContinue = () => {
    onComplete({ materials, skipMaterials: false });
  };

  // Summary stats
  const totalMaterialEntries = materials.length;
  const batchesWithMaterials = new Set(materials.map((m) => m.batchTempId)).size;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Configure Materials
                <Badge variant="outline" className="ml-2 font-normal text-xs">Optional</Badge>
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Specify containers and growing media for your planned batches.
                This step is optional - skip if materials aren&apos;t needed.
              </p>
            </div>
            <Button variant="outline" onClick={handleSkip}>
              <SkipForward className="h-4 w-4 mr-2" />
              Skip
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Badge */}
      {totalMaterialEntries > 0 && (
        <div className="flex items-center gap-4">
          <Badge variant="default" className="text-sm">
            {totalMaterialEntries} material{totalMaterialEntries !== 1 ? 's' : ''} planned
            for {batchesWithMaterials} batch{batchesWithMaterials !== 1 ? 'es' : ''}
          </Badge>
        </div>
      )}

      {/* Batch Cards with Materials */}
      <div className="space-y-4">
        {batches.map((batch) => {
          const batchMaterials = getMaterialsForBatch(batch.id);
          const suggestedMaterials = getSuggestedMaterials(batch.sizeId);
          const isAddingForThisBatch = addingForBatchId === batch.id;

          return (
            <Card key={batch.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  <span className="font-medium">{batch.name}</span>
                  <span className="text-muted-foreground font-normal">
                    · {batch.sizeName} · {batch.quantity.toLocaleString()} units
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Materials Table for this batch */}
                {batchMaterials.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="w-[120px]">Quantity</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchMaterials.map((mat) => (
                        <TableRow key={mat.id}>
                          <TableCell className="font-medium">{mat.materialName}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                mat.parentGroup === 'Containers'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-green-50 text-green-700 border-green-200'
                              )}
                            >
                              {mat.categoryName}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={1}
                                value={mat.quantity}
                                onChange={(e) =>
                                  updateMaterialQuantity(mat.id, parseInt(e.target.value) || 1)
                                }
                                className="w-20 h-8"
                              />
                              <span className="text-sm text-muted-foreground">{mat.uom}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeMaterial(mat.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* Add Material Form */}
                {isAddingForThisBatch ? (
                  <div className="flex items-end gap-3 p-3 bg-muted/30 rounded-lg">
                    {/* Material Selector */}
                    <div className="flex-1 space-y-2">
                      <Label>Material</Label>
                      <Popover open={materialPopoverOpen} onOpenChange={setMaterialPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'w-full justify-between',
                              !selectedMaterialId && 'text-muted-foreground'
                            )}
                          >
                            {selectedMaterialId
                              ? availableMaterials.find((m) => m.id === selectedMaterialId)?.name
                              : 'Select material...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[300px]" align="start">
                          <Command>
                            <CommandInput placeholder="Search materials..." />
                            <CommandList>
                              <CommandEmpty>No material found.</CommandEmpty>
                              {/* Suggested Materials */}
                              {suggestedMaterials.length > 0 && (
                                <CommandGroup heading="Suggested (linked to size)">
                                  {suggestedMaterials.map((m) => (
                                    <CommandItem
                                      key={`suggested-${m.id}`}
                                      value={`${m.name}-suggested`}
                                      onSelect={() => {
                                        setSelectedMaterialId(m.id);
                                        setMaterialPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          selectedMaterialId === m.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      <span className="font-medium">{m.name}</span>
                                      <span className="ml-2 text-muted-foreground text-xs">
                                        {m.category_name}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                              {/* Containers */}
                              {materialsByGroup.Containers.length > 0 && (
                                <CommandGroup heading="Containers">
                                  {materialsByGroup.Containers.map((m) => (
                                    <CommandItem
                                      key={m.id}
                                      value={m.name}
                                      onSelect={() => {
                                        setSelectedMaterialId(m.id);
                                        setMaterialPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          selectedMaterialId === m.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      {m.name}
                                      <span className="ml-2 text-muted-foreground text-xs">
                                        {m.category_name}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                              {/* Growing Media */}
                              {materialsByGroup['Growing Media'].length > 0 && (
                                <CommandGroup heading="Growing Media">
                                  {materialsByGroup['Growing Media'].map((m) => (
                                    <CommandItem
                                      key={m.id}
                                      value={m.name}
                                      onSelect={() => {
                                        setSelectedMaterialId(m.id);
                                        setMaterialPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          selectedMaterialId === m.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      {m.name}
                                      <span className="ml-2 text-muted-foreground text-xs">
                                        {m.category_name}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Quantity */}
                    <div className="w-24 space-y-2">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        value={materialQuantity}
                        onChange={(e) => setMaterialQuantity(parseInt(e.target.value) || 1)}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAddingForBatchId(null);
                          setSelectedMaterialId('');
                          setMaterialQuantity(1);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleAddMaterial} disabled={!selectedMaterialId}>
                        Add
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => setAddingForBatchId(batch.id)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Material
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button type="button" onClick={handleContinue}>
          Next: Review
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

