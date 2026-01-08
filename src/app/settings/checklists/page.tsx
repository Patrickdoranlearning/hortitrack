"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  CheckSquare,
  Loader2,
  GripVertical,
  X,
} from "lucide-react";
import { PageFrame } from "@/ui/templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/http/fetchJson";
import { cn } from "@/lib/utils";
import type {
  ChecklistTemplate,
  ChecklistItem,
  SourceModule,
  ChecklistType,
} from "@/server/tasks/checklist-service";

const PROCESS_TYPES = {
  production: [
    { value: "potting", label: "Potting" },
    { value: "propagation", label: "Propagation" },
    { value: "transplant", label: "Transplant" },
    { value: "spacing", label: "Spacing" },
    { value: "other", label: "Other" },
  ],
  plant_health: [
    { value: "spraying", label: "Spraying" },
    { value: "ipm_release", label: "IPM Release" },
    { value: "scouting", label: "Scouting" },
    { value: "treatment", label: "Treatment" },
  ],
  dispatch: [
    { value: "picking", label: "Picking" },
    { value: "packing", label: "Packing" },
    { value: "loading", label: "Loading" },
    { value: "delivery", label: "Delivery" },
  ],
} as const;

const MODULE_LABELS: Record<SourceModule, string> = {
  production: "Production",
  plant_health: "Plant Health",
  dispatch: "Dispatch",
};

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  sourceModule: z.enum(["production", "plant_health", "dispatch"]),
  processType: z.string().min(1, "Process type is required"),
  checklistType: z.enum(["prerequisite", "postrequisite"]),
});

type FormValues = z.infer<typeof schema>;

type ChecklistItemInput = {
  id?: string;
  label: string;
  required: boolean;
  order: number;
};

type TemplatesResponse = { templates: ChecklistTemplate[] };

