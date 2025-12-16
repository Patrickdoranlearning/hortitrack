'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Layers,
  Users,
  Tag,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { Switch } from '@/components/ui/switch';
import { MultiSelect } from '@/components/ui/multi-select';
import { toast } from 'sonner';
import type { ProductGroup } from '../types';
import {
  upsertProductGroupAction,
  deleteProductGroupAction,
  getProductGroupMembersAction,
  upsertProductGroupMemberAction,
  fetchProductGroupAliasesAction,
  upsertProductGroupAliasAction,
  deleteProductGroupAliasAction,
} from '../actions';

type ProductOption = {
  id: string;
  name: string;
  varietyName: string | null;
  sizeName: string | null;
  category: string | null;
  family: string | null;
  genus: string | null;
};

type CustomerOption = {
  id: string;
  name: string;
};

type Props = {
  groups: ProductGroup[];
  products: ProductOption[];
  customers: CustomerOption[];
  plantSizes: { id: string; name: string }[];
  categories: string[];
  families: string[];
  genera: string[];
};

type GroupMember = {
  product_id: string;
  product_name: string;
  inclusion_source: 'rule' | 'manual_include';
};

type GroupAlias = {
  id: string;
  alias_name: string;
  customer_id: string | null;
  customer_barcode: string | null;
  customer_sku_code: string | null;
  unit_price_ex_vat: number | null;
  customer?: { id: string; name: string } | null;
};

