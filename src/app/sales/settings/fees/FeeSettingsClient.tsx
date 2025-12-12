'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Plus, Pencil, Trash2, Tag, Truck, Package, Zap } from 'lucide-react';
import { 
  type OrgFee, 
  type FeeUnit,
  type CreateFeeInput,
  createOrgFee, 
  updateOrgFee, 
  deleteOrgFee,
} from './actions';
import { STANDARD_FEE_TYPES } from './constants';
import { useRouter } from 'next/navigation';

type Props = {
  initialFees: OrgFee[];
};

const FEE_TYPE_INFO: Record<string, { icon: React.ReactNode; color: string; description: string }> = {
  [STANDARD_FEE_TYPES.PRE_PRICING]: {
    icon: <Tag className="h-5 w-5" />,
    color: 'bg-blue-100 text-blue-700',
    description: 'Cost for printing retail prices on pot labels',
  },
  [STANDARD_FEE_TYPES.DELIVERY_FLAT]: {
    icon: <Truck className="h-5 w-5" />,
    color: 'bg-green-100 text-green-700',
    description: 'Fixed delivery charge per order',
  },
  [STANDARD_FEE_TYPES.DELIVERY_PER_KM]: {
    icon: <Truck className="h-5 w-5" />,
    color: 'bg-green-100 text-green-700',
    description: 'Delivery charge based on distance',
  },
  [STANDARD_FEE_TYPES.HANDLING]: {
    icon: <Package className="h-5 w-5" />,
    color: 'bg-orange-100 text-orange-700',
    description: 'Order handling and processing fee',
  },
  [STANDARD_FEE_TYPES.RUSH_ORDER]: {
    icon: <Zap className="h-5 w-5" />,
    color: 'bg-yellow-100 text-yellow-700',
    description: 'Additional charge for expedited orders',
  },
};

const UNIT_LABELS: Record<FeeUnit, string> = {
  per_unit: 'Per Unit',
  flat: 'Flat Rate',
  per_km: 'Per Kilometer',
  percentage: 'Percentage',
};

