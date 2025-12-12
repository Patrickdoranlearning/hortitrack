'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Truck, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Clock, 
  Package,
  Navigation,
  ChevronRight,
  LayoutGrid,
  List,
  Printer,
  Loader2,
  RefreshCw,
  Filter,
  X,
} from 'lucide-react';
import { format, parseISO, getWeek } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import { toast } from 'sonner';
import TruckVisualization, { TruckLayout, DEFAULT_LAYOUTS } from '@/components/dispatch/TruckVisualization';
import { TrolleySlotData } from '@/components/dispatch/TruckSlot';
import DeliveryStopCard, { DeliveryStop, DeliveryStopListItem } from '@/components/dispatch/DeliveryStopCard';
import TruckPrintView from '@/components/dispatch/TruckPrintView';
import TruckLayoutWizard from '@/components/dispatch/TruckLayoutWizard';
import type { TruckLayoutConfig } from '@/components/dispatch/TruckLayoutWizard';
import TruckLoadingView, { OrderForLoading, SlotAssignment } from '@/components/dispatch/TruckLoadingView';
import { cn } from '@/lib/utils';
import { Settings2, PackageOpen } from 'lucide-react';

interface DriverViewClientProps {
  activeRuns: ActiveDeliveryRunSummary[];
  initialRunId?: string;
}

type ViewMode = 'cards' | 'list';

// Persist view preference in localStorage
const STORAGE_KEY = 'driver-view-mode';

