'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit, ArrowLeft, MapPinned } from 'lucide-react';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/toast';
import type { Site } from '@/lib/types';
import { getSitesAction, addSiteAction, updateSiteAction, deleteSiteAction } from '@/app/actions';
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
import { SiteForm } from '@/components/site-form';
import Link from 'next/link';

type SiteWithCount = Site & { locationCount: number };
type SortableKey = 'name' | 'locationCount' | 'createdAt';

export default function SitesPage() {
  const [filterText, setFilterText] = useState('');
  const [editingSite, setEditingSite] = useState<SiteWithCount | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [sites, setSites] = useState<SiteWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });

  const fetchSites = async () => {
    setLoading(true);
    const result = await getSitesAction();
    if (result.success) {
      setSites(result.data as SiteWithCount[]);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const filteredSites = useMemo(() => {
    if (!filterText) return sites;
    const q = filterText.toLowerCase();
    return sites.filter((s) => s.name.toLowerCase().includes(q));
  }, [sites, filterText]);

  const sortedSites = useMemo(() => {
    return [...filteredSites].sort((a, b) => {
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
  }, [filteredSites, sortConfig]);

  const handleSort = (key: SortableKey) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await deleteSiteAction(id);
    if (result.success) {
      setSites((prev) => prev.filter((s) => s.id !== id));
      toast.success(`"${name}" removed.`);
    } else {
      toast.error(result.error);
    }
  };

  const handleFormSubmit = async (values: Omit<Site, 'id'> | Site) => {
    setFormSaving(true);
    try {
      const isUpdate = 'id' in values && values.id;
      const result = isUpdate
        ? await updateSiteAction(values as Site)
        : await addSiteAction(values as Omit<Site, 'id'>);

      if (result.success) {
        toast.success(`"${values.name}" saved successfully.`);
        setIsFormOpen(false);
        setEditingSite(null);
        fetchSites();
      } else {
        toast.error(result.error);
      }
    } finally {
      setFormSaving(false);
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <PageFrame moduleKey="production">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ModulePageHeader
            title="Nursery Sites"
            description="Group locations by physical site for multi-site nursery operations."
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
            placeholder="Filter by name..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <Button
            onClick={() => {
              setEditingSite(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Site
          </Button>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2">
            <h2 className="text-lg font-semibold">Sites</h2>
            <p className="text-sm text-muted-foreground">
              Manage physical sites that contain nursery locations.
            </p>
          </div>
          <div className="overflow-x-auto px-4 py-3">
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : sortedSites.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPinned className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No sites configured</p>
                <p className="text-sm">Add your first site to start grouping locations.</p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    setEditingSite(null);
                    setIsFormOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Site
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {sortedSites.map((site) => (
                    <div key={site.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{site.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {site.locationCount} location{site.locationCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <Badge variant="secondary">{site.locationCount}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        Created {formatDate(site.createdAt)}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setEditingSite(site);
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
                              <AlertDialogTitle>Delete &quot;{site.name}&quot;?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {site.locationCount > 0
                                  ? `This site has ${site.locationCount} linked location(s). Reassign or remove them before deleting.`
                                  : 'This site will be permanently deleted.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(site.id!, site.name)}
                                disabled={site.locationCount > 0}
                              >
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
                        <TableHead className="px-4 py-2">{renderSortHeader('Locations', 'locationCount')}</TableHead>
                        <TableHead className="px-4 py-2">{renderSortHeader('Created', 'createdAt')}</TableHead>
                        <TableHead className="px-4 py-2 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSites.map((site) => (
                        <TableRow key={site.id}>
                          <TableCell className="px-4 py-2 font-medium">{site.name}</TableCell>
                          <TableCell className="px-4 py-2">
                            <Badge variant="secondary">{site.locationCount}</Badge>
                          </TableCell>
                          <TableCell className="px-4 py-2">{formatDate(site.createdAt)}</TableCell>
                          <TableCell className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingSite(site);
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
                                    <AlertDialogTitle>Delete &quot;{site.name}&quot;?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {site.locationCount > 0
                                        ? `This site has ${site.locationCount} linked location(s). Reassign or remove them before deleting.`
                                        : 'This site will be permanently deleted.'}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(site.id!, site.name)}
                                      disabled={site.locationCount > 0}
                                    >
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
          <DialogContent className="max-w-md">
            <SiteForm
              site={editingSite}
              saving={formSaving}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingSite(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </PageFrame>
  );
}
