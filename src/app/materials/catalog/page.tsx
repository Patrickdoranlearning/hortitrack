'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Search, Package, Edit, Trash2, RefreshCw, Filter, ChevronDown } from 'lucide-react';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { fetchJson } from '@/lib/http/fetchJson';
import { MaterialForm } from '@/components/materials/MaterialForm';
import type { Material, MaterialCategory } from '@/lib/types/materials';

type MaterialsResponse = {
  materials: Material[];
  total: number;
};

type CategoriesResponse = {
  categories: MaterialCategory[];
};

export default function MaterialsCatalogPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNewForm = searchParams.get('new') === 'true';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('active');
  const [isFormOpen, setIsFormOpen] = useState(showNewForm);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<Material | null>(null);

  // Fetch categories
  const { data: categoriesData } = useSWR<CategoriesResponse>(
    '/api/materials/categories',
    (url) => fetchJson(url)
  );

  // Fetch materials
  const {
    data: materialsData,
    mutate: mutateMaterials,
    isValidating,
  } = useSWR<MaterialsResponse>(
    `/api/materials?isActive=${activeFilter === 'active' ? 'true' : activeFilter === 'inactive' ? 'false' : ''}&search=${encodeURIComponent(search)}${categoryFilter !== 'all' ? `&categoryId=${categoryFilter}` : ''}`,
    (url) => fetchJson(url),
    { revalidateOnFocus: false }
  );

  const categories = categoriesData?.categories ?? [];
  const materials = materialsData?.materials ?? [];

  // Group categories by parent group for the filter
  const categoryGroups = useMemo(() => {
    const groups: Record<string, MaterialCategory[]> = {};
    categories.forEach((cat) => {
      if (!groups[cat.parentGroup]) groups[cat.parentGroup] = [];
      groups[cat.parentGroup].push(cat);
    });
    return groups;
  }, [categories]);

  // Close form when URL param changes
  useEffect(() => {
    if (!showNewForm && isFormOpen && !editingMaterial) {
      setIsFormOpen(false);
    }
  }, [showNewForm]);

  const handleCreate = async (data: Record<string, unknown>) => {
    try {
      await fetchJson('/api/materials', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      toast({ title: 'Material created successfully' });
      setIsFormOpen(false);
      setEditingMaterial(null);
      mutateMaterials();
      router.replace('/materials/catalog');
    } catch (error) {
      toast({
        title: 'Failed to create material',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editingMaterial) return;
    try {
      await fetchJson(`/api/materials/${editingMaterial.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      toast({ title: 'Material updated successfully' });
      setIsFormOpen(false);
      setEditingMaterial(null);
      mutateMaterials();
    } catch (error) {
      toast({
        title: 'Failed to update material',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingMaterial) return;
    try {
      await fetchJson(`/api/materials/${deletingMaterial.id}`, {
        method: 'DELETE',
      });
      toast({ title: 'Material deleted' });
      setDeletingMaterial(null);
      mutateMaterials();
    } catch (error) {
      toast({
        title: 'Failed to delete material',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const getCategoryColor = (parentGroup: string) => {
    switch (parentGroup) {
      case 'Containers':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Growing Media':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Labels/Tags':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Chemicals':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="materials">
      <div className="space-y-6">
        <ModulePageHeader
          title="Materials Catalog"
          description="Manage your materials inventory - pots, trays, soil, labels, and chemicals."
          actionsSlot={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => mutateMaterials()}
                disabled={isValidating}
              >
                <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                onClick={() => {
                  setEditingMaterial(null);
                  setIsFormOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Material
              </Button>
            </div>
          }
        />

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or part number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(categoryGroups).map(([group, cats]) => (
                      <div key={group}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {group}
                        </div>
                        {cats.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Materials Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Materials ({materialsData?.total ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isValidating && !materials.length ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : materials.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No materials found</p>
                <p className="text-sm">
                  {search || categoryFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Get started by adding your first material'}
                </p>
                {!search && categoryFilter === 'all' && (
                  <Button
                    className="mt-4"
                    onClick={() => {
                      setEditingMaterial(null);
                      setIsFormOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Material
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Part Number</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Linked Size</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Reorder Point</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((material) => (
                      <TableRow
                        key={material.id}
                        className={!material.isActive ? 'opacity-50' : ''}
                      >
                        <TableCell className="font-mono text-sm">
                          {material.partNumber}
                        </TableCell>
                        <TableCell className="font-medium">
                          {material.name}
                          {!material.isActive && (
                            <Badge variant="secondary" className="ml-2">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {material.category && (
                            <Badge
                              variant="outline"
                              className={getCategoryColor(material.category.parentGroup)}
                            >
                              {material.category.name}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {material.linkedSize?.name ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{material.baseUom}</TableCell>
                        <TableCell>
                          {material.defaultSupplier?.name ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {material.reorderPoint ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingMaterial(material);
                                  setIsFormOpen(true);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeletingMaterial(material)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Material Form Dialog */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingMaterial(null);
            router.replace('/materials/catalog');
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <MaterialForm
            material={editingMaterial}
            categories={categories}
            onSubmit={editingMaterial ? handleUpdate : handleCreate}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingMaterial(null);
              router.replace('/materials/catalog');
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingMaterial}
        onOpenChange={(open) => !open && setDeletingMaterial(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingMaterial?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the material. It will no longer appear in dropdowns
              but existing records will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFrame>
  );
}
