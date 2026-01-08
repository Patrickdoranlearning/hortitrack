"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Plus,
  Search,
  Clock,
  Leaf,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Archive,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/http";
import type { ProtocolSummary } from "@/lib/planning/types";
import { ProtocolDrawer } from "../planning/components/ProtocolDrawer";

type Props = {
  initialProtocols: ProtocolSummary[];
};

export default function RecipesClient({ initialProtocols }: Props) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProtocolSummary | null>(null);

  const {
    data: protocols,
    mutate,
    isLoading,
  } = useSWR<ProtocolSummary[]>(
    "/api/production/protocols",
    async (url) => {
      const res = await fetchJson<{ protocols: ProtocolSummary[] }>(url);
      return res.protocols;
    },
    { fallbackData: initialProtocols }
  );

  const filteredProtocols = useMemo(() => {
    if (!protocols) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return protocols;
    return protocols.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.targetVarietyName?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [protocols, searchQuery]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetchJson(`/api/production/protocols/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast({ title: "Recipe deleted" });
      mutate();
    } catch (error: any) {
      toast({
        title: "Failed to delete",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (protocol: ProtocolSummary) => {
    try {
      await fetchJson(`/api/production/protocols/${protocol.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !protocol.isActive }),
      });
      toast({ title: protocol.isActive ? "Recipe archived" : "Recipe activated" });
      mutate();
    } catch (error: any) {
      toast({
        title: "Failed to update",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDuplicate = async (protocol: ProtocolSummary) => {
    try {
      await fetchJson("/api/production/protocols", {
        method: "POST",
        body: JSON.stringify({
          name: `${protocol.name} (copy)`,
          description: protocol.description,
          targetVarietyId: protocol.targetVarietyId,
          targetSizeId: protocol.targetSizeId,
          summary: protocol.definition?.summary,
          steps: protocol.definition?.steps ?? [],
          targets: protocol.definition?.targets,
          route: protocol.route ?? { nodes: [], edges: [] },
          isActive: true,
        }),
      });
      toast({ title: "Recipe duplicated" });
      mutate();
    } catch (error: any) {
      toast({
        title: "Failed to duplicate",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Calculate total duration from route nodes
  const getTotalDuration = (protocol: ProtocolSummary) => {
    if (!protocol.route?.nodes?.length) return null;
    return protocol.route.nodes.reduce((sum, node) => sum + (node.durationDays ?? 0), 0);
  };

  const getStageCount = (protocol: ProtocolSummary) => {
    return protocol.route?.nodes?.length ?? 0;
  };

  return (
    <PageFrame moduleKey="production">
      <div className="space-y-6">
        <ModulePageHeader
          title="Production Recipes"
          description="Define and manage growing timelines from propagation to sale-ready plants."
          actionsSlot={
            <>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search recipes..."
                  className="pl-9 w-full sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Recipe
              </Button>
            </>
          }
        />

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Recipes</CardDescription>
              <CardTitle className="text-3xl">{protocols?.length ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-3xl">
                {protocols?.filter((p) => p.isActive).length ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Varieties Covered</CardDescription>
              <CardTitle className="text-3xl">
                {new Set(protocols?.map((p) => p.targetVarietyId).filter(Boolean)).size}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Recipe Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading && !protocols?.length ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))
          ) : filteredProtocols.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <Leaf className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Recipes Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search."
                  : "Create your first production recipe to get started."}
              </p>
              {!searchQuery && (
                <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Recipe
                </Button>
              )}
            </div>
          ) : (
            filteredProtocols.map((protocol) => {
              const totalDays = getTotalDuration(protocol);
              const stageCount = getStageCount(protocol);

              return (
                <Card
                  key={protocol.id}
                  className={`group relative transition-shadow hover:shadow-md ${
                    !protocol.isActive ? "opacity-60" : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/production/recipes/${protocol.id}`}
                          className="hover:underline"
                        >
                          <CardTitle className="text-lg truncate">{protocol.name}</CardTitle>
                        </Link>
                        {protocol.targetVarietyName && (
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <Leaf className="h-3 w-3" />
                            {protocol.targetVarietyName}
                            {protocol.targetSizeName && ` · ${protocol.targetSizeName}`}
                          </CardDescription>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/production/recipes/${protocol.id}`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(protocol)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleActive(protocol)}>
                            {protocol.isActive ? (
                              <>
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget(protocol)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {totalDays !== null && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{totalDays} days</span>
                        </div>
                      )}
                      {stageCount > 0 && (
                        <div className="flex items-center gap-1">
                          <span>{stageCount} stages</span>
                        </div>
                      )}
                      <Badge variant={protocol.isActive ? "default" : "secondary"}>
                        {protocol.isActive ? "Active" : "Archived"}
                      </Badge>
                    </div>

                    {/* Stage Timeline Preview */}
                    {protocol.route?.nodes && protocol.route.nodes.length > 0 && (
                      <div className="mt-4 flex items-center gap-1">
                        {protocol.route.nodes.slice(0, 5).map((node, idx) => (
                          <React.Fragment key={node.id}>
                            <div
                              className="h-2 rounded-full bg-primary/20"
                              style={{
                                flex: node.durationDays ?? 1,
                                minWidth: 12,
                              }}
                              title={`${node.label}: ${node.durationDays ?? 0} days`}
                            />
                            {idx < Math.min(protocol.route!.nodes.length - 1, 4) && (
                              <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                            )}
                          </React.Fragment>
                        ))}
                        {protocol.route.nodes.length > 5 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            +{protocol.route.nodes.length - 5}
                          </span>
                        )}
                      </div>
                    )}

                    {protocol.description && (
                      <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                        {protocol.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Create Recipe Dialog */}
      <ProtocolDrawer
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => mutate()}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFrame>
  );
}







