
'use client';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import {
  ActionLogFormValues,
  Batch,
  NurseryLocation,
  PlantSize,
  Supplier,
  Variety,
} from '@/lib/types';
import { signOut } from 'firebase/auth';
import {
  Grid,
  LayoutGrid,
  LogOut,
  Plus,
  QrCode,
  Search,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ActionLogForm } from '../components/action-log-form';
import { BatchCard } from '../components/batch-card';
import { BatchDetailDialog } from '../components/batch-detail-dialog';
import { BatchDistribution, BatchForm } from '../components/batch-form';
import { CareRecommendationsDialog } from '../components/care-recommendations-dialog';
import { ProductionProtocolDialog } from '../components/production-protocol-dialog';
import { ScannedBatchActionsDialog } from '../components/scanned-batch-actions-dialog';
import { ScannerDialog } from '../components/scanner-dialog';
import {
  TransplantForm,
  TransplantFormData,
} from '../components/transplant-form';
import { VarietyForm } from '../components/variety-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useCollection } from '@/hooks/use-collection';

interface HomePageViewProps {
  initialBatches: Batch[];
  initialVarieties: Variety[];
  initialNurseryLocations: NurseryLocation[];
  initialPlantSizes: PlantSize[];
  initialSuppliers: Supplier[];
  plantFamilies: string[];
  categories: string[];
  actions: {
    addBatch: (
      data: Omit<Batch, 'id' | 'batchNumber' | 'createdAt' | 'updatedAt' | 'logHistory'>
    ) => Promise<any>;
    updateBatch: (data: Batch) => Promise<any>;
    archiveBatch: (batchId: string, loss: number) => Promise<any>;
    transplantBatch: (
      sourceBatchId: string,
      newBatchData: Omit<
        Batch,
        | 'id'
        | 'batchNumber'
        | 'logHistory'
        | 'transplantedFrom'
        | 'createdAt'
        | 'updatedAt'
      >,
      transplantQuantity: number,
      logRemainingAsLoss: boolean
    ) => Promise<any>;
    logAction: (
      batchId: string,
      logData: Partial<ActionLogFormValues>
    ) => Promise<any>;
    addVariety: (data: Omit<Variety, 'id'>) => Promise<any>;
  };
}

