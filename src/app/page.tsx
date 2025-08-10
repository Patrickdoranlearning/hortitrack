
'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import {
  PlusCircle,
  Search,
  Filter,
  Settings,
  ScanLine,
  LayoutDashboard,
} from 'lucide-react';
import type { Batch, LogEntry } from '@/lib/types';
import { INITIAL_BATCHES } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BatchCard } from '@/components/batch-card';
import { BatchForm, type BatchDistribution } from '@/components/batch-form';
import { CareRecommendationsDialog } from '@/components/care-recommendations-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Logo } from '@/components/logo';
import { TransplantForm } from '@/components/transplant-form';
import { ActionLogForm } from '@/components/action-log-form';
import { INITIAL_NURSERY_LOCATIONS, INITIAL_PLANT_SIZES } from '@/lib/constants';
import Link from 'next/link';
import { ScannerDialog } from '@/components/scanner-dialog';
import { useToast } from '@/hooks/use-toast';
import type { TransplantFormData } from '@/lib/types';
import { ScannedBatchActionsDialog } from '@/components/scanned-batch-actions-dialog';
import { ProductionProtocolDialog } from '@/components/production-protocol-dialog';

export default function DashboardPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    plantFamily: string;
    status: string;
    category: string;
  }>({ plantFamily: 'all', status: 'all', category: 'all' });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);

  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiBatch, setAiBatch] = useState<Batch | null>(null);

  const [isTransplantFormOpen, setIsTransplantFormOpen] = useState(false);
  const [transplantingBatch, setTransplantingBatch] = useState<Batch | null>(null);
  
  const [isActionLogFormOpen, setIsActionLogFormOpen] = useState(false);
  const [actionLogBatch, setActionLogBatch] = useState<Batch | null>(null);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { toast } = useToast();
  
  const [scannedBatch, setScannedBatch] = useState<Batch | null>(null);
  const [isScannedActionsOpen, setIsScannedActionsOpen] = useState(false);

  const [nurseryLocations, setNurseryLocations] = useState<string[]>([]);
  const [plantSizes, setPlantSizes] = useState<string[]>([]);

  const [isProtocolDialogOpen, setIsProtocolDialogOpen] = useState(false);
  const [protocolBatch, setProtocolBatch] = useState<Batch | null>(null);
  
  const [batchDistribution, setBatchDistribution] = useState<BatchDistribution | null>(null);
  
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const storedBatches = localStorage.getItem('batches');
    if (storedBatches) {
      setBatches(JSON.parse(storedBatches));
    } else {
      setBatches(INITIAL_BATCHES);
    }
    
    const storedLocationsRaw = localStorage.getItem('nurseryLocations');
    if (storedLocationsRaw) {
      const storedLocations = JSON.parse(storedLocationsRaw);
      if (storedLocations && storedLocations.length > 0) {
        setNurseryLocations(storedLocations);
      } else {
        setNurseryLocations(INITIAL_NURSERY_LOCATIONS);
      }
    } else {
      setNurseryLocations(INITIAL_NURSERY_LOCATIONS);
    }

    const storedSizesRaw = localStorage.getItem('plantSizes');
    if (storedSizesRaw) {
      const storedSizes = JSON.parse(storedSizesRaw);
      if (storedSizes && storedSizes.length > 0) {
        setPlantSizes(storedSizes);
      } else {
        setPlantSizes(INITIAL_PLANT_SIZES);
      }
    } else {
      setPlantSizes(INITIAL_PLANT_SIZES);
    }
  }, []);
  
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('batches', JSON.stringify(batches));
    }
  }, [batches, isClient]);

  const plantFamilies = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.plantFamily)))], [batches]);
  const categories = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.category)))], [batches]);
  const statuses = useMemo(() => ['all', 'Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good', 'Archived'], []);

  const filteredBatches = useMemo(() => {
    return batches
      .filter((batch) =>
        `${batch.plantFamily} ${batch.plantVariety} ${batch.category} ${batch.supplier || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter(
        (batch) =>
          filters.plantFamily === 'all' || batch.plantFamily === filters.plantFamily
      )
      .filter(
        (batch) =>
          filters.category === 'all' || batch.category === filters.category
      )
      .filter(
        (batch) =>
          filters.status === 'all' || batch.status === filters.status
      );
  }, [batches, searchQuery, filters]);

  const getNextBatchNumber = () => {
    const maxBatchNum = batches.reduce((max, b) => {
        const numPart = parseInt(b.batchNumber.split('-')[1] || '0');
        return numPart > max ? numPart : max;
    }, -1);
    return (maxBatchNum + 1).toString().padStart(6, '0');
  }

  const handleNewBatch = () => {
    setEditingBatch(null);
    setBatchDistribution(null);
    setIsFormOpen(true);
  };

  const handleEditBatch = (batch: Batch) => {
    const transplantedQuantity = batches.filter(b => b.transplantedFrom === batch.batchNumber).reduce((sum, b) => sum + b.initialQuantity, 0);
    const lossLogRegex = /Logged (\d+) units as loss|Adjusted quantity by -(\d+)|Archived with loss of (\d+)/;
    const lostQuantity = batch.logHistory.reduce((sum, log) => {
      const match = log.action.match(lossLogRegex);
      if (match) {
        return sum + (parseInt(match[1], 10) || parseInt(match[2], 10) || parseInt(match[3], 10));
      }
      return sum;
    }, 0);
    const remainingInStock = batch.quantity;
    
    setBatchDistribution({
      inStock: remainingInStock,
      transplanted: transplantedQuantity,
      lost: lostQuantity,
    });
    setEditingBatch(batch);
    setIsFormOpen(true);
  };

  const handleArchiveBatch = (batchId: string) => {
    const today = new Date().toISOString().split('T')[0];
    setBatches(batches.map(b => {
        if (b.id === batchId) {
            const lossQuantity = b.quantity;
            const lossLog: LogEntry = {
                date: today,
                action: `Archived with loss of ${lossQuantity} units.`,
            };
            return {
                ...b,
                quantity: 0,
                status: 'Archived',
                logHistory: [lossLog, ...b.logHistory],
            };
        }
        return b;
    }));
    setIsFormOpen(false);
    setEditingBatch(null);
  }

  const handleFormSubmit = (data: Omit<Batch, 'id'>) => {
    if (editingBatch) {
      setBatches(batches.map((b) => (b.id === data.id ? data as Batch : b)));
    } else {
       const batchNumberPrefix = {
        'Propagation': '1',
        'Plugs/Liners': '2',
        'Potted': '3',
        'Ready for Sale': '4',
        'Looking Good': '6',
        'Archived': '5'
      };
      const nextBatchNumStr = getNextBatchNumber();
      const prefixedBatchNumber = `${batchNumberPrefix[data.status]}-${nextBatchNumStr}`;
      
      setBatches([{ ...data, id: Date.now().toString(), batchNumber: prefixedBatchNumber, supplier: data.supplier || 'Doran Nurseries' } as Batch, ...batches]);
    }
    setIsFormOpen(false);
    setEditingBatch(null);
    setBatchDistribution(null);
  };

  const handleGetRecommendations = (batch: Batch) => {
    setAiBatch(batch);
    setIsAiDialogOpen(true);
  };

  const handleTransplantBatch = (batch: Batch) => {
    setTransplantingBatch(batch);
    setIsTransplantFormOpen(true);
  };

  const handleTransplantFormSubmit = (data: TransplantFormData) => {
    const nextBatchNumStr = getNextBatchNumber();

    const batchNumberPrefix = {
      'Propagation': '1',
      'Plugs/Liners': '2',
      'Potted': '3',
      'Ready for Sale': '4',
      'Looking Good': '6',
      'Archived': '5',
    };

    const prefixedBatchNumber = `${
      batchNumberPrefix[data.status]
    }-${nextBatchNumStr}`;

    const newBatch: Batch = {
      ...data,
      id: Date.now().toString(),
      batchNumber: prefixedBatchNumber,
      supplier: 'Doran Nurseries',
      initialQuantity: data.quantity,
    };

    const today = new Date().toISOString().split('T')[0];

    const updatedBatches = batches.map((b) => {
      if (b.batchNumber === data.transplantedFrom) {
        const transplantLog: LogEntry = {
          date: today,
          action: `Transplanted ${data.quantity} units to new batch #${newBatch.batchNumber}.`,
        };
        const updatedBatch = {
            ...b,
            logHistory: [transplantLog, ...b.logHistory],
        };

        if (data.logRemainingAsLoss) {
          const lossQuantity = b.quantity - data.quantity;
          const lossLog: LogEntry = {
            date: today,
            action: `Logged ${lossQuantity} units as loss during transplant.`,
          };
          return {
            ...updatedBatch,
            quantity: 0, 
            status: 'Archived',
            logHistory: [lossLog, ...updatedBatch.logHistory],
          };
        }
        const newQuantity = b.quantity - data.quantity;
        return {
          ...updatedBatch,
          quantity: newQuantity,
          status: newQuantity === 0 ? 'Archived' : b.status,
        };
      }
      return b;
    });

    setBatches([newBatch, ...updatedBatches]);
    setIsTransplantFormOpen(false);
    setTransplantingBatch(null);
  };

  const handleLogAction = (batch: Batch) => {
    setActionLogBatch(batch);
    setIsActionLogFormOpen(true);
  };
  
  const handleActionLogFormSubmit = (data: any) => {
    if (!actionLogBatch) return;

    const today = new Date().toISOString().split('T')[0];
    let logMessage = '';

    const createLogEntry = (batch: Batch, message: string, locationUpdate?: string) => {
      const newLog: LogEntry = { date: today, action: message };
      const updatedBatch = { ...batch, logHistory: [newLog, ...batch.logHistory] };
      if (locationUpdate) {
        updatedBatch.location = locationUpdate;
      }
      return updatedBatch;
    };

    switch (data.actionType) {
      case 'log':
        logMessage = data.logMessage;
        setBatches(batches.map(b => b.id === actionLogBatch.id ? createLogEntry(b, logMessage) : b));
        break;
      case 'move':
        logMessage = `Moved batch from ${actionLogBatch.location} to ${data.newLocation}`;
        setBatches(batches.map(b => b.id === actionLogBatch.id ? createLogEntry(b, logMessage, data.newLocation) : b));
        break;
      case 'split':
        const nextBatchNumStr = getNextBatchNumber();
        const batchNumberPrefix = '3'; // Potted
        const prefixedBatchNumber = `${batchNumberPrefix}-${nextBatchNumStr}`;
        
        const newBatch: Batch = {
            ...actionLogBatch,
            id: Date.now().toString(),
            batchNumber: prefixedBatchNumber,
            initialQuantity: data.splitQuantity,
            quantity: data.splitQuantity,
            location: data.newLocation,
            plantingDate: data.newBatchPlantingDate,
            logHistory: [{ date: today, action: `Split from batch #${actionLogBatch.batchNumber}` }],
            transplantedFrom: actionLogBatch.batchNumber,
            supplier: 'Doran Nurseries',
        };

        const updatedBatchesForSplit = batches.map(b => {
            if (b.id === actionLogBatch.id) {
                const newQuantity = b.quantity - data.splitQuantity;
                const message = `Split ${data.splitQuantity} units to new batch #${newBatch.batchNumber}`;
                const updatedBatch = createLogEntry(b, message);
                return { ...updatedBatch, quantity: newQuantity, status: newQuantity === 0 ? 'Archived' : b.status};
            }
            return b;
        });

        setBatches([newBatch, ...updatedBatchesForSplit]);
        break;
      case 'adjust':
        logMessage = `Adjusted quantity by -${data.adjustQuantity}. Reason: ${data.adjustReason}`;
        const updatedBatchesForAdjust = batches.map(b => {
            if (b.id === actionLogBatch.id) {
                const newQuantity = b.quantity - data.adjustQuantity;
                const updatedBatch = createLogEntry(b, logMessage);
                return { ...updatedBatch, quantity: newQuantity, status: newQuantity === 0 ? 'Archived' : b.status };
            }
            return b;
        });
        setBatches(updatedBatchesForAdjust);
        break;
      case 'Batch Spaced':
      case 'Batch Trimmed':
        logMessage = data.actionType;
        setBatches(batches.map(b => b.id === actionLogBatch.id ? createLogEntry(b, logMessage) : b));
        break;
    }
    
    setIsActionLogFormOpen(false);
    setActionLogBatch(null);
  };

  const handleScanSuccess = (scannedData: string) => {
    const foundBatch = batches.find(b => b.batchNumber === scannedData);
    if (foundBatch) {
      setScannedBatch(foundBatch);
      setIsScannedActionsOpen(true);
    } else {
      toast({
        variant: 'destructive',
        title: 'Batch not found',
        description: `No batch found with code: ${scannedData}`,
      });
    }
    setIsScannerOpen(false);
  };

  const handleGenerateProtocol = (batch: Batch) => {
    setProtocolBatch(batch);
    setIsProtocolDialogOpen(true);
  };

  if (!isClient) {
    return null; // or a loading spinner
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-auto flex-col gap-4 border-b bg-background/80 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
                <Link href="/dashboard">
                    <LayoutDashboard />
                    Dashboard
                </Link>
            </Button>
            <Button asChild variant="outline">
                <Link href="/settings">
                    <Settings />
                    Settings
                </Link>
            </Button>
            <Button onClick={() => setIsScannerOpen(true)} size="lg">
                <ScanLine />
                Scan Code
            </Button>
            <Button onClick={handleNewBatch} size="lg">
                <PlusCircle />
                New Batch
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <h1 className="text-3xl font-headline text-foreground/80">
                Nursery Stock
            </h1>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by category, family, variety, or supplier..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-muted-foreground" />
            <Select
              value={filters.category}
              onValueChange={(value) =>
                setFilters({ ...filters, category: value })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === 'all' ? 'All Categories' : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.plantFamily}
              onValueChange={(value) =>
                setFilters({ ...filters, plantFamily: value })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by family" />
              </SelectTrigger>
              <SelectContent>
                {plantFamilies.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === 'all' ? 'All Plant Families' : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters({ ...filters, status: value })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'all' ? 'All Statuses' : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">
        {filteredBatches.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBatches.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                onEdit={handleEditBatch}
                onGetRecommendations={handleGetRecommendations}
                onTransplant={handleTransplantBatch}
                onLogAction={handleLogAction}
                onGenerateProtocol={handleGenerateProtocol}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card/50">
            <p className="text-lg font-medium text-muted-foreground">
              No batches found.
            </p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters, or create a new batch.
            </p>
          </div>
        )}
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl">
          <BatchForm
            batch={editingBatch}
            distribution={batchDistribution}
            onSubmit={handleFormSubmit}
            onCancel={() => setIsFormOpen(false)}
            onArchive={handleArchiveBatch}
            nurseryLocations={nurseryLocations}
            plantSizes={plantSizes}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isTransplantFormOpen} onOpenChange={setIsTransplantFormOpen}>
        <DialogContent className="max-w-2xl">
          <TransplantForm
            batch={transplantingBatch}
            onSubmit={handleTransplantFormSubmit}
            onCancel={() => setIsTransplantFormOpen(false)}
            nurseryLocations={nurseryLocations}
            plantSizes={plantSizes}
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={isActionLogFormOpen} onOpenChange={setIsActionLogFormOpen}>
        <DialogContent className="max-w-2xl">
          <ActionLogForm
            batch={actionLogBatch}
            onSubmit={handleActionLogFormSubmit}
            onCancel={() => setIsActionLogFormOpen(false)}
            nurseryLocations={nurseryLocations}
            plantSizes={plantSizes}
          />
        </DialogContent>
      </Dialog>

      <CareRecommendationsDialog
        open={isAiDialogOpen}
        onOpenChange={setIsAiDialogOpen}
        batch={aiBatch}
      />
      
      <ProductionProtocolDialog
        open={isProtocolDialogOpen}
        onOpenChange={setIsProtocolDialogOpen}
        batch={protocolBatch}
      />

      <ScannerDialog 
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScanSuccess={handleScanSuccess}
      />
      
      <ScannedBatchActionsDialog
        open={isScannedActionsOpen}
        onOpenChange={setIsScannedActionsOpen}
        batch={scannedBatch}
        onLogAction={() => {
            setIsScannedActionsOpen(false);
            if (scannedBatch) handleLogAction(scannedBatch);
        }}
        onTransplant={() => {
            setIsScannedActionsOpen(false);
            if (scannedBatch) handleTransplantBatch(scannedBatch);
        }}
        onGetRecommendations={() => {
            setIsScannedActionsOpen(false);
            if (scannedBatch) handleGetRecommendations(scannedBatch);
        }}
        onEdit={() => {
            setIsScannedActionsOpen(false);
            if (scannedBatch) handleEditBatch(scannedBatch);
        }}
        onGenerateProtocol={() => {
            setIsScannedActionsOpen(false);
            if (scannedBatch) handleGenerateProtocol(scannedBatch);
        }}
      />
    </div>
  );
}
