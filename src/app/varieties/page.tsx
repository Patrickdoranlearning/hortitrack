"use client";

import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Variety } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VarietyForm } from "@/components/variety-form";
import { useToast } from "@/hooks/use-toast";
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
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { addVarietyAction, updateVarietyAction, deleteVarietyAction, archiveVarietyAction, unarchiveVarietyAction } from "../actions";
import { invalidateReferenceData } from "@/lib/swr/keys";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection } from "@/hooks/use-collection";
import { PageFrame } from '@/ui/templates';
import { DataPageShell } from '@/ui/templates';
import { DataToolbar } from '@/ui/templates';
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit, Archive, ArchiveRestore } from "lucide-react";
import { ViewToggle, useViewToggle } from "@/components/ui/view-toggle";

const quickVarietySchema = z.object({
  name: z.string().min(1, "Variety name is required"),
  commonName: z.string().optional(),
  family: z.string().optional(),
  genus: z.string().optional(),
  species: z.string().optional(),
  category: z.string().optional(),
  colour: z.string().optional(),
  floweringPeriod: z.string().optional(),
  flowerColour: z.string().optional(),
  evergreen: z.enum(["", "yes", "no"]).optional(),
  plantBreedersRights: z.enum(["", "yes", "no"]).optional(),
  rating: z.string().optional(),
});

type QuickVarietyFormValues = z.infer<typeof quickVarietySchema>;

const defaultQuickValues: QuickVarietyFormValues = {
  name: "",
  commonName: "",
  family: "",
  genus: "",
  species: "",
  category: "",
  colour: "",
  floweringPeriod: "",
  flowerColour: "",
  evergreen: "",
  plantBreedersRights: "",
  rating: "",
};

type SortableVarietyKey =
  | "name"
  | "commonName"
  | "family"
  | "genus"
  | "species"
  | "category"
  | "colour"
  | "flowerColour"
  | "floweringPeriod"
  | "evergreen"
  | "plantBreedersRights"
  | "rating";

