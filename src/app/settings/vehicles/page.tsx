'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit, ArrowLeft, Container } from 'lucide-react';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/hooks/use-collection';
import type { HaulierVehicle, Haulier } from '@/lib/types';
import { addVehicleAction, deleteVehicleAction, updateVehicleAction, getVehiclesAction } from '@/app/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VehicleForm } from '@/components/vehicle-form';
import Link from 'next/link';

type VehicleWithHaulier = HaulierVehicle & { haulierName?: string };
type SortableKey = 'name' | 'haulierName' | 'registration' | 'vehicleType' | 'trolleyCapacity';

export default function VehiclesPage() {
  const { toast } = useToast();
  const [filterText, setFilterText] = useState('');
  const [editingVehicle, setEditingVehicle] = useState<VehicleWithHaulier | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleWithHaulier[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });

  // Get hauliers for the form dropdown
  const { data: rawHauliers } = useCollection<any>('hauliers');
  const hauliers = useMemo<Haulier[]>(
    () =>
      (rawHauliers || []).map((row: any) => ({
        id: row.id,
        orgId: row.org_id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        notes: row.notes,
        isActive: row.is_active ?? true,
      })),
    [rawHauliers]
  );

  // Fetch vehicles
  const fetchVehicles = async () => {
    setLoading(true);
    const result = await getVehiclesAction();
    if (result.success) {
      setVehicles(result.data as VehicleWithHaulier[]);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const filteredVehicles = useMemo(() => {
    if (!filterText) return vehicles;
    const q = filterText.toLowerCase();
    return vehicles.filter((v) =>
      [v.name, v.haulierName, v.registration, v.vehicleType]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [vehicles, filterText]);

  const sortedVehicles = useMemo(() => {
    return [...filteredVehicles].sort((a, b) => {
      const { key, direction } = sortConfig;
      const left = (a as any)[key] ?? '';
      const right = (b as any)[key] ?? '';
      if (typeof left === 'number' && typeof right === 'number') {
        return direction === 'asc' ? left - right : right - left;
      }
      return direction === 'asc'
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left));
    });
  }, [filteredVehicles, sortConfig]);

  const handleSort = (key: SortableKey) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await deleteVehicleAction(id);
    if (result.success) {
      setVehicles((prev) => prev.filter((v) => v.id !== id));
      toast({ title: 'Vehicle deleted', description: `"${name}" removed.` });
    } else {
      toast({ variant: 'destructive', title: 'Delete failed', description: result.error });
    }
  };

  const handleFormSubmit = async (values: Omit<HaulierVehicle, 'id'> | HaulierVehicle) => {
    const isUpdate = 'id' in values && values.id;
    const result = isUpdate
      ? await updateVehicleAction(values as HaulierVehicle)
      : await addVehicleAction(values as Omit<HaulierVehicle, 'id'>);

    if (result.success) {
      toast({
        title: isUpdate ? 'Vehicle updated' : 'Vehicle added',
        description: `"${values.name}" saved successfully.`,
      });
      setIsFormOpen(false);
      setEditingVehicle(null);
      fetchVehicles();
    } else {
      toast({ variant: 'destructive', title: 'Save failed', description: result.error });
    }
  };

  const renderSortHeader = (label: string, key: SortableKey) => {
    const active = sortConfig.key === key;
    const indicator = active ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '';
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide"
        onClick={() => handleSort(key)}
      >
        {label}
        <span className="text-muted-foreground">{indicator}</span>
      </button>
    );
  };

  const formatVehicleType = (type?: string) => {
    if (!type) return 'Van';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <PageFrame moduleKey="production">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ModulePageHeader
            title="Vehicle Manager"
            description="Configure truck dimensions, trolley capacity, and loading layouts for dispatch."
          />
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Input
            className="w-full max-w-xs"
            placeholder="Filter by name, haulier, registration..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <Button
            onClick={() => {
              setEditingVehicle(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2">
            <h2 className="text-lg font-semibold">Fleet Vehicles</h2>
            <p className="text-sm text-muted-foreground">
              Manage vehicles and their loading configurations for delivery runs.
            </p>
          </div>
          <div className="overflow-x-auto px-4 py-3">
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : sortedVehicles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Container className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No vehicles configured</p>
                <p className="text-sm">Add your first vehicle to get started with loading configurations.</p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    setEditingVehicle(null);
                    setIsFormOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Vehicle
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {sortedVehicles.map((vehicle) => (
                    <div key={vehicle.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{vehicle.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {vehicle.haulierName || 'No haulier'}
                          </p>
                        </div>
                        <Badge variant={vehicle.isActive ? 'default' : 'secondary'}>
                          {vehicle.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Type: </span>
                          <span>{formatVehicleType(vehicle.vehicleType)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Capacity: </span>
                          <span>{vehicle.trolleyCapacity} trolleys</span>
                        </div>
                        {vehicle.registration && (
                          <div>
                            <span className="text-muted-foreground">Reg: </span>
                            <span>{vehicle.registration}</span>
                          </div>
                        )}
                        {vehicle.truckLayout && (
                          <div>
                            <span className="text-muted-foreground">Layout: </span>
                            <span>{vehicle.truckLayout.rows}×{vehicle.truckLayout.columns}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setEditingVehicle(vehicle);
                            setIsFormOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" size="sm" variant="destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete &quot;{vehicle.name}&quot;?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This vehicle will be removed from the fleet. Existing delivery runs may be affected.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(vehicle.id!, vehicle.name)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4 py-2">{renderSortHeader('Name', 'name')}</TableHead>
                        <TableHead className="px-4 py-2">{renderSortHeader('Haulier', 'haulierName')}</TableHead>
                        <TableHead className="px-4 py-2">{renderSortHeader('Registration', 'registration')}</TableHead>
                        <TableHead className="px-4 py-2">{renderSortHeader('Type', 'vehicleType')}</TableHead>
                        <TableHead className="px-4 py-2">{renderSortHeader('Capacity', 'trolleyCapacity')}</TableHead>
                        <TableHead className="px-4 py-2">Layout</TableHead>
                        <TableHead className="px-4 py-2">Status</TableHead>
                        <TableHead className="px-4 py-2 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedVehicles.map((vehicle) => (
                        <TableRow key={vehicle.id}>
                          <TableCell className="px-4 py-2 font-medium">{vehicle.name}</TableCell>
                          <TableCell className="px-4 py-2">{vehicle.haulierName || '—'}</TableCell>
                          <TableCell className="px-4 py-2">{vehicle.registration || '—'}</TableCell>
                          <TableCell className="px-4 py-2">{formatVehicleType(vehicle.vehicleType)}</TableCell>
                          <TableCell className="px-4 py-2">{vehicle.trolleyCapacity} trolleys</TableCell>
                          <TableCell className="px-4 py-2">
                            {vehicle.truckLayout ? (
                              <span className="text-xs text-muted-foreground">
                                {vehicle.truckLayout.rows}×{vehicle.truckLayout.columns} grid
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <Badge variant={vehicle.isActive ? 'default' : 'secondary'}>
                              {vehicle.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingVehicle(vehicle);
                                  setIsFormOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" size="sm" variant="destructive">
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete &quot;{vehicle.name}&quot;?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This vehicle will be removed from the fleet. Existing delivery runs may be affected.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(vehicle.id!, vehicle.name)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <VehicleForm
              vehicle={editingVehicle}
              hauliers={hauliers.filter((h) => h.isActive)}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingVehicle(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </PageFrame>
  );
}
