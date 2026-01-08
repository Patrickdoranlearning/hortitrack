'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import PickListCard, { PickListCardData } from '@/components/sales/PickListCard';
import {
  RefreshCw,
  Filter,
  Users,
  Package,
  LayoutGrid,
  List,
  PlayCircle,
  Clock,
  MapPin,
  Layers,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PickingTeam {
  id: string;
  name: string;
  memberCount?: number;
}

interface PickingQueueClientProps {
  initialPickLists: PickListCardData[];
  teams: PickingTeam[];
  userTeamIds: string[];
  userId: string;
}

type ViewMode = 'cards' | 'table';

export default function PickingQueueClient({
  initialPickLists,
  teams,
  userTeamIds,
  userId,
}: PickingQueueClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pickLists, setPickLists] = useState<PickListCardData[]>(initialPickLists);
  const [selectedTeamId, setSelectedTeamId] = useState<string | 'all' | 'my'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'in_progress'>('pending');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedPickListIds, setSelectedPickListIds] = useState<Set<string>>(new Set());

  // Toggle selection for combined picking
  const toggleSelection = (id: string) => {
    const next = new Set(selectedPickListIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPickListIds(next);
  };

  const clearSelection = () => {
    setSelectedPickListIds(new Set());
  };

  const handleStartCombinedPicking = () => {
    if (selectedPickListIds.size < 2) {
      toast({
        title: 'Select at least 2 orders',
        description: 'Combined picking requires multiple orders',
        variant: 'destructive',
      });
      return;
    }
    const ids = Array.from(selectedPickListIds).join(',');
    router.push(`/dispatch/picking/combined?ids=${ids}`);
  };

  // Filter and sort pick lists - prioritize orders assigned to current user
  const filteredAndSortedPickLists = useMemo(() => {
    const filtered = pickLists.filter(pl => {
      // Status filter
      if (activeTab === 'pending' && pl.status !== 'pending') return false;
      if (activeTab === 'in_progress' && pl.status !== 'in_progress') return false;

      // Team filter
      if (selectedTeamId === 'my') {
        // Show orders assigned to me or my teams
        const isAssignedToMe = pl.assignedUserId === userId;
        const isMyTeam = pl.assignedTeamId && userTeamIds.includes(pl.assignedTeamId);
        return isAssignedToMe || isMyTeam || !pl.assignedTeamId;
      }
      if (selectedTeamId !== 'all') {
        return pl.assignedTeamId === selectedTeamId;
      }
      return true;
    });

    // Sort: Prioritize orders assigned to current user first, then by sequence
    return filtered.sort((a, b) => {
      const aIsAssignedToMe = a.assignedUserId === userId ? 0 : 1;
      const bIsAssignedToMe = b.assignedUserId === userId ? 0 : 1;

      if (aIsAssignedToMe !== bIsAssignedToMe) {
        return aIsAssignedToMe - bIsAssignedToMe;
      }

      // Then sort by sequence
      return a.sequence - b.sequence;
    });
  }, [pickLists, activeTab, selectedTeamId, userId, userTeamIds]);

  const pendingCount = pickLists.filter(pl => pl.status === 'pending').length;
  const inProgressCount = pickLists.filter(pl => pl.status === 'in_progress').length;
  const myAssignedCount = pickLists.filter(pl => pl.assignedUserId === userId && pl.status === 'pending').length;

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/picking?includeOrders=true');
      const data = await res.json();
      if (data.pickLists) {
        setPickLists(data.pickLists);
      }
    } catch (error) {
      console.error('Error refreshing pick lists:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh pick lists',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPicking = async (pickListId: string) => {
    try {
      let actualPickListId = pickListId;
      
      // Check if this is a virtual pick list (order without pick list created yet)
      if (pickListId.startsWith('pending-')) {
        const orderId = pickListId.replace('pending-', '');
        
        // Create pick list first
        const createRes = await fetch('/api/picking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
        
        const createData = await createRes.json();
        
        if (createData.error || !createData.pickList?.id) {
          toast({
            title: 'Error',
            description: createData.error || 'Failed to create pick list',
            variant: 'destructive',
          });
          return;
        }
        
        actualPickListId = createData.pickList.id;
      }
      
      // Start picking
      const res = await fetch(`/api/picking/${actualPickListId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      router.push(`/dispatch/picking/${actualPickListId}/workflow`);
    } catch (error) {
      console.error('Error starting pick list:', error);
      toast({
        title: 'Error',
        description: 'Failed to start picking',
        variant: 'destructive',
      });
    }
  };

  const handleSelectPickList = async (pickListId: string) => {
    // For virtual pick lists, just start picking (which will create the list)
    if (pickListId.startsWith('pending-')) {
      await handleStartPicking(pickListId);
      return;
    }
    router.push(`/dispatch/picking/${pickListId}/workflow`);
  };

  return (
    <div className="space-y-4">
      {/* Summary Banner for assigned orders */}
      {myAssignedCount > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
              {myAssignedCount}
            </div>
            <div>
              <p className="font-medium">Orders assigned to you</p>
              <p className="text-sm text-muted-foreground">These are prioritized at the top of your queue</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border rounded-lg p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter:</span>
          <Select 
            value={selectedTeamId} 
            onValueChange={(v) => setSelectedTeamId(v as typeof selectedTeamId)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              {userTeamIds.length > 0 && (
                <SelectItem value="my">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    My Teams & Assigned
                  </span>
                </SelectItem>
              )}
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pending" className="flex-1 sm:flex-none gap-2">
            <Package className="h-4 w-4" />
            Pending
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="flex-1 sm:flex-none gap-2">
            In Progress
            {inProgressCount > 0 && (
              <Badge variant="default" className="ml-1 bg-blue-500">
                {inProgressCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {filteredAndSortedPickLists.length === 0 ? (
            <EmptyState message="No pending pick lists" />
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedPickLists.map((pickList) => (
                <SelectablePickListCard
                  key={pickList.id}
                  pickList={pickList}
                  isSelected={selectedPickListIds.has(pickList.id)}
                  onToggleSelect={toggleSelection}
                  onSelect={handleSelectPickList}
                  onStart={handleStartPicking}
                  showSequence
                  isAssignedToMe={pickList.assignedUserId === userId}
                />
              ))}
            </div>
          ) : (
            <PickingTable
              pickLists={filteredAndSortedPickLists}
              userId={userId}
              onSelect={handleSelectPickList}
              onStart={handleStartPicking}
              selectedIds={selectedPickListIds}
              onToggleSelect={toggleSelection}
            />
          )}
        </TabsContent>

        <TabsContent value="in_progress" className="mt-4">
          {filteredAndSortedPickLists.length === 0 ? (
            <EmptyState message="No picks in progress" />
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedPickLists.map((pickList) => (
                <PickListCard
                  key={pickList.id}
                  pickList={pickList}
                  onSelect={handleSelectPickList}
                  showSequence
                  isAssignedToMe={pickList.assignedUserId === userId}
                />
              ))}
            </div>
          ) : (
            <PickingTable
              pickLists={filteredAndSortedPickLists}
              userId={userId}
              onSelect={handleSelectPickList}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Floating Action Button for Combined Picking */}
      {selectedPickListIds.size > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
            className="shadow-lg bg-background"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button
            size="lg"
            className="shadow-xl gap-2"
            onClick={handleStartCombinedPicking}
          >
            <Layers className="h-5 w-5" />
            Pick Selected ({selectedPickListIds.size})
          </Button>
        </div>
      )}
    </div>
  );
}

// Selectable wrapper for PickListCard (for combined picking)
function SelectablePickListCard({
  pickList,
  isSelected,
  onToggleSelect,
  onSelect,
  onStart,
  showSequence,
  isAssignedToMe,
}: {
  pickList: PickListCardData;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onSelect: (id: string) => void;
  onStart?: (id: string) => void;
  showSequence?: boolean;
  isAssignedToMe?: boolean;
}) {
  return (
    <div className="relative">
      {/* Checkbox overlay */}
      <div
        className={cn(
          "absolute top-2 left-2 z-10 p-1 rounded-md transition-colors",
          isSelected ? "bg-primary" : "bg-background/80 hover:bg-background"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(pickList.id);
        }}
      >
        <Checkbox
          checked={isSelected}
          className={cn(
            "h-5 w-5",
            isSelected && "border-primary-foreground data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          )}
        />
      </div>
      <div className={cn(isSelected && "ring-2 ring-primary ring-offset-2 rounded-lg")}>
        <PickListCard
          pickList={pickList}
          onSelect={onSelect}
          onStart={onStart}
          showSequence={showSequence}
          isAssignedToMe={isAssignedToMe}
        />
      </div>
    </div>
  );
}

// Table view component
function PickingTable({
  pickLists,
  userId,
  onSelect,
  onStart,
  selectedIds,
  onToggleSelect,
}: {
  pickLists: PickListCardData[];
  userId: string;
  onSelect: (id: string) => void;
  onStart?: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const showCheckboxes = selectedIds !== undefined && onToggleSelect !== undefined;

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {showCheckboxes && <TableHead className="w-[50px]" />}
            <TableHead className="w-[60px]">#</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Delivery Date</TableHead>
            <TableHead className="text-center">Items</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[120px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pickLists.map((pickList) => {
            const isAssignedToMe = pickList.assignedUserId === userId;
            const isSelected = selectedIds?.has(pickList.id) ?? false;
            return (
              <TableRow
                key={pickList.id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50",
                  isAssignedToMe && "bg-primary/5",
                  isSelected && "bg-primary/10"
                )}
                onClick={() => onSelect(pickList.id)}
              >
                {showCheckboxes && (
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect?.(pickList.id);
                      }}
                      className="h-5 w-5"
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm",
                    isAssignedToMe ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    {pickList.sequence}
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  #{pickList.orderNumber || pickList.id.slice(0, 8)}
                  {isAssignedToMe && (
                    <Badge variant="outline" className="ml-2 text-[10px] bg-primary/10 border-primary/20">
                      YOURS
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{pickList.customerName || '—'}</div>
                    {pickList.county && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {pickList.county}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {pickList.requestedDeliveryDate
                    ? format(new Date(pickList.requestedDeliveryDate), 'EEE, MMM d')
                    : '—'
                  }
                </TableCell>
                <TableCell className="text-center">
                  {pickList.totalItems !== undefined ? (
                    <span>
                      {pickList.pickedItems ?? 0} / {pickList.totalItems}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  {pickList.assignedUserName || pickList.teamName || (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  {pickList.status === 'pending' ? (
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  ) : pickList.status === 'in_progress' ? (
                    <Badge variant="default" className="bg-blue-500">
                      <PlayCircle className="h-3 w-3 mr-1" />
                      Picking
                    </Badge>
                  ) : (
                    <Badge variant="outline">{pickList.status}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {pickList.status === 'pending' && onStart ? (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStart(pickList.id);
                      }}
                    >
                      Start
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(pickList.id);
                      }}
                    >
                      View
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