export default function VarietiesPage() {
  const { loading: authLoading } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVariety, setEditingVariety] = useState<Variety | null>(null);
  const [filterText, setFilterText] = useState("");
  const nameFieldRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const [sortConfig, setSortConfig] = useState<{ key: SortableVarietyKey; direction: "asc" | "desc" }>({
    key: "name",
    direction: "asc",
  });
  const [showArchived, setShowArchived] = useState(false);
  const [deleteFailedVariety, setDeleteFailedVariety] = useState<{ id: string; name: string; error: string } | null>(null);
  const { value: viewMode, setValue: setViewMode } = useViewToggle('varieties-view', 'table');

  const { data: varietiesData, loading: varietiesLoading } = useCollection<any>("plant_varieties");
  const allVarieties = useMemo<Variety[]>(() => (varietiesData || []).map(normalizeVariety), [varietiesData]);
  const varieties = useMemo(() => allVarieties.filter(v => showArchived ? (v as any).isArchived : !(v as any).isArchived), [allVarieties, showArchived]);
  const isLoading = authLoading || varietiesLoading;

  const quickForm = useForm<QuickVarietyFormValues>({
    resolver: zodResolver(quickVarietySchema),
    defaultValues: defaultQuickValues,
  });

  const filteredVarieties = useMemo(() => {
    if (!filterText) return varieties;
    const query = filterText.toLowerCase();
    return varieties.filter((variety) =>
      [
        variety.name,
        variety.commonName,
        variety.family,
        variety.genus,
        variety.species,
        variety.category,
        variety.colour,
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(query))
    );
  }, [varieties, filterText]);

  const sortedVarieties = useMemo(() => {
    return [...filteredVarieties].sort((a, b) => {
      const { key, direction } = sortConfig;
      const left = (a as any)[key] ?? "";
      const right = (b as any)[key] ?? "";
      const leftStr = String(left).toLowerCase();
      const rightStr = String(right).toLowerCase();
      if (leftStr < rightStr) return direction === "asc" ? -1 : 1;
      if (leftStr > rightStr) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredVarieties, sortConfig]);

  const handleAddVariety = () => {
    setEditingVariety(null);
    setIsFormOpen(true);
  };

  const handleEditVariety = (variety: Variety) => {
    setEditingVariety(variety);
    setIsFormOpen(true);
  };

  const handleDeleteVariety = async (varietyId: string) => {
    const varietyToDelete = allVarieties.find((v) => v.id === varietyId);
    if (!varietyToDelete) return;

    const result = await deleteVarietyAction(varietyId);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: "Variety deleted", description: `Successfully removed "${varietyToDelete.name}".` });
    } else if ((result as any).canArchive) {
      setDeleteFailedVariety({ id: varietyId, name: varietyToDelete.name, error: result.error || "Cannot delete" });
    } else {
      toast({ variant: "destructive", title: "Delete failed", description: result.error });
    }
  };

  const handleArchiveVariety = async (varietyId: string) => {
    const varietyToArchive = allVarieties.find((v) => v.id === varietyId);
    if (!varietyToArchive) return;

    const result = await archiveVarietyAction(varietyId);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: "Variety archived", description: `"${varietyToArchive.name}" has been archived.` });
      setDeleteFailedVariety(null);
    } else {
      toast({ variant: "destructive", title: "Archive failed", description: result.error });
    }
  };

  const handleUnarchiveVariety = async (varietyId: string) => {
    const varietyToRestore = allVarieties.find((v) => v.id === varietyId);
    if (!varietyToRestore) return;

    const result = await unarchiveVarietyAction(varietyId);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: "Variety restored", description: `"${varietyToRestore.name}" has been restored.` });
    } else {
      toast({ variant: "destructive", title: "Restore failed", description: result.error });
    }
  };

  const handleFormSubmit = async (varietyData: Omit<Variety, "id"> | Variety) => {
    const isEditing = "id" in varietyData;

    const result = isEditing
      ? await updateVarietyAction(varietyData as Variety)
      : await addVarietyAction(varietyData);

    if (result.success) {
      invalidateReferenceData();
      toast({
        title: isEditing ? "Variety updated" : "Variety added",
        description: `Successfully ${isEditing ? "updated" : "added"} "${result.data?.name}".`,
      });
      setIsFormOpen(false);
      setEditingVariety(null);
    } else {
      toast({
        variant: "destructive",
        title: isEditing ? "Update failed" : "Add failed",
        description: result.error,
      });
    }
  };

  const handleSort = (key: SortableVarietyKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const renderSortHeader = (label: string, key: SortableVarietyKey) => {
    const isActive = sortConfig.key === key;
    const indicator = isActive ? (sortConfig.direction === "asc" ? "↑" : "↓") : "";
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

  const handleDownloadTemplate = async () => {
    const headers = [
      "name",
      "commonName",
      "family",
      "genus",
      "species",
      "category",
      "colour",
      "flowerColour",
      "floweringPeriod",
      "evergreen",
      "plantBreedersRights",
      "rating",
    ];
    const sample = [
      "Lavandula angustifolia",
      "English Lavender",
      "Lamiaceae",
      "Lavandula",
      "angustifolia",
      "Herb",
      "Grey-green",
      "Purple",
      "Summer",
      "Yes",
      "Yes",
      "5",
    ].join(",");
    downloadCsv(headers, [sample], "plant_varieties_template.csv");
  };

  const handleDownloadData = async () => {
    const headers = [
      "name",
      "commonName",
      "family",
      "genus",
      "species",
      "category",
      "colour",
      "flowerColour",
      "floweringPeriod",
      "evergreen",
      "plantBreedersRights",
      "rating",
    ];
    const rows = sortedVarieties.map((variety) =>
      headers.map((header) => `"${(variety as any)[header] ?? ""}"`).join(",")
    );
    downloadCsv(headers, rows, "plant_varieties.csv");
  };

  const handleUploadCsv = async (file: File) => {
    const text = await file.text();
    const rows = text.split("\n").filter((row) => row.trim() !== "");
    const headerLine = rows.shift();
    if (!headerLine) throw new Error("The CSV file is empty.");

    const headers = headerLine.split(",").map((h) => h.trim().replace(/"/g, ""));
    const required = ["name"];
    if (!required.every((h) => headers.includes(h))) {
      throw new Error(`CSV headers are missing or incorrect. Required: ${required.join(", ")}`);
    }

    const existingNames = new Set(
      varieties
        .map((v) => v.name?.trim().toLowerCase())
        .filter((name): name is string => Boolean(name))
    );

    let created = 0;
    const duplicates: string[] = [];
    const failures: string[] = [];

    for (const row of rows) {
      if (!row.trim()) continue;
      const values = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((v) => v.replace(/"/g, "").trim()) ?? [];
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ?? "";
      });

      const name = record.name?.trim();
      if (!name) {
        failures.push("(missing name)");
        continue;
      }
      const normalizedName = name.toLowerCase();
      if (existingNames.has(normalizedName)) {
        duplicates.push(name);
        continue;
      }

      const foliageColour = record.colour ?? record.color;
      const pbrValue = record.plantBreedersRights ?? record.plant_breeders_rights;
      const payload: Omit<Variety, "id"> = {
        name,
        commonName: record.commonName || undefined,
        family: record.family || undefined,
        genus: record.genus || undefined,
        species: record.species || undefined,
        category: record.category || undefined,
        colour: foliageColour || undefined,
        floweringPeriod: record.floweringPeriod || undefined,
        flowerColour: (record.flowerColour ?? record.flower_colour) ?? undefined,
        evergreen: record.evergreen
          ? ["yes", "true", "1"].includes(record.evergreen.toLowerCase())
          : undefined,
        plantBreedersRights: pbrValue
          ? ["yes", "true", "1"].includes(pbrValue.toLowerCase())
          : undefined,
        rating: record.rating ? Number(record.rating) : undefined,
      } as any;

      const result = await addVarietyAction(payload);
      if (result.success) {
        created += 1;
        existingNames.add(normalizedName);
      } else {
        failures.push(name);
      }
    }

    // Invalidate cache if any varieties were created
    if (created > 0) {
      invalidateReferenceData();
    }

    let description = `${created} new variet${created === 1 ? "y" : "ies"} added.`;
    if (duplicates.length) {
      description += ` Skipped ${duplicates.length} duplicate${duplicates.length === 1 ? "" : "s"} (${duplicates
        .slice(0, 3)
        .join(", ")}${duplicates.length > 3 ? ", …" : ""}).`;
    }
    if (failures.length) {
      description += ` Failed to import ${failures.length} row${failures.length === 1 ? "" : "s"}.`;
    }

    toast({
      title: "Import complete",
      description,
      variant: failures.length ? "destructive" : "default",
    });
  };

  const handleQuickAdd = quickForm.handleSubmit(async (values) => {
    const normalizedName = values.name.trim().toLowerCase();
    if (varieties.some((v) => v.name?.trim().toLowerCase() === normalizedName)) {
      toast({
        variant: "destructive",
        title: "Duplicate variety",
        description: `"${values.name}" already exists. Edit the existing entry instead.`,
      });
      return;
    }

    const payload: Omit<Variety, "id"> = {
      name: values.name.trim(),
      commonName: values.commonName || undefined,
      family: values.family || undefined,
      genus: values.genus || undefined,
      species: values.species || undefined,
      category: values.category || undefined,
      colour: values.colour || undefined,
      floweringPeriod: values.floweringPeriod || undefined,
      flowerColour: values.flowerColour || undefined,
      evergreen: values.evergreen ? values.evergreen === "yes" : undefined,
      plantBreedersRights: values.plantBreedersRights
        ? values.plantBreedersRights === "yes"
        : undefined,
      rating: values.rating ? Number(values.rating) : undefined,
    } as any;

    const result = await addVarietyAction(payload);
    if (result.success) {
      invalidateReferenceData();
      toast({ title: "Variety added", description: `"${values.name}" is now available.` });
      quickForm.reset(defaultQuickValues);
      nameFieldRef.current?.focus();
    } else {
      toast({ variant: "destructive", title: "Add failed", description: result.error });
    }
  });

  const focusQuickRow = () => nameFieldRef.current?.focus();

  return (
    <PageFrame moduleKey="production">
      <DataPageShell
        title="Plant Varieties"
        description="Manage the golden list used across propagation, check-in, and orders."
        toolbar={
          <DataToolbar
            onDownloadTemplate={handleDownloadTemplate}
            onDownloadData={handleDownloadData}
            onUploadCsv={handleUploadCsv}
            onAddRow={focusQuickRow}
            filters={
              <div className="flex items-center gap-2">
                <Input
                  className="w-full max-w-xs"
                  placeholder="Filter by name, family, genus…"
                  value={filterText}
                  onChange={(event) => setFilterText(event.target.value)}
                />
                <Button
                  size="sm"
                  variant={showArchived ? "secondary" : "outline"}
                  onClick={() => setShowArchived(!showArchived)}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  {showArchived ? "Show Active" : "Show Archived"}
                </Button>
              </div>
            }
            extraActions={
              <div className="flex items-center gap-2">
                <ViewToggle
                  value={viewMode}
                  onChange={setViewMode}
                  storageKey="varieties-view"
                />
                <Button size="sm" onClick={handleAddVariety}>
                  <Plus className="mr-2 h-4 w-4" />
                  Manage form
                </Button>
              </div>
            }
          />
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Varieties Golden Table</CardTitle>
            <CardDescription>
              {viewMode === 'card'
                ? 'Tap a card to edit. Switch to table view for quick inline entry.'
                : 'Use the quick row for single records or the pencil icon to edit uploads.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : viewMode === 'card' ? (
              /* Card View */
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedVarieties.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No varieties found
                  </div>
                ) : (
                  sortedVarieties.map((variety) => (
                    <Card
                      key={variety.id ?? variety.name}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleEditVariety(variety)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-semibold truncate flex-1" title={variety.name}>
                            {variety.name}
                          </div>
                          {(variety as any).isArchived && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded ml-2">Archived</span>
                          )}
                        </div>

                        {variety.commonName && (
                          <div className="text-sm text-muted-foreground mb-2 truncate" title={variety.commonName}>
                            {variety.commonName}
                          </div>
                        )}

                        <div className="space-y-1 text-sm">
                          {variety.category && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Category</span>
                              <span>{variety.category}</span>
                            </div>
                          )}
                          {variety.family && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Family</span>
                              <span>{variety.family}</span>
                            </div>
                          )}
                          {typeof variety.evergreen === "boolean" && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Evergreen</span>
                              <span>{variety.evergreen ? "Yes" : "No"}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditVariety(variety);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {showArchived ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnarchiveVariety(variety.id!);
                              }}
                            >
                              <ArchiveRestore className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteVariety(variety.id!);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              /* Table View */
              <Table className="min-w-[1500px] whitespace-nowrap text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px] px-4 py-2">{renderSortHeader("Variety Name", "name")}</TableHead>
                    <TableHead className="min-w-[150px] px-4 py-2">{renderSortHeader("Common Name", "commonName")}</TableHead>
                    <TableHead className="min-w-[140px] px-4 py-2">{renderSortHeader("Family", "family")}</TableHead>
                    <TableHead className="min-w-[140px] px-4 py-2">{renderSortHeader("Genus", "genus")}</TableHead>
                    <TableHead className="min-w-[140px] px-4 py-2">{renderSortHeader("Species", "species")}</TableHead>
                    <TableHead className="min-w-[140px] px-4 py-2">{renderSortHeader("Category", "category")}</TableHead>
                    <TableHead className="min-w-[140px] px-4 py-2">{renderSortHeader("Foliage Colour", "colour")}</TableHead>
                    <TableHead className="min-w-[160px] px-4 py-2">{renderSortHeader("Flower Colour", "flowerColour")}</TableHead>
                    <TableHead className="min-w-[160px] px-4 py-2">{renderSortHeader("Flowering Period", "floweringPeriod")}</TableHead>
                    <TableHead className="min-w-[120px] px-4 py-2">{renderSortHeader("Evergreen", "evergreen")}</TableHead>
                    <TableHead className="min-w-[140px] px-4 py-2">{renderSortHeader("PBR", "plantBreedersRights")}</TableHead>
                    <TableHead className="min-w-[100px] px-4 py-2">{renderSortHeader("Rating", "rating")}</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <Form {...quickForm}>
                    <TableRow className="bg-muted/70">
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Variety Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Add new variety…"
                                  {...field}
                                  ref={(node) => {
                                    nameFieldRef.current = node;
                                    field.ref(node);
                                  }}
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="commonName"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Common Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Common name" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="family"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Family</FormLabel>
                              <FormControl>
                                <Input placeholder="Family" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="genus"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Genus</FormLabel>
                              <FormControl>
                                <Input placeholder="Genus" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="species"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Species</FormLabel>
                              <FormControl>
                                <Input placeholder="Species" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Category</FormLabel>
                              <FormControl>
                                <Input placeholder="Category" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="colour"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Foliage Colour</FormLabel>
                              <FormControl>
                                <Input placeholder="Foliage colour" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="flowerColour"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Flower Colour</FormLabel>
                              <FormControl>
                                <Input placeholder="Flower colour" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="floweringPeriod"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Flowering Period</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Summer" {...field} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="evergreen"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Evergreen</FormLabel>
                              <Select
                                onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
                                value={field.value && field.value !== "" ? field.value : "__none"}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Evergreen?" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none">Unspecified</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="plantBreedersRights"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Plant Breeders Rights</FormLabel>
                              <Select
                                onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
                                value={field.value && field.value !== "" ? field.value : "__none"}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="PBR?" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none">Unspecified</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={quickForm.control}
                          name="rating"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">Rating</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={6}
                                  placeholder="1-6"
                                  value={field.value ?? ""}
                                  onChange={(event) => field.onChange(event.target.value)}
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={handleQuickAdd}>
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  </Form>

                  {sortedVarieties.map((variety) => (
                    <TableRow key={variety.id ?? variety.name}>
                      <TableCell className="px-4 py-2 font-medium">{variety.name}</TableCell>
                      <TableCell className="px-4 py-2">{variety.commonName || "—"}</TableCell>
                      <TableCell className="px-4 py-2">{variety.family || "—"}</TableCell>
                      <TableCell className="px-4 py-2">{variety.genus || "—"}</TableCell>
                      <TableCell className="px-4 py-2">{variety.species || "—"}</TableCell>
                      <TableCell className="px-4 py-2">{variety.category || "—"}</TableCell>
                      <TableCell className="px-4 py-2">{variety.colour || "—"}</TableCell>
                      <TableCell className="px-4 py-2">{variety.flowerColour || "—"}</TableCell>
                      <TableCell className="px-4 py-2">{variety.floweringPeriod || "—"}</TableCell>
                      <TableCell className="px-4 py-2">
                        {typeof variety.evergreen === "boolean" ? (variety.evergreen ? "Yes" : "No") : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        {typeof variety.plantBreedersRights === "boolean"
                          ? variety.plantBreedersRights
                            ? "Yes"
                            : "No"
                          : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-2">{variety.rating ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="icon" variant="outline" onClick={() => handleEditVariety(variety)}>
                            <Edit />
                          </Button>
                          {showArchived ? (
                            <Button type="button" size="icon" variant="outline" onClick={() => handleUnarchiveVariety(variety.id!)}>
                              <ArchiveRestore />
                            </Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button type="button" size="icon" variant="destructive">
                                  <Trash2 />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete variety?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete "{variety.name}". This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteVariety(variety.id!)}>
                                    Yes, delete it
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl">
            <VarietyForm
              variety={editingVariety}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingVariety(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Archive option dialog - shown when delete fails */}
        <AlertDialog open={!!deleteFailedVariety} onOpenChange={(open) => !open && setDeleteFailedVariety(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cannot delete "{deleteFailedVariety?.name}"</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteFailedVariety?.error}
                <br /><br />
                Would you like to archive this variety instead? Archived varieties are hidden from lists but preserved for historical records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteFailedVariety && handleArchiveVariety(deleteFailedVariety.id)}>
                <Archive className="mr-2 h-4 w-4" />
                Archive instead
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DataPageShell>
    </PageFrame>
  );
}

function downloadCsv(headers: string[], rows: string[], filename: string) {
  const csvContent = `data:text/csv;charset=utf-8,${headers.join(",")}\n${rows.join("\n")}`;
  const encoded = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encoded);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function normalizeVariety(row: any): Variety & { isArchived?: boolean } {
  if (!row) return row;
  return {
    ...row,
    commonName: row.commonName ?? row.common_name,
    category: row.category ?? row.Category,
    genus: row.genus,
    species: row.species,
    colour: row.colour ?? row.color,
    floweringPeriod: row.floweringPeriod ?? row.flowering_period,
    flowerColour: row.flowerColour ?? row.flower_colour,
    plantBreedersRights:
      typeof row.plantBreedersRights === "boolean"
        ? row.plantBreedersRights
        : typeof row.plant_breeders_rights === "boolean"
        ? row.plant_breeders_rights
        : undefined,
    rating: typeof row.rating === "number" ? row.rating : row.rating ? Number(row.rating) : undefined,
    evergreen:
      typeof row.evergreen === "boolean"
        ? row.evergreen
        : typeof row.evergreen === "string"
        ? ["true", "1", "yes"].includes(row.evergreen.toLowerCase())
        : undefined,
    isArchived: row.isArchived ?? row.is_archived ?? false,
  };
}
