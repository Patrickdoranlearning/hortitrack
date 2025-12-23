'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Search,
  QrCode,
  LayoutGrid,
  List,
  Map,
  Printer,
  Filter,
  MapPin,
} from 'lucide-react';
import type { NurseryLocation, Batch } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import ScannerDialog from '@/components/scan-and-act-dialog';
import { fetchJson } from '@/lib/http';
import { LocationCard } from '@/components/locations/LocationCard';
import { LocationListView } from '@/components/locations/LocationListView';
import { LocationMapView } from '@/components/locations/LocationMapView';
import { LocationDetailDialog } from '@/components/locations/LocationDetailDialog';
import { LocationLabelPreview } from '@/components/locations/LocationLabelPreview';
import { useLocationDetailDialog } from '@/stores/useLocationDetailDialog';

type ViewMode = 'cards' | 'list' | 'map';

type LocationWithBatches = NurseryLocation & {
  batches: Batch[];
  batchCount: number;
  totalQuantity: number;
};

async function fetchLocationsWithBatches(): Promise<LocationWithBatches[]> {
  const { data } = await fetchJson<{ ok: boolean; data: LocationWithBatches[] }>('/api/production/locations');
  return Array.isArray(data?.data) ? data!.data : [];
}

export default function LocationsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlLocation = searchParams.get('location');
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    nurserySite: string;
    type: string;
    covered: string;
  }>({ nurserySite: 'all', type: 'all', covered: 'all' });

  const [isScanOpen, setIsScanOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationWithBatches | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const dialogStore = useLocationDetailDialog();

  // Fetch locations with batch data
  const {
    data: locations = [],
    error,
    isLoading,
    mutate,
  } = useSWR('production/locations', fetchLocationsWithBatches);

  // Handle URL param for deep linking
  React.useEffect(() => {
    if (!urlLocation || !locations?.length) return;
    const loc = locations.find((l) => l.id === urlLocation || l.name === urlLocation);
    if (loc) {
      setSelectedLocation(loc);
      setIsDetailOpen(true);
    }
  }, [urlLocation, locations]);

  // Sync with zustand store
  React.useEffect(() => {
    if (dialogStore.isOpen && dialogStore.locationId && locations?.length) {
      const loc = locations.find((l) => l.id === dialogStore.locationId);
      if (loc) {
        setSelectedLocation(loc);
        setIsDetailOpen(true);
      }
    }
  }, [dialogStore.isOpen, dialogStore.locationId, locations]);

  // Extract filter options
  const nurserySites = useMemo(
    () => ['all', ...Array.from(new Set(locations.map((l) => l.nurserySite).filter(Boolean)))],
    [locations]
  );
  const locationTypes = useMemo(
    () => ['all', ...Array.from(new Set(locations.map((l) => l.type).filter(Boolean)))],
    [locations]
  );

  // Filter locations
  const filteredLocations = useMemo(() => {
    if (!Array.isArray(locations)) return [];
    const q = searchQuery.toLowerCase().trim();

    return locations.filter((loc) => {
      // Search filter
      if (q) {
        const searchFields = [loc.name, loc.nurserySite, loc.type, loc.siteId].filter(Boolean);
        const matchesSearch = searchFields.some((field) => field!.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // Nursery site filter
      if (filters.nurserySite !== 'all' && loc.nurserySite !== filters.nurserySite) {
        return false;
      }

      // Type filter
      if (filters.type !== 'all' && loc.type !== filters.type) {
        return false;
      }

      // Covered filter
      if (filters.covered !== 'all') {
        const isCovered = filters.covered === 'covered';
        if (loc.covered !== isCovered) return false;
      }

      return true;
    });
  }, [locations, searchQuery, filters]);

  const handleViewLocation = (location: LocationWithBatches) => {
    setSelectedLocation(location);
    setIsDetailOpen(true);
    // Update URL for deep linking
    router.push(`/production/locations?location=${location.id}`, { scroll: false });
  };

  const handlePrintLabel = (location: LocationWithBatches) => {
    setSelectedLocation(location);
    setIsPrintOpen(true);
  };

  const handleScanDetected = React.useCallback(
    async (text: string) => {
      if (!text) return;
      setIsScanOpen(false);

      // Check if it's a location code (format: ht:loc:<id>)
      if (text.startsWith('ht:loc:')) {
        const locationId = text.replace('ht:loc:', '');
        const loc = locations?.find((l) => l.id === locationId || l.siteId === locationId);
        if (loc) {
          handleViewLocation(loc);
        } else {
          toast({
            variant: 'destructive',
            title: 'Location not found',
            description: 'Could not find a location matching the scanned code.',
          });
        }
      } else {
        // Might be a batch code - redirect to batch scan
        router.push(`/?batch=${encodeURIComponent(text)}`);
      }
    },
    [locations, router, toast]
  );

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedLocation(null);
    dialogStore.close();
    router.push('/production/locations', { scroll: false });
  };

  if (error) {
    return (
      <PageFrame moduleKey="production">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Failed to load locations</h2>
            <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
            <Button onClick={() => mutate()}>Retry</Button>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame moduleKey="production">
      <div className="space-y-6">
        <ModulePageHeader
          title="Nursery Locations"
          description="View what's growing in each location across the nursery."
          actionsSlot={
            <>
              <Button variant="outline" onClick={() => setIsScanOpen(true)}>
                <QrCode className="mr-2 h-4 w-4" />
                Scan Location
              </Button>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search locations..."
                  className="pl-9 w-full sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </>
          }
        />

        {/* View controls and filters */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuLabel>Nursery Site</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters.nurserySite}
                  onValueChange={(value) => setFilters((f) => ({ ...f, nurserySite: value }))}
                >
                  {nurserySites.map((site) => (
                    <DropdownMenuRadioItem key={site} value={site}>
                      {site === 'all' ? 'All Sites' : site}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Location Type</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters.type}
                  onValueChange={(value) => setFilters((f) => ({ ...f, type: value }))}
                >
                  {locationTypes.map((type) => (
                    <DropdownMenuRadioItem key={type} value={type}>
                      {type === 'all' ? 'All Types' : type}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Coverage</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters.covered}
                  onValueChange={(value) => setFilters((f) => ({ ...f, covered: value }))}
                >
                  <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="covered">Covered</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="uncovered">Uncovered</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-sm text-muted-foreground">
              {filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''}
            </span>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="cards" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Cards</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </TabsTrigger>
              <TabsTrigger value="map" className="gap-2">
                <Map className="h-4 w-4" />
                <span className="hidden sm:inline">Map</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content based on view mode */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLocations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                onView={handleViewLocation}
                onPrint={handlePrintLabel}
              />
            ))}
            {filteredLocations.length === 0 && (
              <div className="col-span-full text-center py-20">
                <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No Locations Found</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try adjusting your search or filters.
                </p>
              </div>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <LocationListView
            locations={filteredLocations}
            onView={handleViewLocation}
            onPrint={handlePrintLabel}
          />
        ) : (
          <LocationMapView
            locations={filteredLocations}
            onSelectLocation={handleViewLocation}
          />
        )}
      </div>

      {/* Dialogs */}
      <ScannerDialog
        open={isScanOpen}
        onOpenChange={setIsScanOpen}
        onDetected={handleScanDetected}
      />

      <LocationDetailDialog
        open={isDetailOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDetail();
        }}
        location={selectedLocation}
        onPrintLabel={handlePrintLabel}
      />

      {selectedLocation && (
        <LocationLabelPreview
          open={isPrintOpen}
          onOpenChange={setIsPrintOpen}
          location={selectedLocation}
        />
      )}
    </PageFrame>
  );
}