export function FeeSettingsClient({ initialFees }: Props) {
  const router = useRouter();
  const [fees, setFees] = useState(initialFees);
  const [isPending, startTransition] = useTransition();
  const [editingFee, setEditingFee] = useState<OrgFee | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleToggleActive = async (fee: OrgFee) => {
    startTransition(async () => {
      const result = await updateOrgFee(fee.id, { isActive: !fee.isActive });
      if (result.success) {
        setFees(prev => prev.map(f => f.id === fee.id ? { ...f, isActive: !f.isActive } : f));
      }
    });
  };

  const handleToggleDefault = async (fee: OrgFee) => {
    startTransition(async () => {
      const result = await updateOrgFee(fee.id, { isDefault: !fee.isDefault });
      if (result.success) {
        setFees(prev => prev.map(f => f.id === fee.id ? { ...f, isDefault: !f.isDefault } : f));
      }
    });
  };

  const handleDelete = async (feeId: string) => {
    startTransition(async () => {
      const result = await deleteOrgFee(feeId);
      if (result.success) {
        setFees(prev => prev.filter(f => f.id !== feeId));
      }
      setDeleteConfirm(null);
    });
  };

  const handleSave = async (data: CreateFeeInput, existingId?: string) => {
    startTransition(async () => {
      if (existingId) {
        const result = await updateOrgFee(existingId, data);
        if (result.success) {
          router.refresh();
          setEditingFee(null);
        }
      } else {
        const result = await createOrgFee(data);
        if (result.success && result.fee) {
          setFees(prev => [...prev, result.fee!]);
          setIsCreateOpen(false);
        }
      }
    });
  };

  const getFeeInfo = (feeType: string) => {
    return FEE_TYPE_INFO[feeType] || {
      icon: <Tag className="h-5 w-5" />,
      color: 'bg-gray-100 text-gray-700',
      description: 'Custom fee',
    };
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{fees.length}</div>
            <p className="text-sm text-muted-foreground">Total Fee Types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{fees.filter(f => f.isActive).length}</div>
            <p className="text-sm text-muted-foreground">Active Fees</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{fees.filter(f => f.isDefault).length}</div>
            <p className="text-sm text-muted-foreground">Auto-applied to Orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Fee List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fee Configurations</CardTitle>
            <CardDescription>Manage fees that can be applied to sales orders</CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Fee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <FeeForm onSave={handleSave} onCancel={() => setIsCreateOpen(false)} isPending={isPending} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No fees configured yet. Click &quot;Add Fee&quot; to create your first fee.
            </div>
          ) : (
            <div className="space-y-4">
              {fees.map((fee) => {
                const info = getFeeInfo(fee.feeType);
                return (
                  <div
                    key={fee.id}
                    className={`border rounded-lg p-4 ${!fee.isActive ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${info.color}`}>
                          {info.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{fee.name}</h3>
                            {fee.isDefault && (
                              <Badge variant="secondary" className="text-xs">Auto-apply</Badge>
                            )}
                            {!fee.isActive && (
                              <Badge variant="outline" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{fee.description || info.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="font-medium">
                              €{fee.amount.toFixed(2)} {UNIT_LABELS[fee.unit]}
                            </span>
                            {fee.vatRate > 0 && (
                              <span className="text-muted-foreground">+ {fee.vatRate}% VAT</span>
                            )}
                            {fee.minOrderValue && (
                              <span className="text-muted-foreground">
                                Free over €{fee.minOrderValue}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 mr-4">
                          <Label htmlFor={`active-${fee.id}`} className="text-xs text-muted-foreground">
                            Active
                          </Label>
                          <Switch
                            id={`active-${fee.id}`}
                            checked={fee.isActive}
                            onCheckedChange={() => handleToggleActive(fee)}
                            disabled={isPending}
                          />
                        </div>
                        <div className="flex items-center gap-2 mr-4">
                          <Label htmlFor={`default-${fee.id}`} className="text-xs text-muted-foreground">
                            Auto
                          </Label>
                          <Switch
                            id={`default-${fee.id}`}
                            checked={fee.isDefault}
                            onCheckedChange={() => handleToggleDefault(fee)}
                            disabled={isPending || !fee.isActive}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingFee(fee)}
                          disabled={isPending}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(fee.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingFee} onOpenChange={(open) => !open && setEditingFee(null)}>
        <DialogContent>
          {editingFee && (
            <FeeForm
              initialData={editingFee}
              onSave={(data) => handleSave(data, editingFee.id)}
              onCancel={() => setEditingFee(null)}
              isPending={isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fee Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this fee? This action cannot be undone.
              Historical orders that used this fee will retain their fee records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Fee Form Component
function FeeForm({
  initialData,
  onSave,
  onCancel,
  isPending,
}: {
  initialData?: OrgFee;
  onSave: (data: CreateFeeInput) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [feeType, setFeeType] = useState(initialData?.feeType || STANDARD_FEE_TYPES.PRE_PRICING);
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [unit, setUnit] = useState<FeeUnit>(initialData?.unit || 'per_unit');
  const [vatRate, setVatRate] = useState(initialData?.vatRate?.toString() || '23');
  const [minOrderValue, setMinOrderValue] = useState(initialData?.minOrderValue?.toString() || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      feeType,
      name,
      description: description || undefined,
      amount: parseFloat(amount) || 0,
      unit,
      vatRate: parseFloat(vatRate) || 0,
      minOrderValue: minOrderValue ? parseFloat(minOrderValue) : undefined,
    });
  };

  // Auto-populate name when selecting a standard fee type
  const handleFeeTypeChange = (type: string) => {
    setFeeType(type);
    if (!initialData && !name) {
      const defaults: Record<string, { name: string; unit: FeeUnit; amount: string }> = {
        [STANDARD_FEE_TYPES.PRE_PRICING]: { name: 'Pre-pricing (RRP Labels)', unit: 'per_unit', amount: '0.05' },
        [STANDARD_FEE_TYPES.DELIVERY_FLAT]: { name: 'Standard Delivery', unit: 'flat', amount: '25.00' },
        [STANDARD_FEE_TYPES.DELIVERY_PER_KM]: { name: 'Delivery (Per KM)', unit: 'per_km', amount: '1.50' },
        [STANDARD_FEE_TYPES.HANDLING]: { name: 'Handling Fee', unit: 'flat', amount: '5.00' },
        [STANDARD_FEE_TYPES.RUSH_ORDER]: { name: 'Rush Order Fee', unit: 'flat', amount: '15.00' },
      };
      const def = defaults[type];
      if (def) {
        setName(def.name);
        setUnit(def.unit);
        setAmount(def.amount);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{initialData ? 'Edit Fee' : 'Add New Fee'}</DialogTitle>
        <DialogDescription>
          Configure the fee details. Fees can be applied automatically to orders or added manually.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        {/* Fee Type */}
        {!initialData && (
          <div className="grid gap-2">
            <Label htmlFor="feeType">Fee Type</Label>
            <Select value={feeType} onValueChange={handleFeeTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STANDARD_FEE_TYPES.PRE_PRICING}>Pre-pricing (RRP Labels)</SelectItem>
                <SelectItem value={STANDARD_FEE_TYPES.DELIVERY_FLAT}>Delivery (Flat Rate)</SelectItem>
                <SelectItem value={STANDARD_FEE_TYPES.DELIVERY_PER_KM}>Delivery (Per KM)</SelectItem>
                <SelectItem value={STANDARD_FEE_TYPES.HANDLING}>Handling Fee</SelectItem>
                <SelectItem value={STANDARD_FEE_TYPES.RUSH_ORDER}>Rush Order Fee</SelectItem>
                <SelectItem value="custom">Custom Fee</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Name */}
        <div className="grid gap-2">
          <Label htmlFor="name">Display Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Pre-pricing Fee"
            required
          />
        </div>

        {/* Description */}
        <div className="grid gap-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this fee"
            rows={2}
          />
        </div>

        {/* Amount and Unit */}
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount (€)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unit">Charge Type</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as FeeUnit)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="per_unit">Per Unit</SelectItem>
                <SelectItem value="flat">Flat Rate</SelectItem>
                <SelectItem value="per_km">Per Kilometer</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* VAT Rate */}
        <div className="grid gap-2">
          <Label htmlFor="vatRate">VAT Rate (%)</Label>
          <Input
            id="vatRate"
            type="number"
            step="0.5"
            min="0"
            max="100"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            placeholder="23"
          />
        </div>

        {/* Min Order Value (for delivery) */}
        {(feeType.includes('delivery') || unit === 'flat') && (
          <div className="grid gap-2">
            <Label htmlFor="minOrderValue">Free Above Order Value (€, optional)</Label>
            <Input
              id="minOrderValue"
              type="number"
              step="0.01"
              min="0"
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(e.target.value)}
              placeholder="e.g., 500 for free delivery over €500"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to always apply this fee
            </p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !name || !amount}>
          {isPending ? 'Saving...' : initialData ? 'Save Changes' : 'Create Fee'}
        </Button>
      </DialogFooter>
    </form>
  );
}

