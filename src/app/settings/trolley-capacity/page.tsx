'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Loader2, PlusCircle, Pencil, Trash2, Package, AlertCircle } from 'lucide-react';
import { PageFrame } from '@/ui/templates';
import { useToast } from '@/hooks/use-toast';
import { TROLLEY_CONSTANTS } from '@/lib/dispatch/trolley-calculation';

// ================================================
// TYPES
// ================================================

type TrolleyCapacityRecord = {
  id: string;
  orgId: string;
  family: string | null;
  sizeId: string | null;
  sizeName: string | null;
  shelvesPerTrolley: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlantSize = {
  id: string;
  name: string;
  shelfQuantity: number | null;
  containerType: string;
};

type FormData = {
  id?: string;
  family: string | null;
  sizeId: string | null;
  shelvesPerTrolley: number;
  notes: string;
};

const EMPTY_FORM: FormData = {
  family: null,
  sizeId: null,
  shelvesPerTrolley: 6,
  notes: '',
};

// ================================================
// COMPONENT
// ================================================

export default function TrolleyCapacityPage() {
  const [configs, setConfigs] = useState<TrolleyCapacityRecord[]>([]);
  const [families, setFamilies] = useState<string[]>([]);
  const [sizes, setSizes] = useState<PlantSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dispatch/trolley-capacity?includeRefData=true');
      const data = await res.json();

      if (data.ok) {
        setConfigs(data.configs || []);
        setFamilies(data.families || []);
        setSizes(data.sizes || []);
      } else {
        throw new Error(data.error || 'Failed to load');
      }
    } catch (err) {
      console.error('Error fetching trolley capacity data:', err);
      toast({
        title: 'Error',
        description: 'Failed to load trolley capacity settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate holes per shelf for display
  const holesPerShelf = (shelvesPerTrolley: number) =>
    Math.ceil(TROLLEY_CONSTANTS.STANDARD_HOLES / shelvesPerTrolley);

  // Handle form submission
  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/dispatch/trolley-capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formData.id,
          family: formData.family || null,
          sizeId: formData.sizeId || null,
          shelvesPerTrolley: formData.shelvesPerTrolley,
          notes: formData.notes || null,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        toast({
          title: 'Saved',
          description: isEditing
            ? 'Trolley capacity updated'
            : 'Trolley capacity configuration added',
        });
        setDialogOpen(false);
        setFormData(EMPTY_FORM);
        setIsEditing(false);
        fetchData();
      } else {
        throw new Error(data.error || 'Save failed');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/dispatch/trolley-capacity?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.ok) {
        toast({
          title: 'Deleted',
          description: 'Configuration removed',
        });
        setDeleteConfirmId(null);
        fetchData();
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  // Open edit dialog
  const openEdit = (config: TrolleyCapacityRecord) => {
    setFormData({
      id: config.id,
      family: config.family,
      sizeId: config.sizeId,
      shelvesPerTrolley: config.shelvesPerTrolley,
      notes: config.notes || '',
    });
    setIsEditing(true);
    setDialogOpen(true);
  };

  // Open add dialog
  const openAdd = () => {
    setFormData(EMPTY_FORM);
    setIsEditing(false);
    setDialogOpen(true);
  };

  // Get display label for a config
  const getConfigLabel = (config: TrolleyCapacityRecord) => {
    if (!config.family && !config.sizeId) return 'Global Default';
    if (!config.family) return `All families - ${config.sizeName || 'Unknown size'}`;
    if (!config.sizeId) return `${config.family} - All sizes`;
    return `${config.family} - ${config.sizeName || 'Unknown size'}`;
  };

  // Get priority badge
  const getPriorityBadge = (config: TrolleyCapacityRecord) => {
    if (config.family && config.sizeId) {
      return <Badge variant="default">Exact Match</Badge>;
    }
    if (config.family) {
      return <Badge variant="secondary">Family Default</Badge>;
    }
    if (config.sizeId) {
      return <Badge variant="secondary">Size Default</Badge>;
    }
    return <Badge variant="outline">Global</Badge>;
  };

  return (
    <PageFrame moduleKey="settings">
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-headline text-3xl">Trolley Capacity</h1>
            <p className="text-muted-foreground mt-1">
              Configure how many shelves fit on a trolley for each plant family and pot size
              combination. This is used to estimate trolleys needed for orders.
            </p>
          </div>
          <Button onClick={openAdd}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Configuration
          </Button>
        </div>

        {/* Info card */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  How trolley calculation works
                </p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  A standard trolley has {TROLLEY_CONSTANTS.STANDARD_HOLES} hole positions for shelf
                  placement. Taller plants need more holes between shelves, meaning fewer shelves
                  fit. The system uses the formula:{' '}
                  <span className="font-mono">
                    holes per shelf = {TROLLEY_CONSTANTS.STANDARD_HOLES} / shelves per trolley
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configs table */}
        <Card>
          <CardHeader>
            <CardTitle>Capacity Configurations</CardTitle>
            <CardDescription>
              More specific configurations take priority over general ones (exact match &gt; family
              default &gt; size default &gt; global)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/50">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No configurations yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add your first configuration to enable automatic trolley estimation
                </p>
                <Button variant="outline" className="mt-4" onClick={openAdd}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Configuration
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Configuration</TableHead>
                      <TableHead className="hidden sm:table-cell">Priority</TableHead>
                      <TableHead className="text-center">Shelves / Trolley</TableHead>
                      <TableHead className="text-center hidden md:table-cell">Holes / Shelf</TableHead>
                      <TableHead className="hidden md:table-cell">Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">{getConfigLabel(config)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{getPriorityBadge(config)}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-lg font-bold">{config.shelvesPerTrolley}</span>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground hidden md:table-cell">
                        {holesPerShelf(config.shelvesPerTrolley)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate hidden md:table-cell">
                        {config.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(config)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(config.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isEditing ? 'Edit Configuration' : 'Add Configuration'}
              </DialogTitle>
              <DialogDescription>
                Configure how many shelves fit on a trolley for a specific family and size
                combination.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Family select */}
              <div className="space-y-2">
                <Label>Plant Family</Label>
                <Select
                  value={formData.family || '__all__'}
                  onValueChange={(val) =>
                    setFormData((prev) => ({
                      ...prev,
                      family: val === '__all__' ? null : val,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All families" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All families (default)</SelectItem>
                    {families.map((family) => (
                      <SelectItem key={family} value={family}>
                        {family}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Leave as "All families" to create a default for all plant families
                </p>
              </div>

              {/* Size select */}
              <div className="space-y-2">
                <Label>Pot Size</Label>
                <Select
                  value={formData.sizeId || '__all__'}
                  onValueChange={(val) =>
                    setFormData((prev) => ({
                      ...prev,
                      sizeId: val === '__all__' ? null : val,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All sizes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All sizes (default)</SelectItem>
                    {sizes.map((size) => (
                      <SelectItem key={size.id} value={size.id}>
                        {size.name}
                        {size.shelfQuantity && (
                          <span className="text-muted-foreground ml-2">
                            ({size.shelfQuantity}/shelf)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Leave as "All sizes" to create a default for all pot sizes
                </p>
              </div>

              {/* Shelves per trolley slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Shelves per Trolley</Label>
                  <span className="text-2xl font-bold">{formData.shelvesPerTrolley}</span>
                </div>
                <Slider
                  value={[formData.shelvesPerTrolley]}
                  onValueChange={([val]) =>
                    setFormData((prev) => ({ ...prev, shelvesPerTrolley: val }))
                  }
                  min={1}
                  max={16}
                  step={1}
                  className="py-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 (very tall plants)</span>
                  <span>16 (propagation trays)</span>
                </div>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  With {formData.shelvesPerTrolley} shelves, each shelf uses{' '}
                  <span className="font-medium">{holesPerShelf(formData.shelvesPerTrolley)}</span>{' '}
                  hole positions on the trolley
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g., Tall grasses, requires extra spacing"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Configuration</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this trolley capacity configuration? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageFrame>
  );
}
