'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Loader2,
  PlusCircle,
  Pencil,
  Trash2,
  ArrowLeft,
  Boxes,
  AlertCircle,
} from 'lucide-react';
import { PageFrame } from '@/ui/templates';
import { toast } from '@/lib/toast';
import { supabaseClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ================================================
// TYPES
// ================================================

interface PlantSize {
  id: string;
  name: string;
}

interface CategorySizeLink {
  id: string;
  plant_size_id: string;
  plant_size: PlantSize | null;
}

interface SizeCategory {
  id: string;
  name: string;
  color: string | null;
  display_order: number;
  org_id: string;
  created_at: string;
  updated_at: string;
  picking_size_category_sizes: CategorySizeLink[];
}

interface CategoryFormData {
  id?: string;
  name: string;
  color: string;
  displayOrder: number;
  plantSizeIds: string[];
}

const EMPTY_FORM: CategoryFormData = {
  name: '',
  color: '#22c55e',
  displayOrder: 0,
  plantSizeIds: [],
};

const PRESET_COLORS = [
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Slate', value: '#64748b' },
];

// ================================================
// COMPONENT
// ================================================

export default function SizeCategoriesPage() {
  const [categories, setCategories] = useState<SizeCategory[]>([]);
  const [plantSizes, setPlantSizes] = useState<PlantSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch categories from API
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/picking/size-categories');
      const data = await res.json();

      if (res.ok) {
        setCategories(data.categories ?? []);
      } else {
        throw new Error(data.error || 'Failed to load categories');
      }
    } catch (err) {
      toast.error(err, { fallback: 'Failed to load size categories' });
    }
  }, []);

  // Fetch plant sizes from Supabase client
  const fetchPlantSizes = useCallback(async () => {
    try {
      const supabase = supabaseClient();
      const { data, error } = await supabase
        .from('plant_sizes')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      setPlantSizes(data ?? []);
    } catch (err) {
      toast.error(err, { fallback: 'Failed to load plant sizes' });
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchCategories(), fetchPlantSizes()]);
      setLoading(false);
    };
    loadData();
  }, [fetchCategories, fetchPlantSizes]);

  // Handle form submission (create or update)
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const method = isEditing ? 'PATCH' : 'POST';
      const payload = isEditing
        ? {
            id: formData.id,
            name: formData.name.trim(),
            color: formData.color || null,
            displayOrder: formData.displayOrder,
            plantSizeIds: formData.plantSizeIds,
          }
        : {
            name: formData.name.trim(),
            color: formData.color || null,
            displayOrder: formData.displayOrder,
            plantSizeIds: formData.plantSizeIds,
          };

      const res = await fetch('/api/picking/size-categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(isEditing ? 'Category updated' : 'Category created');
        setDialogOpen(false);
        setFormData(EMPTY_FORM);
        setIsEditing(false);
        await fetchCategories();
      } else {
        throw new Error(data.error || 'Save failed');
      }
    } catch (err) {
      toast.error(err, { fallback: 'Failed to save category' });
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/picking/size-categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Category deleted');
        setDeleteConfirmId(null);
        await fetchCategories();
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (err) {
      toast.error(err, { fallback: 'Failed to delete category' });
    }
  };

  // Open edit dialog
  const openEdit = (category: SizeCategory) => {
    setFormData({
      id: category.id,
      name: category.name,
      color: category.color || '#22c55e',
      displayOrder: category.display_order,
      plantSizeIds: category.picking_size_category_sizes.map(
        (link) => link.plant_size_id
      ),
    });
    setIsEditing(true);
    setDialogOpen(true);
  };

  // Open add dialog
  const openAdd = () => {
    setFormData({
      ...EMPTY_FORM,
      displayOrder: categories.length > 0
        ? Math.max(...categories.map((c) => c.display_order)) + 1
        : 0,
    });
    setIsEditing(false);
    setDialogOpen(true);
  };

  // Toggle a plant size in the form
  const togglePlantSize = (sizeId: string) => {
    setFormData((prev) => ({
      ...prev,
      plantSizeIds: prev.plantSizeIds.includes(sizeId)
        ? prev.plantSizeIds.filter((id) => id !== sizeId)
        : [...prev.plantSizeIds, sizeId],
    }));
  };

  return (
    <PageFrame moduleKey="production">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/settings">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Settings
                </Link>
              </Button>
            </div>
            <h1 className="font-headline text-3xl">Picking Size Categories</h1>
            <p className="text-muted-foreground mt-1">
              Group plant sizes into categories for bulk picking workflows. Each
              category can contain multiple plant sizes and is color-coded for
              easy identification.
            </p>
          </div>
          <Button onClick={openAdd}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>

        {/* Info card */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Boxes className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  How size categories work
                </p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  Size categories group similar plant sizes together for efficient picking.
                  For example, you might create a &quot;Small Pots&quot; category containing
                  9cm and 1L sizes, or a &quot;Trays&quot; category for all plug tray sizes.
                  Pickers can then be assigned to specific categories based on their expertise.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Categories table */}
        <Card>
          <CardHeader>
            <CardTitle>Size Categories</CardTitle>
            <CardDescription>
              Manage your picking size categories and their assigned plant sizes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/50">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No size categories yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first category to start grouping plant sizes for picking
                </p>
                <Button variant="outline" className="mt-4" onClick={openAdd}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Plant Sizes</TableHead>
                      <TableHead className="text-center hidden sm:table-cell">
                        Order
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: category.color || '#64748b',
                              }}
                            />
                            <span className="font-medium">{category.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {category.picking_size_category_sizes.length === 0 ? (
                              <span className="text-sm text-muted-foreground">
                                No sizes assigned
                              </span>
                            ) : (
                              category.picking_size_category_sizes.map((link) => (
                                <Badge
                                  key={link.id}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {link.plant_size?.name || 'Unknown'}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          {category.display_order}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirmId(category.id)}
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? 'Edit Category' : 'Add Category'}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? 'Update the category details and assigned plant sizes.'
                  : 'Create a new size category and assign plant sizes to it.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Small Pots, Trays, Large Containers"
                />
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        formData.color === preset.value
                          ? 'border-foreground scale-110'
                          : 'border-transparent hover:border-muted-foreground/50'
                      }`}
                      style={{ backgroundColor: preset.value }}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          color: preset.value,
                        }))
                      }
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              {/* Display Order */}
              <div className="space-y-2">
                <Label htmlFor="display-order">Display Order</Label>
                <Input
                  id="display-order"
                  type="number"
                  min={0}
                  value={formData.displayOrder}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      displayOrder: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first in lists and pick sheets
                </p>
              </div>

              {/* Plant Sizes Multi-Select */}
              <div className="space-y-2">
                <Label>Assigned Plant Sizes</Label>
                {plantSizes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No plant sizes available. Add sizes in Settings first.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                    {plantSizes.map((size) => (
                      <label
                        key={size.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                      >
                        <Checkbox
                          checked={formData.plantSizeIds.includes(size.id)}
                          onCheckedChange={() => togglePlantSize(size.id)}
                        />
                        <span className="text-sm">{size.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {formData.plantSizeIds.length} size
                  {formData.plantSizeIds.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog
          open={!!deleteConfirmId}
          onOpenChange={() => setDeleteConfirmId(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Category</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this size category? This will
                remove all size assignments and picker specializations linked to
                this category. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  deleteConfirmId && handleDelete(deleteConfirmId)
                }
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
