"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Star,
  Tag,
  Package,
  MapPin,
  Loader2,
} from "lucide-react";

type LabelTemplate = {
  id: string;
  name: string;
  description?: string;
  label_type: string;
  width_mm: number;
  height_mm: number;
  margin_mm: number;
  dpi: number;
  is_default: boolean;
  is_active: boolean;
  layout?: Record<string, unknown>;
  created_at: string;
};

const LABEL_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  sale: { label: "Sale/Price", icon: Tag, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  batch: { label: "Batch", icon: Package, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  location: { label: "Location", icon: MapPin, color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
};

export default function TemplateList() {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<LabelTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const url = filterType === "all" 
        ? "/api/label-templates" 
        : `/api/label-templates?type=${filterType}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.data) {
        setTemplates(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch templates:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load templates",
      });
    } finally {
      setLoading(false);
    }
  }, [filterType, toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreateNew = () => {
    router.push("/settings/labels/editor");
  };

  const handleEdit = (template: LabelTemplate) => {
    router.push(`/settings/labels/editor?id=${template.id}`);
  };

  const handleDuplicate = async (template: LabelTemplate) => {
    try {
      const res = await fetch("/api/label-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          description: template.description,
          label_type: template.label_type,
          width_mm: template.width_mm,
          height_mm: template.height_mm,
          margin_mm: template.margin_mm,
          dpi: template.dpi,
          layout: template.layout,
          is_default: false,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || "Failed to duplicate");
      }

      toast({
        title: "Template Duplicated",
        description: `Created "${template.name} (Copy)"`,
      });
      fetchTemplates();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message,
      });
    }
  };

  const handleSetDefault = async (template: LabelTemplate) => {
    try {
      const res = await fetch(`/api/label-templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });

      if (!res.ok) {
        throw new Error("Failed to set default");
      }

      toast({
        title: "Default Updated",
        description: `"${template.name}" is now the default for ${LABEL_TYPE_CONFIG[template.label_type]?.label || template.label_type} labels`,
      });
      fetchTemplates();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message,
      });
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/label-templates/${templateToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete template");
      }

      toast({
        title: "Template Deleted",
        description: `"${templateToDelete.name}" has been removed`,
      });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      fetchTemplates();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTemplates = templates;

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="sale">Sale/Price Labels</SelectItem>
              <SelectItem value="batch">Batch Labels</SelectItem>
              <SelectItem value="location">Location Labels</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <LayoutTemplateIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No templates yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Create your first label template to get started
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => {
            const typeConfig = LABEL_TYPE_CONFIG[template.label_type] || {
              label: template.label_type,
              icon: Tag,
              color: "bg-gray-100 text-gray-700",
            };
            const TypeIcon = typeConfig.icon;

            return (
              <Card key={template.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        {template.name}
                        {template.is_default && (
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {template.width_mm}×{template.height_mm}mm
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {!template.is_default && (
                          <DropdownMenuItem onClick={() => handleSetDefault(template)}>
                            <Star className="h-4 w-4 mr-2" />
                            Set as Default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setTemplateToDelete(template);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={typeConfig.color}>
                      <TypeIcon className="h-3 w-3 mr-1" />
                      {typeConfig.label}
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                  )}
                  {/* Mini Preview */}
                  <div 
                    className="mt-3 border rounded bg-white flex items-center justify-center"
                    style={{
                      width: `${Math.min(template.width_mm * 1.5, 120)}px`,
                      height: `${Math.min(template.height_mm * 1.5, 80)}px`,
                    }}
                  >
                    <span className="text-[8px] text-muted-foreground">
                      {template.width_mm}×{template.height_mm}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LayoutTemplateIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}