export default function HomePageView({
  initialBatches,
  initialVarieties,
  initialNurseryLocations,
  initialPlantSizes,
  initialSuppliers,
  plantFamilies,
  categories,
  actions,
}: HomePageViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  // Use the initial data passed from the server component
  const { data: batches } = useCollection<Batch>('batches', initialBatches);
  const { data: varieties } = useCollection<Variety>(
    'varieties',
    initialVarieties
  );
  const { data: nurseryLocations } = useCollection<NurseryLocation>(
    'locations',
    initialNurseryLocations
  );
  const { data: plantSizes } = useCollection<PlantSize>(
    'sizes',
    initialPlantSizes
  );
  const { data: suppliers } = useCollection<Supplier>(
    'suppliers',
    initialSuppliers
  );

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isLogActionOpen, setIsLogActionOpen] = React.useState(false);
  const [isTransplantOpen, setIsTransplantOpen] = React.useState(false);
  const [isProtocolOpen, setIsProtocolOpen] = React.useState(false);
  const [isRecommendationsOpen, setIsRecommendationsOpen] =
    React.useState(false);
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);
  const [isScannedActionOpen, setIsScannedActionOpen] = React.useState(false);
  const [isVarietyFormOpen, setIsVarietyFormOpen] = React.useState(false);

  const [selectedBatch, setSelectedBatch] = React.useState<Batch | null>(null);
  const [newVarietyName, setNewVarietyName] = React.useState('');
  const [distribution, setDistribution] =
    React.useState<BatchDistribution | null>(null);

  const [filters, setFilters] = React.useState({
    plantFamily: 'all',
    category: 'all',
    status: 'Active',
  });
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredBatches = React.useMemo(() => {
    return batches
      .filter((batch) =>
        `${batch.plantFamily} ${batch.plantVariety} ${batch.category} ${
          batch.supplier || ''
        }`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
      .filter(
        (batch) =>
          filters.plantFamily === 'all' ||
          batch.plantFamily === filters.plantFamily
      )
      .filter(
        (batch) =>
          filters.category === 'all' || batch.category === filters.category
      )
      .filter((batch) => {
        if (filters.status === 'all') return true;
        if (filters.status === 'Active') return batch.status !== 'Archived';
        return batch.status === filters.status;
      });
  }, [batches, searchQuery, filters]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
    toast({
      title: 'Signed Out',
      description: 'You have been successfully signed out.',
    });
  };

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const calculateDistribution = (
    batch: Batch | null
  ): BatchDistribution | null => {
    if (!batch) return null;
    let transplanted = 0;
    let lost = 0;

    batch.logHistory.forEach((log) => {
      if (log.type === 'TRANSPLANT_TO' && typeof log.qty === 'number') {
        transplanted += Math.abs(log.qty);
      }
      if (log.type === 'LOSS' && typeof log.qty === 'number') {
        lost += log.qty;
      }
    });

    return {
      inStock: batch.quantity,
      transplanted,
      lost,
    };
  };

  const handleOpenForm = (batch?: Batch) => {
    setSelectedBatch(batch || null);
    setDistribution(calculateDistribution(batch || null));
    setIsFormOpen(true);
  };

  const handleOpenDetail = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsDetailOpen(true);
  };

  const handleLogAction = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsLogActionOpen(true);
  };

  const handleTransplant = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsTransplantOpen(true);
  };

  const handleGenerateProtocol = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsProtocolOpen(true);
  };

  const handleRecommendations = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsRecommendationsOpen(true);
  };

  const handleScanSuccess = (data: string) => {
    const foundBatch = batches.find((b) => b.batchNumber === data);
    if (foundBatch) {
      setSelectedBatch(foundBatch);
      setIsScannedActionOpen(true);
    }
  };

  const handleFormSubmit = async (data: any) => {
    const result = selectedBatch
      ? await actions.updateBatch(data)
      : await actions.addBatch(data);
    if (result?.success) {
      setIsFormOpen(false);
      setSelectedBatch(null);
    }
  };

  const handleArchive = async (batchId: string) => {
    await actions.archiveBatch(batchId, selectedBatch?.quantity || 0);
    setIsFormOpen(false);
    setSelectedBatch(null);
  };

  const handleLogActionSubmit = async (values: ActionLogFormValues) => {
    if (!selectedBatch?.id) return;
    await actions.logAction(selectedBatch.id, values);
    setIsLogActionOpen(false);
    setSelectedBatch(null);
  };

  const handleTransplantSubmit = async (data: TransplantFormData) => {
    if (!selectedBatch?.id) return;
    const { quantity, logRemainingAsLoss, ...newBatchData } = data;
    await actions.transplantBatch(
      selectedBatch.id,
      newBatchData,
      quantity,
      logRemainingAsLoss
    );
    setIsTransplantOpen(false);
    setSelectedBatch(null);
  };

  const handleCreateNewVariety = (name: string) => {
    setNewVarietyName(name);
    setIsVarietyFormOpen(true);
  };

  const handleVarietyFormSubmit = async (data: Omit<Variety, 'id'>) => {
    const result = await actions.addVariety(data);
    if (result.success) {
      setIsVarietyFormOpen(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen w-full flex-col p-6">
        <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 justify-between">
          <Logo />
          <Skeleton className="h-8 w-8 rounded-full" />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Header */}
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 justify-between z-10">
        <Logo />
        {/* ... unchanged header UI */}
      </header>

      {/* Main content */}
      {/* ... unchanged main UI */}

      {/* Create/Edit Batch */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-3xl">
              {selectedBatch ? 'Edit Batch' : 'Create New Batch'}
            </DialogTitle>
          </DialogHeader>
          <BatchForm
            batch={selectedBatch}
            distribution={distribution}
            onSubmit={handleFormSubmit}
            onCancel={() => setIsFormOpen(false)}
            onArchive={handleArchive}
            nurseryLocations={nurseryLocations ?? []}
            plantSizes={plantSizes ?? []}
            suppliers={suppliers ?? []}
            varieties={varieties ?? []}
            onCreateNewVariety={handleCreateNewVariety}
          />
        </DialogContent>
      </Dialog>

      {/* Log Action */}
      <Dialog open={isLogActionOpen} onOpenChange={setIsLogActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">
              Log Action for Batch #{selectedBatch?.batchNumber}
            </DialogTitle>
          </DialogHeader>
          <ActionLogForm
            batch={selectedBatch}
            nurseryLocations={nurseryLocations ?? []}
            onSubmit={handleLogActionSubmit}
            onCancel={() => setIsLogActionOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Transplant */}
      <Dialog open={isTransplantOpen} onOpenChange={setIsTransplantOpen}>
        <DialogContent className="max-w-4xl">
          <TransplantForm
            batch={selectedBatch}
            onSubmit={handleTransplantSubmit}
            onCancel={() => setIsTransplantOpen(false)}
            nurseryLocations={nurseryLocations ?? []}
            plantSizes={plantSizes ?? []}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
