'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import {
  GripVertical,
  Users,
  Plus,
  RefreshCw,
  Package,
  Clock,
  ChevronUp,
  ChevronDown,
  UserPlus,
  Settings2,
  Trash2,
  Phone,
  Mail,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { PickList, PickingTeam, Employee, TeamEmployee } from '@/server/sales/picking';

interface PickSequenceManagerClientProps {
  initialPickLists: PickList[];
  teams: PickingTeam[];
  orgId: string;
}

export default function PickManagementClient({
  initialPickLists,
  teams,
  orgId,
}: PickSequenceManagerClientProps) {
  const { toast } = useToast();
  const [pickLists, setPickLists] = useState<PickList[]>(initialPickLists);
  const [allTeams, setAllTeams] = useState<PickingTeam[]>(teams);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | 'all' | 'unassigned'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [newTeamDialogOpen, setNewTeamDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  
  // Employee management state
  const [manageTeamSheetOpen, setManageTeamSheetOpen] = useState(false);
  const [manageEmployeesSheetOpen, setManageEmployeesSheetOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<PickingTeam | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamEmployee[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [newEmployeePhone, setNewEmployeePhone] = useState('');

  // Fetch employees on mount
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/picking/employees');
      const data = await res.json();
      if (data.employees) {
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    try {
      const res = await fetch(`/api/picking/employees?teamId=${teamId}`);
      const data = await res.json();
      if (data.members) {
        setTeamMembers(data.members);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const handleManageTeam = (team: PickingTeam) => {
    setSelectedTeam(team);
    setTeamMembers([]);
    fetchTeamMembers(team.id);
    setManageTeamSheetOpen(true);
  };

  const handleCreateEmployee = async () => {
    if (!newEmployeeName.trim()) return;

    try {
      const res = await fetch('/api/picking/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEmployeeName.trim(),
          role: newEmployeeRole.trim() || undefined,
          phone: newEmployeePhone.trim() || undefined,
        }),
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

      setEmployees(prev => [...prev, data.employee]);
      setNewEmployeeName('');
      setNewEmployeeRole('');
      setNewEmployeePhone('');

      toast({
        title: 'Employee added',
        description: `${data.employee.name} has been added`,
      });
    } catch (error) {
      console.error('Error creating employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to create employee',
        variant: 'destructive',
      });
    }
  };

  const handleAssignToTeam = async (employeeId: string, isLead: boolean = false) => {
    if (!selectedTeam) return;

    try {
      const res = await fetch('/api/picking/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          teamId: selectedTeam.id,
          employeeId,
          isLead,
        }),
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

      // Refresh team members
      fetchTeamMembers(selectedTeam.id);

      toast({
        title: 'Assigned',
        description: 'Employee assigned to team',
      });
    } catch (error) {
      console.error('Error assigning to team:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign employee',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveFromTeam = async (employeeId: string) => {
    if (!selectedTeam) return;

    try {
      const res = await fetch('/api/picking/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unassign',
          teamId: selectedTeam.id,
          employeeId,
        }),
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

      // Refresh team members
      fetchTeamMembers(selectedTeam.id);

      toast({
        title: 'Removed',
        description: 'Employee removed from team',
      });
    } catch (error) {
      console.error('Error removing from team:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove employee',
        variant: 'destructive',
      });
    }
  };

  // Group pick lists by team
  const unassignedLists = pickLists.filter(pl => !pl.assignedTeamId);
  const listsByTeam = allTeams.map(team => ({
    team,
    lists: pickLists.filter(pl => pl.assignedTeamId === team.id),
  }));

  // Filtered view
  const displayLists = selectedTeamFilter === 'all'
    ? pickLists
    : selectedTeamFilter === 'unassigned'
      ? unassignedLists
      : pickLists.filter(pl => pl.assignedTeamId === selectedTeamFilter);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/picking?status=pending,in_progress');
      const data = await res.json();
      if (data.pickLists) {
        setPickLists(data.pickLists);
      }
    } catch (error) {
      console.error('Error refreshing:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh pick lists',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignTeam = async (pickListId: string, teamId: string | null) => {
    try {
      const res = await fetch(`/api/picking/${pickListId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          teamId: teamId === 'unassigned' ? null : teamId,
        }),
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

      // Update local state
      setPickLists(prev =>
        prev.map(pl =>
          pl.id === pickListId
            ? { ...pl, assignedTeamId: teamId === 'unassigned' ? undefined : teamId }
            : pl
        )
      );

      toast({
        title: 'Team assigned',
        description: teamId ? 'Order assigned to team' : 'Order unassigned',
      });
    } catch (error) {
      console.error('Error assigning team:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign team',
        variant: 'destructive',
      });
    }
  };

  const handleMoveUp = async (pickListId: string, currentSequence: number) => {
    const targetList = displayLists.find(pl => pl.id === pickListId);
    if (!targetList) return;

    // Find the item above
    const sortedLists = displayLists.sort((a, b) => a.sequence - b.sequence);
    const currentIndex = sortedLists.findIndex(pl => pl.id === pickListId);
    if (currentIndex <= 0) return;

    const aboveList = sortedLists[currentIndex - 1];

    // Swap sequences
    await handleReorderSequence(pickListId, aboveList.sequence);
    await handleReorderSequence(aboveList.id, currentSequence);
  };

  const handleMoveDown = async (pickListId: string, currentSequence: number) => {
    const targetList = displayLists.find(pl => pl.id === pickListId);
    if (!targetList) return;

    // Find the item below
    const sortedLists = displayLists.sort((a, b) => a.sequence - b.sequence);
    const currentIndex = sortedLists.findIndex(pl => pl.id === pickListId);
    if (currentIndex >= sortedLists.length - 1) return;

    const belowList = sortedLists[currentIndex + 1];

    // Swap sequences
    await handleReorderSequence(pickListId, belowList.sequence);
    await handleReorderSequence(belowList.id, currentSequence);
  };

  const handleReorderSequence = async (pickListId: string, newSequence: number) => {
    try {
      await fetch(`/api/picking/${pickListId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          sequence: newSequence,
        }),
      });

      // Update local state
      setPickLists(prev =>
        prev.map(pl =>
          pl.id === pickListId ? { ...pl, sequence: newSequence } : pl
        )
      );
    } catch (error) {
      console.error('Error reordering:', error);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    try {
      const res = await fetch('/api/picking/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName.trim() }),
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

      setAllTeams(prev => [...prev, data.team]);
      setNewTeamName('');
      setNewTeamDialogOpen(false);

      toast({
        title: 'Team created',
        description: `${data.team.name} has been created`,
      });
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: 'Error',
        description: 'Failed to create team',
        variant: 'destructive',
      });
    }
  };

  const pendingCount = pickLists.filter(pl => pl.status === 'pending').length;
  const inProgressCount = pickLists.filter(pl => pl.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{pickLists.length}</div>
          <div className="text-sm text-muted-foreground">Total Orders</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          <div className="text-sm text-muted-foreground">Pending</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
          <div className="text-sm text-muted-foreground">In Progress</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{allTeams.length}</div>
          <div className="text-sm text-muted-foreground">Teams</div>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border rounded-lg p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={selectedTeamFilter}
            onValueChange={(v) => setSelectedTeamFilter(v as any)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              <SelectItem value="unassigned">
                <span className="flex items-center gap-2 text-amber-600">
                  <Package className="h-4 w-4" />
                  Unassigned ({unassignedLists.length})
                </span>
              </SelectItem>
              {allTeams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {team.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={newTeamDialogOpen} onOpenChange={setNewTeamDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                New Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Picking Team</DialogTitle>
                <DialogDescription>
                  Create a new team to assign pick lists to
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Morning Shift"
                  className="mt-2"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewTeamDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
                  Create Team
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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

      {/* Pick Lists Table */}
      <Card>
        <div className="p-4 border-b">
          <h2 className="font-semibold">Pick Queue</h2>
          <p className="text-sm text-muted-foreground">
            Drag to reorder or use arrows to change sequence. Lower sequence = higher priority.
          </p>
        </div>

        {displayLists.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No pick lists found</p>
          </div>
        ) : (
          <div className="divide-y">
            {displayLists
              .sort((a, b) => a.sequence - b.sequence)
              .map((pickList, index) => (
                <PickListRow
                  key={pickList.id}
                  pickList={pickList}
                  teams={allTeams}
                  onAssignTeam={handleAssignTeam}
                  onMoveUp={() => handleMoveUp(pickList.id, pickList.sequence)}
                  onMoveDown={() => handleMoveDown(pickList.id, pickList.sequence)}
                  isFirst={index === 0}
                  isLast={index === displayLists.length - 1}
                />
              ))}
          </div>
        )}
      </Card>

      {/* Team Workload Overview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Teams & Employees</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManageEmployeesSheetOpen(true)}
            className="gap-2"
          >
            <User className="h-4 w-4" />
            Manage Employees
          </Button>
        </div>
        
        {allTeams.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-2">No Teams Created</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create picking teams to organize your staff and assign orders.
            </p>
            <Button onClick={() => setNewTeamDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Team
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listsByTeam.map(({ team, lists }) => (
              <Card key={team.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{team.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{lists.length} orders</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleManageTeam(team)}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {lists.filter(l => l.status === 'pending').length} pending,{' '}
                  {lists.filter(l => l.status === 'in_progress').length} in progress
                </div>
                {team.memberCount !== undefined && team.memberCount > 0 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {team.memberCount} team member{team.memberCount !== 1 ? 's' : ''}
                  </div>
                )}
              </Card>
            ))}

            {unassignedLists.length > 0 && (
              <Card className="p-4 border-dashed border-amber-500">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-amber-500" />
                    <span className="font-medium text-amber-600">Unassigned</span>
                  </div>
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    {unassignedLists.length} orders
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Orders need to be assigned to a team
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Manage Team Sheet */}
      <Sheet open={manageTeamSheetOpen} onOpenChange={setManageTeamSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Manage {selectedTeam?.name}</SheetTitle>
            <SheetDescription>
              Add or remove employees from this picking team
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="members" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">Team Members</TabsTrigger>
              <TabsTrigger value="employees">All Employees</TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="space-y-4 mt-4">
              {teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No team members assigned yet. Go to &quot;All Employees&quot; to add members.
                </p>
              ) : (
                <div className="space-y-2">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {member.employeeName}
                            {member.isLead && (
                              <Badge variant="secondary" className="text-xs">Lead</Badge>
                            )}
                          </div>
                          {member.employeeRole && (
                            <div className="text-xs text-muted-foreground">
                              {member.employeeRole}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveFromTeam(member.employeeId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="employees" className="space-y-4 mt-4">
              {/* Add new employee form */}
              <Card className="p-4">
                <h4 className="font-medium text-sm mb-3">Add New Employee</h4>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="empName">Name *</Label>
                    <Input
                      id="empName"
                      value={newEmployeeName}
                      onChange={(e) => setNewEmployeeName(e.target.value)}
                      placeholder="John Smith"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="empRole">Role</Label>
                      <Input
                        id="empRole"
                        value={newEmployeeRole}
                        onChange={(e) => setNewEmployeeRole(e.target.value)}
                        placeholder="Picker"
                      />
                    </div>
                    <div>
                      <Label htmlFor="empPhone">Phone</Label>
                      <Input
                        id="empPhone"
                        value={newEmployeePhone}
                        onChange={(e) => setNewEmployeePhone(e.target.value)}
                        placeholder="+353..."
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateEmployee}
                    disabled={!newEmployeeName.trim()}
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </div>
              </Card>

              {/* Employee list */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Available Employees</h4>
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No employees added yet. Create one above.
                  </p>
                ) : (
                  employees.map((emp) => {
                    const isAssigned = teamMembers.some(m => m.employeeId === emp.id);
                    return (
                      <div
                        key={emp.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          isAssigned && "bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{emp.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {emp.role || 'No role specified'}
                              {emp.phone && ` • ${emp.phone}`}
                            </div>
                          </div>
                        </div>
                        {isAssigned ? (
                          <Badge variant="secondary">Assigned</Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssignToTeam(emp.id)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Add to Team
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Manage All Employees Sheet */}
      <Sheet open={manageEmployeesSheetOpen} onOpenChange={setManageEmployeesSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Manage Employees</SheetTitle>
            <SheetDescription>
              Add employees who can be assigned to picking teams
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Add new employee form */}
            <Card className="p-4">
              <h4 className="font-medium text-sm mb-3">Add New Employee</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="newEmpName">Name *</Label>
                  <Input
                    id="newEmpName"
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="newEmpRole">Role</Label>
                    <Input
                      id="newEmpRole"
                      value={newEmployeeRole}
                      onChange={(e) => setNewEmployeeRole(e.target.value)}
                      placeholder="Picker"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newEmpPhone">Phone</Label>
                    <Input
                      id="newEmpPhone"
                      value={newEmployeePhone}
                      onChange={(e) => setNewEmployeePhone(e.target.value)}
                      placeholder="+353..."
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreateEmployee}
                  disabled={!newEmployeeName.trim()}
                  size="sm"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
              </div>
            </Card>

            {/* Employee list */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">All Employees ({employees.length})</h4>
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No employees added yet. Create your first employee above.
                </p>
              ) : (
                employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {emp.role || 'No role specified'}
                          {emp.phone && ` • ${emp.phone}`}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">Active</Badge>
                  </div>
                ))
              )}
            </div>

            {/* Instructions */}
            {employees.length > 0 && allTeams.length > 0 && (
              <p className="text-sm text-muted-foreground">
                To assign employees to teams, click the ⚙️ settings icon on a team card.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface PickListRowProps {
  pickList: PickList;
  teams: PickingTeam[];
  onAssignTeam: (pickListId: string, teamId: string | null) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function PickListRow({
  pickList,
  teams,
  onAssignTeam,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: PickListRowProps) {
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-muted/50">
      {/* Sequence Controls */}
      <div className="flex flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveUp}
          disabled={isFirst}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <div className="text-center text-sm font-medium text-muted-foreground py-1">
          {pickList.sequence}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveDown}
          disabled={isLast}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Order Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            #{pickList.orderNumber || pickList.orderId.slice(0, 8)}
          </span>
          <Badge
            variant={pickList.status === 'in_progress' ? 'default' : 'secondary'}
            className={cn(
              pickList.status === 'in_progress' && 'bg-blue-500'
            )}
          >
            {pickList.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {pickList.customerName}
        </div>
        {pickList.requestedDeliveryDate && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            {format(new Date(pickList.requestedDeliveryDate), 'EEE, MMM d')}
          </div>
        )}
      </div>

      {/* Team Assignment */}
      <div className="w-[180px]">
        <Select
          value={pickList.assignedTeamId || 'unassigned'}
          onValueChange={(v) => onAssignTeam(pickList.id, v)}
        >
          <SelectTrigger className={cn(
            !pickList.assignedTeamId && 'border-amber-500 text-amber-600'
          )}>
            <SelectValue placeholder="Assign team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">
              <span className="text-muted-foreground">Unassigned</span>
            </SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

