'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { useToast } from '@/components/ui/use-toast';
import PickListCard, { PickListCardData } from '@/components/sales/PickListCard';
import { RefreshCw, Filter, Users, Package } from 'lucide-react';
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

export default function PickingQueueClient({
  initialPickLists,
  teams,
  userTeamIds,
  userId,
}: PickingQueueClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pickLists, setPickLists] = useState<PickListCardData[]>(initialPickLists);
  const [selectedTeamId, setSelectedTeamId] = useState<string | 'all' | 'my'>(
    userTeamIds.length > 0 ? 'my' : 'all'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'in_progress'>('pending');

  const filteredPickLists = pickLists.filter(pl => {
    // Status filter
    if (activeTab === 'pending' && pl.status !== 'pending') return false;
    if (activeTab === 'in_progress' && pl.status !== 'in_progress') return false;
    
    // Team filter
    if (selectedTeamId === 'my') {
      return !pl.assignedTeamId || userTeamIds.includes(pl.assignedTeamId as string);
    }
    if (selectedTeamId !== 'all') {
      return pl.assignedTeamId === selectedTeamId;
    }
    return true;
  });

  const pendingCount = pickLists.filter(pl => pl.status === 'pending').length;
  const inProgressCount = pickLists.filter(pl => pl.status === 'in_progress').length;

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/picking?status=pending,in_progress');
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
      const res = await fetch(`/api/picking/${pickListId}`, {
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

      // Navigate to the picking workflow
      router.push(`/dispatch/picking/${pickListId}`);
    } catch (error) {
      console.error('Error starting pick list:', error);
      toast({
        title: 'Error',
        description: 'Failed to start picking',
        variant: 'destructive',
      });
    }
  };

  const handleSelectPickList = (pickListId: string) => {
    router.push(`/dispatch/picking/${pickListId}`);
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter:</span>
          <Select 
            value={selectedTeamId} 
            onValueChange={(v) => setSelectedTeamId(v as any)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {userTeamIds.length > 0 && (
                <SelectItem value="my">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    My Teams
                  </span>
                </SelectItem>
              )}
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
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
          {filteredPickLists.length === 0 ? (
            <EmptyState message="No pending pick lists" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPickLists
                .sort((a, b) => a.sequence - b.sequence)
                .map((pickList) => (
                  <PickListCard
                    key={pickList.id}
                    pickList={pickList}
                    onSelect={handleSelectPickList}
                    onStart={handleStartPicking}
                    showSequence
                  />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="in_progress" className="mt-4">
          {filteredPickLists.length === 0 ? (
            <EmptyState message="No picks in progress" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPickLists.map((pickList) => (
                <PickListCard
                  key={pickList.id}
                  pickList={pickList}
                  onSelect={handleSelectPickList}
                  showSequence
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
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