export default function DriverViewClient({ activeRuns, initialRunId }: DriverViewClientProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRunId || null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [isLoading, setIsLoading] = useState(false);
  const [deliveryStops, setDeliveryStops] = useState<DeliveryStop[]>([]);
  const [trolleys, setTrolleys] = useState<TrolleySlotData[]>([]);
  const [truckLayout, setTruckLayout] = useState<TruckLayout>(DEFAULT_LAYOUTS.van);
  const [isLayoutWizardOpen, setIsLayoutWizardOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Filters for route selection
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [weekFilter, setWeekFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');

  // Get unique filter options from runs
  const filterOptions = useMemo(() => {
    const drivers = new Set<string>();
    const weeks = new Set<number>();
    const vehicles = new Set<string>();

    activeRuns.forEach(run => {
      if (run.driverName) drivers.add(run.driverName);
      if (run.runDate) {
        try {
          weeks.add(getWeek(parseISO(run.runDate)));
        } catch {}
      }
      if (run.vehicleName) vehicles.add(run.vehicleName);
    });

    return {
      drivers: Array.from(drivers).sort(),
      weeks: Array.from(weeks).sort((a, b) => a - b),
      vehicles: Array.from(vehicles).sort(),
    };
  }, [activeRuns]);

  // Filter runs based on selected filters
  const filteredRuns = useMemo(() => {
    return activeRuns.filter(run => {
      // Driver filter
      if (driverFilter !== 'all') {
        if (!run.driverName || run.driverName !== driverFilter) return false;
      }

      // Week filter
      if (weekFilter !== 'all') {
        if (!run.runDate) return false;
        try {
          const runWeek = getWeek(parseISO(run.runDate));
          if (runWeek !== parseInt(weekFilter)) return false;
        } catch {
          return false;
        }
      }

      // Vehicle filter
      if (vehicleFilter !== 'all') {
        if (!run.vehicleName || run.vehicleName !== vehicleFilter) return false;
      }

      return true;
    });
  }, [activeRuns, driverFilter, weekFilter, vehicleFilter]);

  // Check if any filter is active
  const hasActiveFilters = driverFilter !== 'all' || weekFilter !== 'all' || vehicleFilter !== 'all';

  // Clear all filters
  const clearFilters = () => {
    setDriverFilter('all');
    setWeekFilter('all');
    setVehicleFilter('all');
  };

  const selectedRun = activeRuns.find(r => r.id === selectedRunId);

  // Load view preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'list' || saved === 'cards') {
      setViewMode(saved);
    }
  }, []);

  // Save view preference
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  // Load delivery details when run is selected
  useEffect(() => {
    if (selectedRunId) {
      loadDeliveryDetails(selectedRunId);
    }
  }, [selectedRunId]);

  const loadDeliveryDetails = async (runId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dispatch/runs/${runId}`);
      if (!res.ok) throw new Error('Failed to load delivery details');
      
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load delivery details');
      const data = json.run;
      
      // Transform delivery items to stops
      // Server returns "items" with camelCase properties
      const stops: DeliveryStop[] = (data.items || []).map((item: any, idx: number) => ({
        id: item.id,
        sequenceNumber: item.sequenceNumber || idx + 1,
        orderNumber: item.order?.orderNumber || 'N/A',
        customerName: item.order?.customerName || 'Unknown',
        customerPhone: item.order?.customerPhone,
        address: item.order?.shipToAddress ? {
          line1: item.order.shipToAddress.line1,
          line2: item.order.shipToAddress.line2,
          city: item.order.shipToAddress.city,
          county: item.order.shipToAddress.county,
          eircode: item.order.shipToAddress.eircode,
        } : undefined,
        trolleysDelivered: item.trolleysDelivered || 0,
        trolleysReturned: item.trolleysReturned || 0,
        trolleysOutstanding: (item.trolleysDelivered || 0) - (item.trolleysReturned || 0),
        status: item.status || 'pending',
        deliveryNotes: item.deliveryNotes,
        estimatedDeliveryTime: item.estimatedDeliveryTime,
        actualDeliveryTime: item.actualDeliveryTime,
      }));
      
      setDeliveryStops(stops);
      
      // Generate trolley data for visualization
      const trolleyData: TrolleySlotData[] = [];
      let slotIndex = 0;
      stops.forEach((stop, stopIdx) => {
        for (let i = 0; i < stop.trolleysDelivered; i++) {
          trolleyData.push({
            id: `${stop.id}-${i}`,
            trolleyNumber: `T${slotIndex + 1}`,
            customerName: stop.customerName,
            orderNumber: stop.orderNumber,
            stopIndex: stopIdx,
            slotIndex: slotIndex,
          });
          slotIndex++;
        }
      });
      setTrolleys(trolleyData);
      
      // Set truck layout - use default for now, vehicle layout can be added later
      // TODO: Add truck_layout column to haulier_vehicles and fetch here
      setTruckLayout(DEFAULT_LAYOUTS.van);
    } catch (error) {
      console.error('Failed to load delivery details:', error);
      toast.error('Failed to load delivery details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkDelivered = async (deliveryItemId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dispatch/items/${deliveryItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'delivered',
          actualDeliveryTime: new Date().toISOString(),
        }),
      });
      
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to mark as delivered');
      
      setDeliveryStops(prev => 
        prev.map(stop => 
          stop.id === deliveryItemId 
            ? { ...stop, status: 'delivered', actualDeliveryTime: new Date().toISOString() }
            : stop
        )
      );
      
      toast.success('Marked as delivered');
    } catch (error) {
      toast.error('Failed to mark as delivered');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (selectedRunId) {
      loadDeliveryDetails(selectedRunId);
    }
  };

  // Native print functionality
  const handlePrint = useCallback(() => {
    if (!printRef.current) return;
    
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Delivery - ${selectedRun?.runNumber || 'Route'}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 10mm; }
            @page { size: A4 portrait; margin: 10mm; }
            @media print {
              body { padding: 0; }
              .print-colors { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          </style>
        </head>
        <body class="print-colors">
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }, [selectedRun?.runNumber]);

  // Progress calculations
  const completedStops = deliveryStops.filter(s => s.status === 'delivered').length;
  const pendingStops = deliveryStops.filter(s => s.status === 'pending' || s.status === 'in_transit').length;

  // Handle truck layout wizard save
  const handleLayoutSave = async (layoutConfig: TruckLayoutConfig) => {
    // Convert wizard layout to TruckLayout format
    const newLayout: TruckLayout = {
      type: layoutConfig.vehicleType === 'custom' ? 'van' : layoutConfig.vehicleType,
      rows: Math.ceil(layoutConfig.trolleys.length / 5) || 2,
      columns: Math.min(layoutConfig.trolleys.length, 5) || 5,
      trolleySlots: layoutConfig.trolleys.length || 10,
    };
    setTruckLayout(newLayout);
    toast.success(`Layout "${layoutConfig.name}" applied`);
    
    // TODO: Save layout to vehicle in database
  };

  // Run Selection View
  if (!selectedRunId) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Select Your Route</h2>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            
            {/* Driver Filter */}
            {filterOptions.drivers.length > 0 && (
              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {filterOptions.drivers.map(driver => (
                    <SelectItem key={driver} value={driver}>{driver}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Week Filter */}
            {filterOptions.weeks.length > 0 && (
              <Select value={weekFilter} onValueChange={setWeekFilter}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="Week" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Weeks</SelectItem>
                  {filterOptions.weeks.map(week => (
                    <SelectItem key={week} value={week.toString()}>Week {week}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Vehicle Filter */}
            {filterOptions.vehicles.length > 0 && (
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {filterOptions.vehicles.map(vehicle => (
                    <SelectItem key={vehicle} value={vehicle}>{vehicle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Results count */}
        {hasActiveFilters && (
          <p className="text-sm text-muted-foreground">
            Showing {filteredRuns.length} of {activeRuns.length} routes
          </p>
        )}

        {/* Route Cards */}
        <div className="grid gap-4">
          {filteredRuns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Routes Found</h3>
                <p className="text-muted-foreground mb-4">
                  {hasActiveFilters 
                    ? 'No routes match your filters. Try adjusting your selection.'
                    : 'There are no delivery runs available.'}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredRuns.map(run => (
              <Card 
                key={run.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedRunId(run.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                        <Truck className="h-7 w-7 text-primary" />
                      </div>
                      <div>
                        {/* Driver/Load name is the main element */}
                        <div className="text-lg font-bold">
                          {run.driverName || run.loadName || 'Unassigned Route'}
                        </div>
                        {/* Run number is smaller */}
                        <div className="text-sm text-muted-foreground font-mono">
                          {run.runNumber}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>{format(parseISO(run.runDate), 'EEEE, MMM d')}</span>
                          {run.vehicleName && (
                            <>
                              <span>•</span>
                              <span>{run.vehicleName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={run.status === 'in_transit' ? 'default' : 'secondary'}>
                        {run.status.replace('_', ' ')}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">
                        {run.pendingDeliveries} stop{run.pendingDeliveries !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  // Route View (when run is selected)
  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setSelectedRunId(null)}
        >
          ← Back to routes
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
          <Badge variant="outline" className="text-lg px-3 py-1">
            {selectedRun?.runNumber}
          </Badge>
        </div>
      </div>

      {/* Progress Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {completedStops}
              </div>
              <div className="text-xs text-muted-foreground">Delivered</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {pendingStops}
              </div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {deliveryStops.length}
              </div>
              <div className="text-xs text-muted-foreground">Total Stops</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Tabs */}
      <Tabs defaultValue="truck" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="load">
              <PackageOpen className="h-4 w-4 mr-2" />
              Load Truck
            </TabsTrigger>
            <TabsTrigger value="truck">
              <Truck className="h-4 w-4 mr-2" />
              Truck View
            </TabsTrigger>
            <TabsTrigger value="stops">
              <MapPin className="h-4 w-4 mr-2" />
              Delivery Stops
            </TabsTrigger>
          </TabsList>

          {/* Card/List toggle for stops view */}
          <div className="flex items-center border rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('cards')}
              className={cn(
                'p-1.5 rounded',
                viewMode === 'cards' && 'bg-primary text-primary-foreground'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={cn(
                'p-1.5 rounded',
                viewMode === 'list' && 'bg-primary text-primary-foreground'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Load Truck Tab - Assign orders to specific slots */}
        <TabsContent value="load" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <TruckLoadingView
              layout={truckLayout}
              orders={deliveryStops.map((stop, idx) => ({
                id: stop.id,
                orderNumber: stop.orderNumber,
                customerName: stop.customerName,
                trolleysNeeded: stop.trolleysDelivered,
                stopIndex: idx,
              }))}
              onSave={async (assignments) => {
                // TODO: Save slot assignments to database
                console.log('Saving assignments:', assignments);
                // Update trolleys state to reflect assignments
                const newTrolleys: TrolleySlotData[] = assignments.map(a => {
                  const stop = deliveryStops.find(s => s.id === a.orderId);
                  return {
                    id: `${a.orderId}-${a.trolleyNumber}`,
                    trolleyNumber: `T${a.trolleyNumber}`,
                    customerName: stop?.customerName || 'Unknown',
                    orderNumber: stop?.orderNumber || '',
                    stopIndex: deliveryStops.findIndex(s => s.id === a.orderId),
                    slotIndex: a.slotIndex,
                  };
                });
                setTrolleys(newTrolleys);
              }}
            />
          )}
        </TabsContent>

        {/* Truck Visualization Tab */}
        <TabsContent value="truck" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Truck Layout
                    </CardTitle>
                    <CardDescription>
                      {truckLayout.type.charAt(0).toUpperCase() + truckLayout.type.slice(1)} - {truckLayout.trolleySlots} slots
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLayoutWizardOpen(true)}
                  >
                    <Settings2 className="h-4 w-4 mr-1" />
                    Configure
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TruckVisualization
                  layout={truckLayout}
                  trolleys={trolleys}
                  onSlotClick={(slotIndex, trolley) => {
                    if (trolley) {
                      toast.info(`${trolley.customerName} - Order #${trolley.orderNumber}`);
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Delivery Stops Tab */}
        <TabsContent value="stops" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : deliveryStops.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Delivery Stops</h3>
                <p className="text-muted-foreground">
                  No orders have been assigned to this route yet.
                </p>
              </CardContent>
            </Card>
          ) : viewMode === 'cards' ? (
            // Card View (mobile-friendly)
            <div className="space-y-3">
              {deliveryStops.map((stop, idx) => (
                <DeliveryStopCard
                  key={stop.id}
                  stop={stop}
                  stopIndex={idx}
                  onMarkDelivered={handleMarkDelivered}
                  isLoading={isLoading}
                />
              ))}
            </div>
          ) : (
            // List View (desktop-friendly)
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {deliveryStops.map((stop, idx) => (
                    <DeliveryStopListItem
                      key={stop.id}
                      stop={stop}
                      stopIndex={idx}
                      onMarkDelivered={handleMarkDelivered}
                      isLoading={isLoading}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Hidden Print View */}
      <div className="hidden">
        <TruckPrintView
          ref={printRef}
          layout={truckLayout}
          trolleys={trolleys}
          stops={deliveryStops}
          runNumber={selectedRun?.runNumber || ''}
          runDate={selectedRun?.runDate || new Date().toISOString()}
          driverName={selectedRun?.driverName}
          vehicleRegistration={selectedRun?.vehicleRegistration}
        />
      </div>

      {/* Truck Layout Wizard */}
      <TruckLayoutWizard
        open={isLayoutWizardOpen}
        onOpenChange={setIsLayoutWizardOpen}
        onSave={handleLayoutSave}
      />
    </div>
  );
}
