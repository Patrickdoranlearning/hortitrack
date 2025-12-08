"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Settings2,
  Eye,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  saveMappingRuleAction,
  deleteMappingRuleAction,
  runAutoLinkWithRulesAction,
  previewRuleMatchesAction,
  type MappingRuleInput,
} from "./actions";
import type { MappingRule, MappingRulePreviewMatch, ProductSummary } from "./types";

type Props = {
  rules: MappingRule[];
  products: ProductSummary[];
  sizes: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  productionStatuses: { id: string; label: string; behavior: string }[];
  families: string[];
  genera: string[];
  categories: string[];
};

const emptyRule: Omit<MappingRuleInput, "productId"> = {
  name: "",
  matchFamily: null,
  matchGenus: null,
  matchCategory: null,
  matchSizeId: null,
  matchLocationId: null,
  minAgeWeeks: null,
  maxAgeWeeks: null,
  matchStatusIds: null,
  priority: 100,
  isActive: true,
};

export default function MappingRulesClient({
  rules,
  products,
  sizes,
  locations,
  productionStatuses,
  families,
  genera,
  categories,
}: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MappingRule | null>(null);
  const [formData, setFormData] = useState<Omit<MappingRuleInput, "productId"> & { productId: string }>(
    { ...emptyRule, productId: "" }
  );
  const [isSaving, startSaving] = useTransition();
  const [isRunning, startRunning] = useTransition();
  const [previewMatches, setPreviewMatches] = useState<MappingRulePreviewMatch[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  const openCreateDialog = () => {
    setEditingRule(null);
    setFormData({ ...emptyRule, productId: products[0]?.id ?? "" });
    setPreviewMatches([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: MappingRule) => {
    setEditingRule(rule);
    setFormData({
      id: rule.id,
      productId: rule.productId,
      name: rule.name,
      matchFamily: rule.matchFamily,
      matchGenus: rule.matchGenus,
      matchCategory: rule.matchCategory,
      matchSizeId: rule.matchSizeId,
      matchLocationId: rule.matchLocationId,
      minAgeWeeks: rule.minAgeWeeks,
      maxAgeWeeks: rule.maxAgeWeeks,
      matchStatusIds: rule.matchStatusIds,
      priority: rule.priority,
      isActive: rule.isActive,
    });
    setPreviewMatches([]);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.productId) {
      toast({ variant: "destructive", title: "Select a product" });
      return;
    }
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Enter a rule name" });
      return;
    }

    startSaving(async () => {
      const result = await saveMappingRuleAction(formData);
      if (result.success) {
        toast({ title: editingRule ? "Rule updated" : "Rule created" });
        setIsDialogOpen(false);
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Save failed", description: result.error });
      }
    });
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm("Delete this rule?")) return;
    const result = await deleteMappingRuleAction(ruleId);
    if (result.success) {
      toast({ title: "Rule deleted" });
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "Delete failed", description: result.error });
    }
  };

  const handleRunAutoLink = () => {
    startRunning(async () => {
      const result = await runAutoLinkWithRulesAction();
      if (result.success) {
        toast({
          title: result.linked > 0 ? `Linked ${result.linked} batches` : "No new links",
          description: result.message,
        });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Auto-link failed", description: result.error });
      }
    });
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    const result = await previewRuleMatchesAction({
      matchFamily: formData.matchFamily,
      matchGenus: formData.matchGenus,
      matchCategory: formData.matchCategory,
      matchSizeId: formData.matchSizeId,
      matchLocationId: formData.matchLocationId,
      minAgeWeeks: formData.minAgeWeeks,
      maxAgeWeeks: formData.maxAgeWeeks,
      matchStatusIds: formData.matchStatusIds,
    });
    setIsPreviewing(false);
    if (result.success) {
      setPreviewMatches(result.matches);
    } else {
      toast({ variant: "destructive", title: "Preview failed", description: result.error });
    }
  };

  const availableStatuses = productionStatuses.filter((s) => s.behavior === "available");

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Mapping Rules
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define rules to automatically link batches to products based on variety, size, and other criteria.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRunAutoLink} disabled={isRunning || rules.length === 0}>
            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Run Auto-Link
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Rules</CardTitle>
          <CardDescription>
            Rules are applied in priority order (lower number = higher priority). First matching rule wins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No mapping rules configured yet.</p>
              <p className="text-sm">Create a rule to automatically link batches to products.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Priority</TableHead>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Criteria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <React.Fragment key={rule.id}>
                    <TableRow className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{rule.priority}</TableCell>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>{rule.product?.name ?? "Unknown"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rule.matchFamily && (
                            <Badge variant="secondary">Family: {rule.matchFamily}</Badge>
                          )}
                          {rule.matchGenus && (
                            <Badge variant="secondary">Genus: {rule.matchGenus}</Badge>
                          )}
                          {rule.matchCategory && (
                            <Badge variant="secondary">Category: {rule.matchCategory}</Badge>
                          )}
                          {rule.size && (
                            <Badge variant="secondary">Size: {rule.size.name}</Badge>
                          )}
                          {rule.location && (
                            <Badge variant="secondary">Location: {rule.location.name}</Badge>
                          )}
                          {rule.minAgeWeeks != null && (
                            <Badge variant="secondary">≥{rule.minAgeWeeks}w</Badge>
                          )}
                          {rule.maxAgeWeeks != null && (
                            <Badge variant="secondary">≤{rule.maxAgeWeeks}w</Badge>
                          )}
                          {!rule.matchFamily &&
                            !rule.matchGenus &&
                            !rule.matchCategory &&
                            !rule.size &&
                            !rule.location &&
                            rule.minAgeWeeks == null &&
                            rule.maxAgeWeeks == null && (
                              <span className="text-muted-foreground text-sm">All batches</span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {rule.isActive ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" /> Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)
                            }
                          >
                            {expandedRuleId === rule.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRuleId === rule.id && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={6} className="py-4">
                          <div className="text-sm space-y-2">
                            <p>
                              <strong>Full criteria:</strong>
                            </p>
                            <ul className="list-disc list-inside text-muted-foreground space-y-1">
                              {rule.matchFamily && <li>Plant Family = {rule.matchFamily}</li>}
                              {rule.matchGenus && <li>Genus = {rule.matchGenus}</li>}
                              {rule.matchCategory && <li>Category = {rule.matchCategory}</li>}
                              {rule.size && <li>Size = {rule.size.name}</li>}
                              {rule.location && <li>Location = {rule.location.name}</li>}
                              {rule.minAgeWeeks != null && (
                                <li>Minimum age = {rule.minAgeWeeks} weeks</li>
                              )}
                              {rule.maxAgeWeeks != null && (
                                <li>Maximum age = {rule.maxAgeWeeks} weeks</li>
                              )}
                              {rule.matchStatusIds?.length ? (
                                <li>
                                  Status in:{" "}
                                  {rule.matchStatusIds
                                    .map(
                                      (sid) =>
                                        productionStatuses.find((s) => s.id === sid)?.label ?? sid
                                    )
                                    .join(", ")}
                                </li>
                              ) : null}
                              {!rule.matchFamily &&
                                !rule.matchGenus &&
                                !rule.matchCategory &&
                                !rule.size &&
                                !rule.location &&
                                rule.minAgeWeeks == null &&
                                rule.maxAgeWeeks == null &&
                                !rule.matchStatusIds?.length && (
                                  <li>
                                    <em>No specific criteria - matches all available batches</em>
                                  </li>
                                )}
                            </ul>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Rule Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Create Mapping Rule"}</DialogTitle>
            <DialogDescription>
              Define criteria for automatically linking batches to a product.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Rule Name *</Label>
                <Input
                  id="rule-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Heuchera 2L"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product">Target Product *</Label>
                <Select
                  value={formData.productId}
                  onValueChange={(v) => setFormData({ ...formData, productId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority (lower = higher)</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })
                  }
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="is-active"
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                />
                <Label htmlFor="is-active">Rule is active</Label>
              </div>
            </div>

            {/* Match Criteria Section */}
            <div className="border-t pt-4 mt-2">
              <h4 className="font-medium mb-3">Match Criteria</h4>
              <p className="text-sm text-muted-foreground mb-4">
                All specified criteria must match (AND logic). Leave blank to ignore.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Family */}
                <div className="space-y-2">
                  <Label>Plant Family</Label>
                  <Select
                    value={formData.matchFamily ?? "__none__"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, matchFamily: v === "__none__" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any family" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Any family</SelectItem>
                      {families.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Genus */}
                <div className="space-y-2">
                  <Label>Genus</Label>
                  <Select
                    value={formData.matchGenus ?? "__none__"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, matchGenus: v === "__none__" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any genus" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Any genus</SelectItem>
                      {genera.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.matchCategory ?? "__none__"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, matchCategory: v === "__none__" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Any category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Size */}
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Select
                    value={formData.matchSizeId ?? "__none__"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, matchSizeId: v === "__none__" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Any size</SelectItem>
                      {sizes.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select
                    value={formData.matchLocationId ?? "__none__"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, matchLocationId: v === "__none__" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Any location</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label>Production Status</Label>
                  <Select
                    value={formData.matchStatusIds?.[0] ?? "__none__"}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        matchStatusIds: v === "__none__" ? null : [v],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any available status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Any available status</SelectItem>
                      {availableStatuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Min Age */}
                <div className="space-y-2">
                  <Label>Minimum Age (weeks)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.minAgeWeeks ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minAgeWeeks: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    placeholder="No minimum"
                  />
                </div>

                {/* Max Age */}
                <div className="space-y-2">
                  <Label>Maximum Age (weeks)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.maxAgeWeeks ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxAgeWeeks: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    placeholder="No maximum"
                  />
                </div>
              </div>
            </div>

            {/* Preview Section */}
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Preview Matching Batches</h4>
                <Button variant="outline" size="sm" onClick={handlePreview} disabled={isPreviewing}>
                  {isPreviewing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  Preview
                </Button>
              </div>
              {previewMatches.length > 0 ? (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch</TableHead>
                        <TableHead>Variety</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewMatches.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-mono">#{m.batchNumber}</TableCell>
                          <TableCell>{m.varietyName}</TableCell>
                          <TableCell>{m.sizeName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{m.status || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell>{m.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Click "Preview" to see which batches match this rule's criteria.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