export default function ProductGroupsClient({
  groups: initialGroups,
  products,
  customers,
  plantSizes,
  categories,
  families,
  genera,
}: Props) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [selectedGroup, setSelectedGroup] = useState<ProductGroup | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ProductGroup | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state - using arrays for multi-select matching rules
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    defaultBarcode: '',
    matchCategories: [] as string[],
    matchFamilies: [] as string[],
    matchGenera: [] as string[],
    matchSizeIds: [] as string[],
    isActive: true,
  });

  // Members and aliases for selected group
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [aliases, setAliases] = useState<GroupAlias[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Alias form
  const [isAliasFormOpen, setIsAliasFormOpen] = useState(false);
  const [aliasFormData, setAliasFormData] = useState({
    id: '',
    groupId: '',
    customerId: '',
    aliasName: '',
    customerSkuCode: '',
    customerBarcode: '',
    unitPriceExVat: '',
  });

  function openNewGroupForm() {
    setFormData({
      id: '',
      name: '',
      description: '',
      defaultBarcode: '',
      matchCategories: [],
      matchFamilies: [],
      matchGenera: [],
      matchSizeIds: [],
      isActive: true,
    });
    setIsFormOpen(true);
  }

  // Load group details when selected
  useEffect(() => {
    if (selectedGroup) {
      loadGroupDetails(selectedGroup.id);
    }
  }, [selectedGroup]);

  async function loadGroupDetails(groupId: string) {
    setIsLoadingDetails(true);
    try {
      const [membersRes, aliasesRes] = await Promise.all([
        getProductGroupMembersAction(groupId),
        fetchProductGroupAliasesAction(groupId),
      ]);

      if (membersRes.success) {
        setMembers(membersRes.data as GroupMember[]);
      }
      if (aliasesRes.success) {
        setAliases(aliasesRes.data as GroupAlias[]);
      }
    } catch (error) {
      console.error('Failed to load group details', error);
    } finally {
      setIsLoadingDetails(false);
    }
  }

  async function handleSaveGroup() {
    console.log('handleSaveGroup called', formData);
    if (!formData.name.trim()) {
      toast.error('Group name is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        id: formData.id || undefined,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        defaultBarcode: formData.defaultBarcode.trim() || null,
        matchCategories: formData.matchCategories.length > 0 ? formData.matchCategories : null,
        matchFamilies: formData.matchFamilies.length > 0 ? formData.matchFamilies : null,
        matchGenera: formData.matchGenera.length > 0 ? formData.matchGenera : null,
        matchSizeIds: formData.matchSizeIds.length > 0 ? formData.matchSizeIds : null,
        isActive: formData.isActive,
      };
      console.log('Calling upsertProductGroupAction with:', payload);
      const result = await upsertProductGroupAction(payload);
      console.log('Result:', result);

      if (result.success) {
        toast.success(formData.id ? 'Group updated' : 'Group created');
        setIsFormOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to save group');
      }
    } catch (error) {
      console.error('handleSaveGroup error:', error);
      toast.error('Failed to save group');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteGroup() {
    if (!groupToDelete) return;

    try {
      const result = await deleteProductGroupAction(groupToDelete.id);
      if (result.success) {
        toast.success('Group deleted');
        setIsDeleteOpen(false);
        setGroupToDelete(null);
        if (selectedGroup?.id === groupToDelete.id) {
          setSelectedGroup(null);
        }
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to delete group');
      }
    } catch (error) {
      toast.error('Failed to delete group');
    }
  }

  async function handleExcludeProduct(productId: string) {
    if (!selectedGroup) return;

    try {
      const result = await upsertProductGroupMemberAction({
        groupId: selectedGroup.id,
        productId,
        inclusionType: 'manual_exclude',
      });

      if (result.success) {
        toast.success('Product excluded from group');
        loadGroupDetails(selectedGroup.id);
      } else {
        toast.error(result.error || 'Failed to exclude product');
      }
    } catch (error) {
      toast.error('Failed to exclude product');
    }
  }

  async function handleIncludeProduct(productId: string) {
    if (!selectedGroup) return;

    try {
      const result = await upsertProductGroupMemberAction({
        groupId: selectedGroup.id,
        productId,
        inclusionType: 'manual_include',
      });

      if (result.success) {
        toast.success('Product added to group');
        loadGroupDetails(selectedGroup.id);
      } else {
        toast.error(result.error || 'Failed to add product');
      }
    } catch (error) {
      toast.error('Failed to add product');
    }
  }

  async function handleSaveAlias() {
    if (!aliasFormData.aliasName.trim()) {
      toast.error('Alias name is required');
      return;
    }

    try {
      const result = await upsertProductGroupAliasAction({
        id: aliasFormData.id || undefined,
        groupId: aliasFormData.groupId,
        customerId: aliasFormData.customerId || null,
        aliasName: aliasFormData.aliasName.trim(),
        customerSkuCode: aliasFormData.customerSkuCode.trim() || null,
        customerBarcode: aliasFormData.customerBarcode.trim() || null,
        unitPriceExVat: aliasFormData.unitPriceExVat
          ? parseFloat(aliasFormData.unitPriceExVat)
          : null,
        isActive: true,
      });

      if (result.success) {
        toast.success(aliasFormData.id ? 'Alias updated' : 'Alias created');
        setIsAliasFormOpen(false);
        if (selectedGroup) {
          loadGroupDetails(selectedGroup.id);
        }
      } else {
        toast.error(result.error || 'Failed to save alias');
      }
    } catch (error) {
      toast.error('Failed to save alias');
    }
  }

  async function handleDeleteAlias(aliasId: string) {
    try {
      const result = await deleteProductGroupAliasAction(aliasId);
      if (result.success) {
        toast.success('Alias deleted');
        if (selectedGroup) {
          loadGroupDetails(selectedGroup.id);
        }
      } else {
        toast.error(result.error || 'Failed to delete alias');
      }
    } catch (error) {
      toast.error('Failed to delete alias');
    }
  }

  function openEditForm(group: ProductGroup) {
    setFormData({
      id: group.id,
      name: group.name,
      description: group.description || '',
      defaultBarcode: group.defaultBarcode || '',
      matchCategories: group.matchCategories || [],
      matchFamilies: group.matchFamilies || [],
      matchGenera: group.matchGenera || [],
      matchSizeIds: group.matchSizeIds || [],
      isActive: group.isActive,
    });
    setIsFormOpen(true);
  }

  function openNewAliasForm() {
    if (!selectedGroup) return;
    setAliasFormData({
      id: '',
      groupId: selectedGroup.id,
      customerId: '',
      aliasName: '',
      customerSkuCode: '',
      customerBarcode: '',
      unitPriceExVat: '',
    });
    setIsAliasFormOpen(true);
  }

  // Products not in the current group (for adding)
  const memberProductIds = new Set(members.map((m) => m.product_id));
  const availableProducts = products.filter((p) => !memberProductIds.has(p.id));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Groups List */}
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Groups</CardTitle>
                <CardDescription>
                  {groups.length} product group{groups.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <Button size="sm" onClick={openNewGroupForm}>
                <Plus className="h-4 w-4 mr-1" />
                New Group
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {groups.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No groups yet. Create one to get started.
                </p>
              ) : (
                groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between ${
                      selectedGroup?.id === group.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{group.name}</span>
                        {!group.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-1">
                        {group.matchCategories?.map((c) => (
                          <Badge key={c} variant="outline">{c}</Badge>
                        ))}
                        {group.matchGenera?.map((g) => (
                          <Badge key={g} variant="outline">{g}</Badge>
                        ))}
                        {group.matchSizeIds && group.matchSizeIds.length > 0 && (
                          <Badge variant="outline">{group.matchSizeIds.length} size(s)</Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Group Detail */}
      <div className="lg:col-span-2">
        {selectedGroup ? (
          <div className="space-y-4">
            {/* Header Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedGroup.name}</CardTitle>
                    {selectedGroup.description && (
                      <CardDescription className="mt-1">
                        {selectedGroup.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditForm(selectedGroup)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setGroupToDelete(selectedGroup);
                        setIsDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {selectedGroup.matchCategories && selectedGroup.matchCategories.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Categories:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedGroup.matchCategories.map((c) => (
                          <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedGroup.matchFamilies && selectedGroup.matchFamilies.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Families:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedGroup.matchFamilies.map((f) => (
                          <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedGroup.matchGenera && selectedGroup.matchGenera.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Genera:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedGroup.matchGenera.map((g) => (
                          <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedGroup.matchSizeIds && selectedGroup.matchSizeIds.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Sizes:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedGroup.matchSizeIds.map((sizeId) => {
                          const size = plantSizes.find((s) => s.id === sizeId);
                          return (
                            <Badge key={sizeId} variant="secondary" className="text-xs">
                              {size?.name || sizeId}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {selectedGroup.defaultBarcode && (
                    <div>
                      <span className="text-muted-foreground">Default Barcode:</span>
                      <p className="font-mono text-xs">{selectedGroup.defaultBarcode}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Members Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Products in Group
                    </CardTitle>
                    <CardDescription>
                      {members.length} product{members.length !== 1 ? 's' : ''} matched
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingDetails ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No products match this group's rules.
                  </p>
                ) : (
                  <div className="divide-y rounded-md border">
                    {members.map((member) => (
                      <div
                        key={member.product_id}
                        className="flex items-center justify-between p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.product_name}</span>
                          <Badge
                            variant={member.inclusion_source === 'rule' ? 'secondary' : 'default'}
                            className="text-xs"
                          >
                            {member.inclusion_source === 'rule' ? 'Auto' : 'Manual'}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExcludeProduct(member.product_id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add product */}
                {availableProducts.length > 0 && (
                  <Collapsible className="mt-4">
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Product Manually
                        <ChevronDown className="h-4 w-4 ml-auto" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                        {availableProducts.slice(0, 20).map((product) => (
                          <button
                            key={product.id}
                            onClick={() => handleIncludeProduct(product.id)}
                            className="w-full text-left p-2 hover:bg-muted/50 text-sm flex items-center justify-between"
                          >
                            <span>{product.name}</span>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>

            {/* Aliases Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Customer Aliases
                    </CardTitle>
                    <CardDescription>
                      Customer-specific names and barcodes for this group
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={openNewAliasForm}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Alias
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {aliases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No customer aliases configured yet.
                  </p>
                ) : (
                  <div className="divide-y rounded-md border">
                    {aliases.map((alias) => (
                      <div
                        key={alias.id}
                        className="flex items-center justify-between p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{alias.alias_name}</span>
                            {alias.customer && (
                              <Badge variant="outline" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                {alias.customer.name}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                            {alias.customer_barcode && (
                              <span>Barcode: {alias.customer_barcode}</span>
                            )}
                            {alias.customer_sku_code && (
                              <span>SKU: {alias.customer_sku_code}</span>
                            )}
                            {alias.unit_price_ex_vat && (
                              <span>Price: €{alias.unit_price_ex_vat.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAlias(alias.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64 text-center">
              <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium">No group selected</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Select a group from the list or create a new one.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Group Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{formData.id ? 'Edit Group' : 'New Product Group'}</DialogTitle>
            <DialogDescription>
              Define matching rules to automatically include products.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 2L Perennial"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="defaultBarcode">Default Barcode</Label>
              <Input
                id="defaultBarcode"
                value={formData.defaultBarcode}
                onChange={(e) => setFormData({ ...formData, defaultBarcode: e.target.value })}
                placeholder="e.g., 5391234000099"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-3">Matching Rules</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Products matching ALL specified rules will be automatically included.
                Select multiple values per rule to match ANY of them.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categories</Label>
                  <MultiSelect
                    options={categories.filter(Boolean).map((c) => ({ value: c, label: c }))}
                    values={formData.matchCategories}
                    onChange={(values) => setFormData({ ...formData, matchCategories: values })}
                    placeholder="Any category"
                    emptyMessage="No categories found"
                  />
                </div>

                <div>
                  <Label>Families</Label>
                  <MultiSelect
                    options={families.filter(Boolean).map((f) => ({ value: f, label: f }))}
                    values={formData.matchFamilies}
                    onChange={(values) => setFormData({ ...formData, matchFamilies: values })}
                    placeholder="Any family"
                    emptyMessage="No families found"
                  />
                </div>

                <div>
                  <Label>Genera</Label>
                  <MultiSelect
                    options={genera.filter(Boolean).map((g) => ({ value: g, label: g }))}
                    values={formData.matchGenera}
                    onChange={(values) => setFormData({ ...formData, matchGenera: values })}
                    placeholder="Any genus"
                    emptyMessage="No genera found"
                  />
                </div>

                <div>
                  <Label>Sizes</Label>
                  <MultiSelect
                    options={plantSizes.filter((s) => s.id).map((s) => ({ value: s.id, label: s.name }))}
                    values={formData.matchSizeIds}
                    onChange={(values) => setFormData({ ...formData, matchSizeIds: values })}
                    placeholder="Any size"
                    emptyMessage="No sizes found"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroup} disabled={isSaving}>
              {isSaving ? 'Saving...' : formData.id ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alias Form Dialog */}
      <Dialog open={isAliasFormOpen} onOpenChange={setIsAliasFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer Alias</DialogTitle>
            <DialogDescription>
              Configure customer-specific naming and barcode for this group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="customer">Customer (optional)</Label>
              <Select
                value={aliasFormData.customerId || '__none__'}
                onValueChange={(v) => setAliasFormData({ ...aliasFormData, customerId: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All customers</SelectItem>
                  {customers.filter((c) => c.id).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="aliasName">Alias Name *</Label>
              <Input
                id="aliasName"
                value={aliasFormData.aliasName}
                onChange={(e) =>
                  setAliasFormData({ ...aliasFormData, aliasName: e.target.value })
                }
                placeholder="e.g., Mixed Perennial 2L"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="customerBarcode">Customer Barcode</Label>
                <Input
                  id="customerBarcode"
                  value={aliasFormData.customerBarcode}
                  onChange={(e) =>
                    setAliasFormData({ ...aliasFormData, customerBarcode: e.target.value })
                  }
                  placeholder="Their barcode"
                />
              </div>
              <div>
                <Label htmlFor="customerSkuCode">Customer SKU</Label>
                <Input
                  id="customerSkuCode"
                  value={aliasFormData.customerSkuCode}
                  onChange={(e) =>
                    setAliasFormData({ ...aliasFormData, customerSkuCode: e.target.value })
                  }
                  placeholder="Their SKU code"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="unitPriceExVat">Unit Price (ex VAT)</Label>
              <Input
                id="unitPriceExVat"
                type="number"
                step="0.01"
                value={aliasFormData.unitPriceExVat}
                onChange={(e) =>
                  setAliasFormData({ ...aliasFormData, unitPriceExVat: e.target.value })
                }
                placeholder="e.g., 3.50"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAliasFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAlias}>Save Alias</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{groupToDelete?.name}" and all its customer aliases.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