export default function ChecklistSettingsPage() {
  const { toast } = useToast();
  const [activeModule, setActiveModule] = React.useState<SourceModule>("production");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<ChecklistTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = React.useState<ChecklistTemplate | null>(null);
  const [items, setItems] = React.useState<ChecklistItemInput[]>([]);
  const [newItemLabel, setNewItemLabel] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Fetch templates
  const { data, mutate, isLoading } = useSWR<TemplatesResponse>(
    "/api/settings/checklists",
    (url) => fetchJson(url)
  );

  const templates = React.useMemo(() => {
    return (data?.templates ?? []).filter((t) => t.sourceModule === activeModule);
  }, [data, activeModule]);

  // Group templates by process type
  const templatesByProcess = React.useMemo(() => {
    const grouped: Record<string, { prerequisites: ChecklistTemplate[]; postrequisites: ChecklistTemplate[] }> = {};
    
    for (const template of templates) {
      if (!grouped[template.processType]) {
        grouped[template.processType] = { prerequisites: [], postrequisites: [] };
      }
      if (template.checklistType === "prerequisite") {
        grouped[template.processType].prerequisites.push(template);
      } else {
        grouped[template.processType].postrequisites.push(template);
      }
    }
    
    return grouped;
  }, [templates]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      sourceModule: "production",
      processType: "",
      checklistType: "prerequisite",
    },
  });

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (isDialogOpen) {
      if (editingTemplate) {
        form.reset({
          name: editingTemplate.name,
          description: editingTemplate.description ?? "",
          sourceModule: editingTemplate.sourceModule,
          processType: editingTemplate.processType,
          checklistType: editingTemplate.checklistType,
        });
        setItems(editingTemplate.items.map((item) => ({
          id: item.id,
          label: item.label,
          required: item.required,
          order: item.order,
        })));
      } else {
        form.reset({
          name: "",
          description: "",
          sourceModule: activeModule,
          processType: "",
          checklistType: "prerequisite",
        });
        setItems([]);
      }
    }
  }, [isDialogOpen, editingTemplate, activeModule, form]);

  const selectedModule = form.watch("sourceModule");
  const processTypes = PROCESS_TYPES[selectedModule] ?? [];

  const addItem = () => {
    if (!newItemLabel.trim()) return;
    setItems((prev) => [
      ...prev,
      { label: newItemLabel.trim(), required: false, order: prev.length },
    ]);
    setNewItemLabel("");
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i })));
  };

  const toggleItemRequired = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, required: !item.required } : item))
    );
  };

  const handleSubmit = async (values: FormValues) => {
    if (items.length === 0) {
      toast({
        title: "Add checklist items",
        description: "A checklist needs at least one item.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTemplate) {
        await fetchJson(`/api/settings/checklists/${editingTemplate.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: values.name,
            description: values.description,
            processType: values.processType,
            items: items.map((item) => ({
              id: item.id,
              label: item.label,
              required: item.required,
              order: item.order,
            })),
          }),
        });
        toast({ title: "Template updated" });
      } else {
        await fetchJson("/api/settings/checklists", {
          method: "POST",
          body: JSON.stringify({
            ...values,
            items: items.map((item) => ({
              label: item.label,
              required: item.required,
              order: item.order,
            })),
          }),
        });
        toast({ title: "Template created" });
      }
      mutate();
      setIsDialogOpen(false);
      setEditingTemplate(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;
    
    try {
      await fetchJson(`/api/settings/checklists/${deleteTemplate.id}`, {
        method: "DELETE",
      });
      toast({ title: "Template deleted" });
      mutate();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete template",
        variant: "destructive",
      });
    } finally {
      setDeleteTemplate(null);
    }
  };

  const handleToggleActive = async (template: ChecklistTemplate) => {
    try {
      await fetchJson(`/api/settings/checklists/${template.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !template.isActive }),
      });
      mutate();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update template",
        variant: "destructive",
      });
    }
  };

  return (
    <PageFrame moduleKey="tasks">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Checklist Templates</h1>
            <p className="text-muted-foreground">
              Configure prerequisite and postrequisite checklists for task workflows.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/settings">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Settings
              </Link>
            </Button>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </div>
        </div>

        {/* Module Tabs */}
        <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as SourceModule)}>
          <TabsList>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="plant_health">Plant Health</TabsTrigger>
            <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
          </TabsList>

          <TabsContent value={activeModule} className="mt-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : Object.keys(templatesByProcess).length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckSquare className="h-12 w-12 text-muted-foreground/30" />
                  <h3 className="mt-4 font-semibold">No templates yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a checklist template for {MODULE_LABELS[activeModule]} tasks.
                  </p>
                  <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(templatesByProcess).map(([processType, { prerequisites, postrequisites }]) => {
                  const processLabel = processTypes.find((p) => p.value === processType)?.label ?? processType;
                  
                  return (
                    <Card key={processType}>
                      <CardHeader>
                        <CardTitle className="capitalize">{processLabel}</CardTitle>
                        <CardDescription>
                          Checklists for {processLabel.toLowerCase()} tasks
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Prerequisites */}
                        {prerequisites.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">
                              Prerequisites (Before Starting)
                            </h4>
                            <div className="space-y-2">
                              {prerequisites.map((template) => (
                                <TemplateCard
                                  key={template.id}
                                  template={template}
                                  onEdit={() => {
                                    setEditingTemplate(template);
                                    setIsDialogOpen(true);
                                  }}
                                  onDelete={() => setDeleteTemplate(template)}
                                  onToggleActive={() => handleToggleActive(template)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Postrequisites */}
                        {postrequisites.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">
                              Postrequisites (Before Completing)
                            </h4>
                            <div className="space-y-2">
                              {postrequisites.map((template) => (
                                <TemplateCard
                                  key={template.id}
                                  template={template}
                                  onEdit={() => {
                                    setEditingTemplate(template);
                                    setIsDialogOpen(true);
                                  }}
                                  onDelete={() => setDeleteTemplate(template)}
                                  onToggleActive={() => handleToggleActive(template)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditingTemplate(null);
        }
        setIsDialogOpen(open);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Checklist Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the checklist template details and items."
                : "Create a new checklist template for task workflows."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 overflow-y-auto space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Potting Prep Checklist" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Brief description..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sourceModule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Module</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!!editingTemplate}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select module" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="production">Production</SelectItem>
                          <SelectItem value="plant_health">Plant Health</SelectItem>
                          <SelectItem value="dispatch">Dispatch</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="checklistType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Checklist Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!!editingTemplate}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="prerequisite">Prerequisite (Before Start)</SelectItem>
                          <SelectItem value="postrequisite">Postrequisite (Before Complete)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="processType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Process Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select process type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {processTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Checklist Items */}
              <div className="space-y-3">
                <Label>Checklist Items</Label>
                
                {/* Add new item */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a checklist item..."
                    value={newItemLabel}
                    onChange={(e) => setNewItemLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addItem();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Item list */}
                {items.length > 0 && (
                  <div className="border rounded-md divide-y">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <span className="flex-1 text-sm">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`required-${index}`}
                            checked={item.required}
                            onCheckedChange={() => toggleItemRequired(index)}
                          />
                          <Label
                            htmlFor={`required-${index}`}
                            className="text-xs text-muted-foreground cursor-pointer"
                          >
                            Required
                          </Label>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeItem(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
                    No items yet. Add items above.
                  </p>
                )}
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingTemplate ? (
                    "Save Changes"
                  ) : (
                    "Create Template"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={(open) => !open && setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTemplate?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFrame>
  );
}

// Template Card Component
function TemplateCard({
  template,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  template: ChecklistTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        template.isActive ? "bg-card" : "bg-muted/50 opacity-60"
      )}
    >
      <CheckSquare className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{template.name}</span>
          <Badge variant="secondary" className="text-xs">
            {template.itemCount} items
          </Badge>
          {!template.isActive && (
            <Badge variant="outline" className="text-xs">
              Inactive
            </Badge>
          )}
        </div>
        {template.description && (
          <p className="text-xs text-muted-foreground truncate">{template.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Switch
          checked={template.isActive}
          onCheckedChange={onToggleActive}
          className="mr-2"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

