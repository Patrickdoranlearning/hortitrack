"use client";

import { useEffect, useMemo, useState, useCallback, useRef, memo } from "react";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  List,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Magnet,
  Eye,
  Download,
  Send,
  Save,
  Upload,
  Trash2,
  Type,
  Heading,
  ListIcon,
  Table,
  Square,
  Image,
  Minus,
  Space,
  Tag,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Undo2,
  Redo2,
  PanelRightOpen,
  PanelRightClose,
  HelpCircle,
  FileEdit,
  Maximize2,
  Search,
  Clock,
  FileText,
  Receipt,
  Truck,
  ClipboardCheck,
  Leaf,
  Star,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type {
  DocumentComponent,
  DocumentTemplate,
  DocumentType,
  TemplateStatus,
  Position,
  DocumentZone,
} from "@/lib/documents/types";
import { DOCUMENT_FIELDS, defaultLayoutFor } from "@/lib/documents/presets";
import { DocumentCanvas, A4, DEFAULT_ZONES, DEFAULT_MARGINS } from "./DocumentCanvas";
import { PreviewPanel } from "./PreviewPanel";
import { FormEditor } from "./FormEditor";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { getPresetsForType } from "./utils/templatePresets";
import { StylePickerModal } from "./StylePickerModal";

// Editor mode: Visual (canvas), Simple (form), Preview (full-screen)
type EditorMode = "visual" | "simple" | "preview";

type PaletteItem = {
  type: DocumentComponent["type"];
  label: string;
  icon: React.ReactNode;
  description: string;
};

const PALETTE: PaletteItem[] = [
  { type: "heading", label: "Heading", icon: <Heading className="h-4 w-4" />, description: "Section titles" },
  { type: "text", label: "Text", icon: <Type className="h-4 w-4" />, description: "Paragraph text" },
  { type: "list", label: "List", icon: <ListIcon className="h-4 w-4" />, description: "Key/value pairs" },
  { type: "table", label: "Table", icon: <Table className="h-4 w-4" />, description: "Tabular data" },
  { type: "box", label: "Box", icon: <Square className="h-4 w-4" />, description: "Container" },
  { type: "divider", label: "Divider", icon: <Minus className="h-4 w-4" />, description: "Horizontal line" },
  { type: "spacer", label: "Spacer", icon: <Space className="h-4 w-4" />, description: "Vertical space" },
  { type: "chips", label: "Chips", icon: <Tag className="h-4 w-4" />, description: "Tags/pills" },
];

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "invoice", label: "Invoice" },
  { value: "delivery_docket", label: "Delivery Docket" },
  { value: "order_confirmation", label: "Order Confirmation" },
  { value: "av_list", label: "Availability List" },
  { value: "lookin_good", label: "Lookin' Good List" },
];

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5];

// Document type icons mapping
const DOC_TYPE_ICONS: Record<DocumentType, React.ReactNode> = {
  invoice: <Receipt className="h-4 w-4" />,
  delivery_docket: <Truck className="h-4 w-4" />,
  order_confirmation: <ClipboardCheck className="h-4 w-4" />,
  av_list: <Leaf className="h-4 w-4" />,
  lookin_good: <Star className="h-4 w-4" />,
};

// Local storage key for recently used templates
const RECENT_TEMPLATES_KEY = "hortitrack-recent-templates";
const MAX_RECENT_TEMPLATES = 5;

// Memoized template card component for performance
const TemplateCard = memo(function TemplateCard({
  template,
  isSelected,
  isRecent,
  onSelect,
}: {
  template: DocumentTemplate;
  isSelected: boolean;
  isRecent: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(template.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(template.id);
        }
      }}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-all",
        "hover:border-primary hover:shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-muted bg-background"
      )}
    >
      {/* Template card header */}
      <div className="flex items-start gap-2">
        {/* Document type icon */}
        <div className={cn(
          "flex-shrink-0 p-1.5 rounded-md",
          isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {DOC_TYPE_ICONS[template.documentType]}
        </div>

        <div className="flex-1 min-w-0">
          {/* Template name with recent indicator */}
          <div className="flex items-center gap-1">
            {isRecent && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>Recently used</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <span className="font-medium text-sm truncate">{template.name}</span>
          </div>

          {/* Document type label */}
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {DOCUMENT_TYPES.find((d) => d.value === template.documentType)?.label || template.documentType}
          </div>

          {/* Description preview (if exists) */}
          {template.description && (
            <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
              {template.description}
            </div>
          )}
        </div>

        {/* Status badge */}
        <Badge
          variant={template.status === "published" ? "default" : "secondary"}
          className="text-[10px] px-1.5 flex-shrink-0"
        >
          {template.status === "published" ? "Published" : "Draft"}
        </Badge>
      </div>
    </button>
  );
});

type EditorState = {
  id: string | null;
  name: string;
  description: string;
  documentType: DocumentType;
  status: TemplateStatus;
  layout: DocumentComponent[];
};

function makeComponent(
  type: DocumentComponent["type"],
  zone: DocumentZone = "body"
): DocumentComponent {
  const id = nanoid(6);
  const basePosition: Position = {
    x: DEFAULT_MARGINS.left,
    y: zone === "header" ? 10 : zone === "footer" ? A4.height - 15 : 50,
    width: A4.width - DEFAULT_MARGINS.left - DEFAULT_MARGINS.right,
    height: 12,
  };

  switch (type) {
    case "heading":
      return {
        id,
        type,
        zone,
        text: "Heading",
        level: 2,
        style: { fontSize: 20, bold: true, position: basePosition },
      };
    case "text":
      return {
        id,
        type,
        zone,
        text: "Add text here",
        style: { position: basePosition },
      };
    case "divider":
      return {
        id,
        type,
        zone,
        style: { position: { ...basePosition, height: 2 } },
      };
    case "spacer":
      return {
        id,
        type,
        zone,
        size: 12,
        style: { position: { ...basePosition, height: 12 } },
      };
    case "list":
      return {
        id,
        type,
        zone,
        items: [{ label: "Label", binding: "" }],
        style: { position: { ...basePosition, height: 20 } },
      };
    case "chips":
      return {
        id,
        type,
        zone,
        items: [{ label: "Tag", color: "#e2e8f0" }],
        style: { position: { ...basePosition, height: 10 } },
      };
    case "table":
      return {
        id,
        type,
        zone,
        rowsBinding: "lines",
        showHeader: true,
        columns: [
          { key: "col1", label: "Column 1", binding: "description" },
          { key: "col2", label: "Column 2", binding: "quantity", align: "right" },
        ],
        style: { position: { ...basePosition, height: 60 } },
      };
    case "box":
      return {
        id,
        type,
        zone,
        children: [
          { id: `${id}-text`, type: "text", text: "Inside box" } as DocumentComponent,
        ],
        style: { position: { ...basePosition, height: 30 } },
      };
    default:
      return { id, type: "text", zone, text: "Text", style: { position: basePosition } };
  }
}

export function DocumentDesigner() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  // Use undo/redo hook for layout history
  const {
    state: layoutState,
    setState: setLayoutState,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
    replaceState: replaceLayoutState,
  } = useUndoRedo<DocumentComponent[]>(defaultLayoutFor("invoice"), {
    maxHistory: 50,
  });

  const [state, setState] = useState<Omit<EditorState, "layout">>({
    id: null,
    name: "New Template",
    description: "",
    documentType: "invoice",
    status: "draft",
  });

  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Split-pane preview state
  const [showAutoPreview, setShowAutoPreview] = useState(true);
  const [previewFullScreen, setPreviewFullScreen] = useState(false);

  // Template search and filtering
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateTypeFilter, setTemplateTypeFilter] = useState<DocumentType | "all">("all");
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>([]);

  // Save failure recovery state
  const [pendingSave, setPendingSave] = useState<{
    layout: DocumentComponent[];
    state: Omit<EditorState, "layout">;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Style picker modal state
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [stylePickerDocType, setStylePickerDocType] = useState<DocumentType>("invoice");

  // Refs for focus management
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Load recently used templates from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_TEMPLATES_KEY);
      if (stored) {
        setRecentTemplateIds(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Track recent template usage
  const trackRecentTemplate = useCallback((templateId: string) => {
    setRecentTemplateIds((prev) => {
      const filtered = prev.filter((id) => id !== templateId);
      const updated = [templateId, ...filtered].slice(0, MAX_RECENT_TEMPLATES);
      try {
        localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  }, []);

  // Filtered and sorted templates
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Apply type filter
    if (templateTypeFilter !== "all") {
      filtered = filtered.filter((t) => t.documentType === templateTypeFilter);
    }

    // Apply search filter
    if (templateSearch.trim()) {
      const searchLower = templateSearch.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.documentType.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort: recent first, then by name
    return filtered.sort((a, b) => {
      const aRecentIdx = recentTemplateIds.indexOf(a.id);
      const bRecentIdx = recentTemplateIds.indexOf(b.id);

      // Both in recents - sort by recency
      if (aRecentIdx !== -1 && bRecentIdx !== -1) {
        return aRecentIdx - bRecentIdx;
      }
      // Only a in recents
      if (aRecentIdx !== -1) return -1;
      // Only b in recents
      if (bRecentIdx !== -1) return 1;
      // Neither in recents - sort alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [templates, templateSearch, templateTypeFilter, recentTemplateIds]);

  // Check if template is recently used
  const isRecentTemplate = useCallback(
    (templateId: string) => recentTemplateIds.includes(templateId),
    [recentTemplateIds]
  );

  // Warn about unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Editor mode: Visual (canvas), Simple (form), Preview (full-screen)
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  // Legacy list view toggle within visual mode
  const [listViewMode, setListViewMode] = useState<"visual" | "list">("visual");
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(5);
  const [activeZone, setActiveZone] = useState<DocumentZone>("body");

  const activeComponent = useMemo(
    () => layoutState.find((c) => c.id === activeComponentId) ?? null,
    [activeComponentId, layoutState]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/documents/templates");
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setTemplates(json.templates ?? []);
      } catch (err: any) {
        toast.error(err?.message || "Failed to load templates");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const selectTemplate = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents/templates/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const tpl: DocumentTemplate = json.template;
      const layout = tpl.currentVersion?.layout ?? defaultLayoutFor(tpl.documentType);
      const layoutComponents = Array.isArray(layout) ? layout : layout.components;
      setState({
        id: tpl.id,
        name: tpl.name,
        description: tpl.description ?? "",
        documentType: tpl.documentType,
        status: tpl.status,
      });
      // Replace layout without adding to history (new template load)
      replaceLayoutState(layoutComponents);
      resetHistory();
      setActiveComponentId(null);
      setPreviewHtml("");
      setHasUnsavedChanges(false);
      // Clear any pending save error
      setSaveError(null);
      setPendingSave(null);
      // Track this template as recently used
      trackRecentTemplate(tpl.id);
      // Focus main content for keyboard navigation
      mainContentRef.current?.focus();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Open style picker modal when creating new template
  const handleNewTemplateClick = (docType: DocumentType) => {
    setStylePickerDocType(docType);
    setShowStylePicker(true);
  };

  // Create template with selected style
  const handleStyleSelected = async (layout: DocumentComponent[], styleName: string) => {
    setShowStylePicker(false);
    setIsSaving(true);
    try {
      const docTypeLabel = DOCUMENT_TYPES.find((d) => d.value === stylePickerDocType)?.label ?? "Document";
      const payload = {
        name: `${styleName} ${docTypeLabel}`,
        description: `Created from ${styleName} style template`,
        documentType: stylePickerDocType,
        layout: layout,
      };
      const res = await fetch("/api/documents/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const tpl: DocumentTemplate = json.template;
      setTemplates((prev) => [tpl, ...prev]);
      await selectTemplate(tpl.id);
      toast.success(`Template created using ${styleName} style`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Legacy function for backwards compatibility (creates with default layout)
  const handleNewTemplate = async (docType: DocumentType) => {
    setIsSaving(true);
    try {
      const payload = {
        name: `New ${DOCUMENT_TYPES.find((d) => d.value === docType)?.label ?? "Document"}`,
        description: "",
        documentType: docType,
        layout: defaultLayoutFor(docType),
      };
      const res = await fetch("/api/documents/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const tpl: DocumentTemplate = json.template;
      setTemplates((prev) => [tpl, ...prev]);
      await selectTemplate(tpl.id);
      toast.success("Template created");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Update layout with history tracking
  const updateLayout = useCallback((updater: (layout: DocumentComponent[]) => DocumentComponent[]) => {
    setLayoutState((prev) => updater(prev));
    setHasUnsavedChanges(true);
  }, [setLayoutState]);

  const handleAddComponent = useCallback((type: DocumentComponent["type"]) => {
    const component = makeComponent(type, activeZone);
    updateLayout((layout) => [...layout, component]);
    setActiveComponentId(component.id);
  }, [activeZone, updateLayout]);

  const handleRemoveComponent = useCallback((id: string) => {
    updateLayout((layout) => layout.filter((c) => c.id !== id));
    if (activeComponentId === id) setActiveComponentId(null);
  }, [activeComponentId, updateLayout]);

  const handleComponentMove = useCallback((id: string, position: Position) => {
    updateLayout((layout) =>
      layout.map((c) =>
        c.id === id
          ? { ...c, style: { ...c.style, position: { ...c.style?.position, ...position } } }
          : c
      )
    );
  }, [updateLayout]);

  const handleComponentDrop = useCallback((type: string, position: Position) => {
    // Determine zone based on Y position
    const headerHeight = DEFAULT_ZONES[0].height;
    const footerStart = A4.height - DEFAULT_ZONES[2].height;
    let zone: DocumentZone = "body";
    if (position.y < headerHeight) {
      zone = "header";
    } else if (position.y >= footerStart) {
      zone = "footer";
    }

    const component = makeComponent(type as DocumentComponent["type"], zone);
    // Update position to dropped location
    component.style = {
      ...component.style,
      position: {
        ...component.style?.position,
        x: position.x,
        y: position.y,
        width: position.width,
      },
    };
    updateLayout((layout) => [...layout, component]);
    setActiveComponentId(component.id);
  }, [updateLayout]);

  const handleComponentChange = useCallback((patch: Partial<DocumentComponent>) => {
    if (!activeComponentId) return;
    updateLayout((layout) =>
      layout.map((c) =>
        c.id === activeComponentId ? ({ ...c, ...patch } as DocumentComponent) : c
      )
    );
  }, [activeComponentId, updateLayout]);

  const handlePositionChange = (patch: Partial<Position>) => {
    if (!activeComponentId || !activeComponent) return;
    const currentPos = activeComponent.style?.position ?? { x: 0, y: 0 };
    handleComponentChange({
      style: {
        ...activeComponent.style,
        position: { ...currentPos, ...patch },
      },
    });
  };

  const handleSaveDraft = async (retryFromPending = false) => {
    setIsSaving(true);
    setSaveError(null);

    // Use pending save data if retrying from recovery
    const saveLayout = retryFromPending && pendingSave ? pendingSave.layout : layoutState;
    const saveState = retryFromPending && pendingSave ? pendingSave.state : state;

    try {
      const payload = {
        id: saveState.id ?? undefined,
        name: saveState.name,
        description: saveState.description,
        documentType: saveState.documentType,
        status: "draft",
        layout: saveLayout,
      };
      const res = await fetch(
        saveState.id ? `/api/documents/templates/${saveState.id}` : "/api/documents/templates",
        {
          method: saveState.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const tpl: DocumentTemplate = json.template;
      setState((prev) => ({
        ...prev,
        id: tpl.id,
        status: tpl.status,
      }));
      setTemplates((prev) => {
        const others = prev.filter((t) => t.id !== tpl.id);
        return [tpl, ...others];
      });
      setHasUnsavedChanges(false);
      // Clear pending save on success
      setPendingSave(null);
      toast.success("Draft saved");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      // Store the failed save for recovery
      setPendingSave({
        layout: saveLayout,
        state: saveState,
      });
      setSaveError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!state.id) {
      await handleSaveDraft();
    }
    if (!state.id) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/documents/templates/${state.id}/publish`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const tpl: DocumentTemplate = json.template;
      setState((prev) => ({ ...prev, status: tpl.status }));
      setTemplates((prev) => {
        const others = prev.filter((t) => t.id !== tpl.id);
        return [tpl, ...others];
      });
      setHasUnsavedChanges(false);
      toast.success("Template published");
    } catch (err: any) {
      toast.error(err?.message || "Publish failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!state.id) {
      await handleSaveDraft();
    }
    if (!state.id) return;
    setIsPreviewing(true);
    try {
      const res = await fetch(`/api/documents/templates/${state.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: layoutState,
          documentType: state.documentType,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setPreviewHtml(json.html ?? "");
    } catch (err: any) {
      toast.error(err?.message || "Preview failed");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!state.id) {
      await handleSaveDraft();
    }
    if (!state.id) return;
    try {
      const res = await fetch(`/api/documents/templates/${state.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: layoutState,
          documentType: state.documentType,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.name.replace(/\s+/g, "_") || "document"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (err: any) {
      toast.error(err?.message || "PDF download failed");
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo) {
      toast.error("Add recipient email first");
      return;
    }
    if (!state.id) {
      await handleSaveDraft();
    }
    if (!state.id) return;
    try {
      const res = await fetch(`/api/documents/templates/${state.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          layout: layoutState,
          documentType: state.documentType,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.sent === false) {
        throw new Error(json.error ?? "Send failed");
      }
      toast.success("Test email queued");
    } catch (err: any) {
      toast.error(err?.message || "Send failed");
    }
  };

  const handleZoomIn = () => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[idx + 1]);
  };

  const handleZoomOut = () => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx > 0) setZoom(ZOOM_LEVELS[idx - 1]);
  };

  // Keyboard shortcuts (must be after function definitions)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd+S - Save
      if (modifier && e.key === "s") {
        e.preventDefault();
        if (!isSaving) {
          handleSaveDraft(false);
        }
      }

      // Ctrl/Cmd+P - Preview mode toggle
      if (modifier && e.key === "p") {
        e.preventDefault();
        if (editorMode === "preview") {
          setEditorMode("visual");
        } else {
          setEditorMode("preview");
        }
      }

      // Ctrl/Cmd+Shift+P - Toggle live preview panel
      if (modifier && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setShowAutoPreview((prev) => !prev);
      }

      // Ctrl/Cmd+F - Focus search
      if (modifier && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Delete/Backspace - Delete selected component
      if ((e.key === "Delete" || e.key === "Backspace") && activeComponentId && editorMode === "visual") {
        e.preventDefault();
        handleRemoveComponent(activeComponentId);
      }

      // Escape - Deselect component or close preview
      if (e.key === "Escape") {
        if (editorMode === "preview") {
          setEditorMode("visual");
        } else if (activeComponentId) {
          setActiveComponentId(null);
        }
      }

      // 1, 2, 3 - Switch editor modes (with modifier)
      if (e.key === "1" && modifier) {
        e.preventDefault();
        setEditorMode("visual");
      }
      if (e.key === "2" && modifier) {
        e.preventDefault();
        setEditorMode("simple");
      }
      if (e.key === "3" && modifier) {
        e.preventDefault();
        setEditorMode("preview");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeComponentId, editorMode, isSaving, handleRemoveComponent]);

  return (
    <div className="h-full flex flex-col">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background">
        <div className="flex items-center gap-4">
          {/* Template name and type */}
          <Input
            value={state.name}
            onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Template name"
            className="w-[200px] h-8"
          />
          <Select
            value={state.documentType}
            onValueChange={(v) => {
              setState((prev) => ({
                ...prev,
                documentType: v as DocumentType,
              }));
              const newLayout = defaultLayoutFor(v as DocumentType);
              replaceLayoutState(newLayout);
              resetHistory();
            }}
          >
            <SelectTrigger className="w-[160px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant={state.status === "published" ? "default" : "secondary"}>
            {state.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={!canUndo}
                  className="h-8 w-8 p-0"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  disabled={!canRedo}
                  className="h-8 w-8 p-0"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="h-6" />

          {/* Editor Mode Switcher - Visual | Simple | Preview */}
          <div className="flex items-center border rounded-md" role="tablist" aria-label="Editor mode">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={editorMode === "visual" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-r-none h-8 px-3"
                    onClick={() => setEditorMode("visual")}
                    role="tab"
                    aria-selected={editorMode === "visual"}
                    aria-label="Visual editor mode"
                  >
                    <LayoutGrid className="h-4 w-4 mr-1" aria-hidden="true" />
                    Visual
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Visual canvas editor with drag & drop (Ctrl+1)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={editorMode === "simple" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-none h-8 px-3 border-x"
                    onClick={() => setEditorMode("simple")}
                    role="tab"
                    aria-selected={editorMode === "simple"}
                    aria-label="Simple editor mode"
                  >
                    <FileEdit className="h-4 w-4 mr-1" aria-hidden="true" />
                    Simple
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Form-based editor for easy configuration (Ctrl+2)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={editorMode === "preview" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-l-none h-8 px-3"
                    onClick={() => setEditorMode("preview")}
                    role="tab"
                    aria-selected={editorMode === "preview"}
                    aria-label="Preview mode"
                  >
                    <Maximize2 className="h-4 w-4 mr-1" aria-hidden="true" />
                    Preview
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Full-screen document preview (Ctrl+3)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Visual mode specific controls */}
          {editorMode === "visual" && (
            <>
              {/* List/Grid toggle within visual mode */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={listViewMode === "visual" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-r-none h-8"
                  onClick={() => setListViewMode("visual")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={listViewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-l-none h-8"
                  onClick={() => setListViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-6" />

              {/* Zoom controls */}
              <Button variant="ghost" size="sm" onClick={handleZoomOut} disabled={zoom <= 0.5}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="sm" onClick={handleZoomIn} disabled={zoom >= 1.5}>
                <ZoomIn className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6" />

              {/* Grid and snap */}
              <Button
                variant={showGrid ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowGrid(!showGrid)}
                title="Show grid"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={snapToGrid ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSnapToGrid(!snapToGrid)}
                title="Snap to grid"
              >
                <Magnet className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6" />
            </>
          )}

          {/* Live Preview Toggle - show for Visual and Simple modes */}
          {editorMode !== "preview" && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showAutoPreview ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setShowAutoPreview(!showAutoPreview)}
                    className="h-8"
                  >
                    {showAutoPreview ? (
                      <PanelRightClose className="h-4 w-4 mr-1" />
                    ) : (
                      <PanelRightOpen className="h-4 w-4 mr-1" />
                    )}
                    Live Preview
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showAutoPreview ? "Hide live preview panel" : "Show live preview panel"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <Separator orientation="vertical" className="h-6" />

          {/* Actions */}
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={isPreviewing}>
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSaveDraft(false)} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button variant="accent" size="sm" onClick={handlePublish} disabled={isSaving}>
            <Upload className="h-4 w-4 mr-1" />
            Publish
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Templates & Palette (hidden in preview mode) */}
        {editorMode !== "preview" && (
        <div className="w-56 border-r flex flex-col bg-muted/30">
          <Tabs defaultValue="templates" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2">
              <TabsTrigger value="templates" className="text-xs">
                Templates
              </TabsTrigger>
              {/* Components tab only in visual mode */}
              {editorMode === "visual" && (
                <TabsTrigger value="components" className="text-xs">
                  Components
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="templates" className="flex-1 p-2 mt-0 overflow-hidden flex flex-col">
              {/* New template button - opens style picker */}
              <div className="mb-2">
                <Select onValueChange={(v) => handleNewTemplateClick(v as DocumentType)}>
                  <SelectTrigger className="h-8 text-xs" aria-label="Create new template">
                    <SelectValue placeholder="+ New template" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        <div className="flex items-center gap-2">
                          {DOC_TYPE_ICONS[d.value]}
                          <span>{d.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search input */}
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search templates..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="h-8 text-xs pl-7"
                  aria-label="Search templates"
                />
              </div>

              {/* Type filter */}
              <div className="mb-2">
                <Select
                  value={templateTypeFilter}
                  onValueChange={(v) => setTemplateTypeFilter(v as DocumentType | "all")}
                >
                  <SelectTrigger className="h-7 text-[10px]" aria-label="Filter by document type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {DOCUMENT_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        <div className="flex items-center gap-2">
                          {DOC_TYPE_ICONS[d.value]}
                          <span>{d.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Save failure recovery banner */}
              {saveError && pendingSave && (
                <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-destructive">Unsaved changes</p>
                      <p className="text-[10px] text-muted-foreground truncate">{saveError}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 h-6 text-[10px]"
                        onClick={() => handleSaveDraft(true)}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Retrying...
                          </>
                        ) : (
                          "Retry Save"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Template list */}
              <ScrollArea className="flex-1">
                <div className="space-y-2" role="listbox" aria-label="Templates">
                  {filteredTemplates.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      template={tpl}
                      isSelected={state.id === tpl.id}
                      isRecent={isRecentTemplate(tpl.id)}
                      onSelect={selectTemplate}
                    />
                  ))}

                  {/* Loading state */}
                  {isLoading && (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-xs text-muted-foreground">Loading templates...</span>
                    </div>
                  )}

                  {/* Empty states */}
                  {!isLoading && filteredTemplates.length === 0 && templates.length > 0 && (
                    <div className="text-center p-4">
                      <Search className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">No templates match your search</p>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs mt-1"
                        onClick={() => {
                          setTemplateSearch("");
                          setTemplateTypeFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  )}

                  {!isLoading && templates.length === 0 && (
                    <div className="text-center p-4">
                      <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">No templates yet</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Create one using the dropdown above
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="components" className="flex-1 p-2 mt-0 overflow-hidden">
              <p className="text-[10px] text-muted-foreground mb-2">
                Drag elements onto the document or click to add
              </p>
              <ScrollArea className="h-[calc(100%-30px)]">
                <div className="space-y-2">
                  {/* Visual component previews - draggable */}
                  {PALETTE.map((item) => (
                    <div
                      key={item.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("componentType", item.type);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddComponent(item.type)}
                      className="rounded-lg border bg-white p-3 cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-sm transition-all"
                    >
                      {/* Visual preview of each component type */}
                      {item.type === "heading" && (
                        <div className="font-bold text-sm">Heading Text</div>
                      )}
                      {item.type === "text" && (
                        <div className="text-xs text-muted-foreground leading-relaxed">
                          Paragraph text content goes here...
                        </div>
                      )}
                      {item.type === "list" && (
                        <ul className="text-xs space-y-0.5 list-disc list-inside text-muted-foreground">
                          <li>List item one</li>
                          <li>List item two</li>
                        </ul>
                      )}
                      {item.type === "table" && (
                        <div className="border rounded overflow-hidden">
                          <div className="grid grid-cols-3 text-[9px] font-medium bg-muted/50">
                            <div className="px-1.5 py-0.5 border-r">Col 1</div>
                            <div className="px-1.5 py-0.5 border-r">Col 2</div>
                            <div className="px-1.5 py-0.5">Col 3</div>
                          </div>
                          <div className="grid grid-cols-3 text-[9px] text-muted-foreground">
                            <div className="px-1.5 py-0.5 border-r border-t">Data</div>
                            <div className="px-1.5 py-0.5 border-r border-t">Data</div>
                            <div className="px-1.5 py-0.5 border-t">Data</div>
                          </div>
                        </div>
                      )}
                      {item.type === "box" && (
                        <div className="border-2 border-dashed rounded p-2 text-[10px] text-muted-foreground text-center">
                          Container Box
                        </div>
                      )}
                      {item.type === "divider" && (
                        <hr className="border-t-2 my-1" />
                      )}
                      {item.type === "spacer" && (
                        <div className="h-4 bg-stripes rounded flex items-center justify-center">
                          <span className="text-[9px] text-muted-foreground">Spacer</span>
                        </div>
                      )}
                      {item.type === "chips" && (
                        <div className="flex gap-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100">Tag 1</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100">Tag 2</span>
                        </div>
                      )}
                      {item.type === "image" && (
                        <div className="h-8 bg-muted rounded flex items-center justify-center">
                          <Image className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t">
                        <span className="text-[10px] font-medium">{item.label}</span>
                        <span className="text-muted-foreground">{item.icon}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        )}

        {/* Main Editor Area - changes based on mode */}
        <div
          ref={mainContentRef}
          className={cn("overflow-hidden flex-1")}
          tabIndex={-1}
          role="main"
          aria-label="Document editor"
        >
          {/* Visual Mode - Canvas editor */}
          {editorMode === "visual" && (
            <>
              {listViewMode === "visual" ? (
                <DocumentCanvas
                  layout={layoutState}
                  selectedId={activeComponentId}
                  onSelect={setActiveComponentId}
                  onMove={handleComponentMove}
                  onDrop={handleComponentDrop}
                  zoom={zoom}
                  showGrid={showGrid}
                  snapToGrid={snapToGrid}
                  gridSize={gridSize}
                />
              ) : (
                <div className="h-full p-4 overflow-auto">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Layout Components</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {layoutState.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => setActiveComponentId(c.id)}
                            className={cn(
                              "rounded-md border px-3 py-2 cursor-pointer",
                              activeComponentId === c.id
                                ? "border-primary bg-primary/5"
                                : "border-muted hover:border-primary/50"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {c.zone || "body"}
                                </Badge>
                                <span className="text-sm font-medium capitalize">{c.type}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveComponent(c.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            {(c.type === "heading" || c.type === "text") && (
                              <div className="text-xs text-muted-foreground mt-1 truncate">
                                {c.text}
                              </div>
                            )}
                          </div>
                        ))}
                        {layoutState.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No components. Add from the palette.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}

          {/* Simple Mode - Form-based editor */}
          {editorMode === "simple" && (
            <FormEditor
              layout={layoutState}
              documentType={state.documentType}
              onLayoutChange={(newLayout) => {
                setLayoutState(() => newLayout);
                setHasUnsavedChanges(true);
              }}
            />
          )}

          {/* Preview Mode - Full-screen preview */}
          {editorMode === "preview" && (
            <PreviewPanel
              layout={layoutState}
              documentType={state.documentType}
              fullScreen={true}
              onToggleFullScreen={() => setEditorMode("visual")}
            />
          )}
        </div>

        {/* Live Preview Panel - shown when showAutoPreview is true and not in preview mode */}
        {showAutoPreview && editorMode !== "preview" && (
          <div className="w-[400px] border-l">
            <PreviewPanel
              layout={layoutState}
              documentType={state.documentType}
              fullScreen={previewFullScreen}
              onToggleFullScreen={() => setPreviewFullScreen(!previewFullScreen)}
            />
          </div>
        )}

        {/* Right sidebar - Properties (only shown in visual mode) */}
        {editorMode === "visual" && (
        <div className="w-64 border-l bg-muted/30 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-sm font-semibold mb-3">Properties</h3>

            {!activeComponent && (
              <p className="text-xs text-muted-foreground">
                Select a component to edit its properties
              </p>
            )}

            {activeComponent && (
              <div className="space-y-4">
                {/* Position section */}
                {listViewMode === "visual" && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Position</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">X (mm)</Label>
                        <Input
                          type="number"
                          value={activeComponent.style?.position?.x ?? 0}
                          onChange={(e) =>
                            handlePositionChange({ x: parseFloat(e.target.value) || 0 })
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Y (mm)</Label>
                        <Input
                          type="number"
                          value={activeComponent.style?.position?.y ?? 0}
                          onChange={(e) =>
                            handlePositionChange({ y: parseFloat(e.target.value) || 0 })
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Width (mm)</Label>
                        <Input
                          type="number"
                          value={activeComponent.style?.position?.width ?? ""}
                          placeholder="Auto"
                          onChange={(e) =>
                            handlePositionChange({
                              width: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Height (mm)</Label>
                        <Input
                          type="number"
                          value={activeComponent.style?.position?.height ?? ""}
                          placeholder="Auto"
                          onChange={(e) =>
                            handlePositionChange({
                              height: e.target.value ? parseFloat(e.target.value) : undefined,
                            })
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                    <Separator className="my-2" />
                  </div>
                )}

                {/* Zone */}
                <div>
                  <Label className="text-[10px]">Zone</Label>
                  <Select
                    value={activeComponent.zone || "body"}
                    onValueChange={(v) => handleComponentChange({ zone: v as DocumentZone })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="header">Header</SelectItem>
                      <SelectItem value="body">Body</SelectItem>
                      <SelectItem value="footer">Footer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Text content */}
                {(activeComponent.type === "heading" || activeComponent.type === "text") && (
                  <>
                    <div>
                      <Label className="text-[10px]">Text</Label>
                      <Textarea
                        rows={3}
                        value={activeComponent.text ?? ""}
                        onChange={(e) => handleComponentChange({ text: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                    {activeComponent.type === "heading" && (
                      <div>
                        <Label className="text-[10px]">Level</Label>
                        <Select
                          value={String(activeComponent.level ?? 2)}
                          onValueChange={(v) =>
                            handleComponentChange({ level: Number(v) as 1 | 2 | 3 | 4 })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">H1 - Large</SelectItem>
                            <SelectItem value="2">H2 - Medium</SelectItem>
                            <SelectItem value="3">H3 - Small</SelectItem>
                            <SelectItem value="4">H4 - Tiny</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label className="text-[10px]">Alignment</Label>
                      <div className="flex gap-1 mt-1">
                        <Button
                          variant={activeComponent.style?.align === "left" ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() =>
                            handleComponentChange({ style: { ...activeComponent.style, align: "left" } })
                          }
                        >
                          <AlignLeft className="h-3 w-3" />
                        </Button>
                        <Button
                          variant={activeComponent.style?.align === "center" ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() =>
                            handleComponentChange({ style: { ...activeComponent.style, align: "center" } })
                          }
                        >
                          <AlignCenter className="h-3 w-3" />
                        </Button>
                        <Button
                          variant={activeComponent.style?.align === "right" ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() =>
                            handleComponentChange({ style: { ...activeComponent.style, align: "right" } })
                          }
                        >
                          <AlignRight className="h-3 w-3" />
                        </Button>
                        <Button
                          variant={activeComponent.style?.bold ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() =>
                            handleComponentChange({
                              style: { ...activeComponent.style, bold: !activeComponent.style?.bold },
                            })
                          }
                        >
                          <Bold className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* List items */}
                {activeComponent.type === "list" && (
                  <div className="space-y-2">
                    <Label className="text-[10px]">Items</Label>
                    {(activeComponent.items ?? []).map((item, idx) => (
                      <div key={idx} className="space-y-1 rounded-md border p-2">
                        <Input
                          placeholder="Label"
                          value={item.label ?? ""}
                          onChange={(e) => {
                            const items = [...(activeComponent.items ?? [])];
                            items[idx] = { ...items[idx], label: e.target.value };
                            handleComponentChange({ items });
                          }}
                          className="h-7 text-xs"
                        />
                        <Input
                          placeholder="Data field (e.g. totals.total)"
                          value={item.binding ?? ""}
                          onChange={(e) => {
                            const items = [...(activeComponent.items ?? [])];
                            items[idx] = { ...items[idx], binding: e.target.value };
                            handleComponentChange({ items });
                          }}
                          className="h-7 text-xs"
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      onClick={() =>
                        handleComponentChange({
                          items: [...(activeComponent.items ?? []), { label: "Label", binding: "" }],
                        })
                      }
                    >
                      Add item
                    </Button>
                  </div>
                )}

                {/* Table columns */}
                {activeComponent.type === "table" && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[10px]">Data source (rows)</Label>
                      <Input
                        placeholder="e.g. lines, items"
                        value={activeComponent.rowsBinding ?? ""}
                        onChange={(e) => handleComponentChange({ rowsBinding: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </div>
                    <Label className="text-[10px]">Columns</Label>
                    {(activeComponent.columns ?? []).map((col, idx) => (
                      <div key={col.key} className="space-y-1 rounded-md border p-2">
                        <Input
                          placeholder="Label"
                          value={col.label}
                          onChange={(e) => {
                            const columns = [...(activeComponent.columns ?? [])];
                            columns[idx] = { ...columns[idx], label: e.target.value };
                            handleComponentChange({ columns });
                          }}
                          className="h-7 text-xs"
                        />
                        <Input
                          placeholder="Data field (e.g. description)"
                          value={col.binding ?? ""}
                          onChange={(e) => {
                            const columns = [...(activeComponent.columns ?? [])];
                            columns[idx] = { ...columns[idx], binding: e.target.value };
                            handleComponentChange({ columns });
                          }}
                          className="h-7 text-xs"
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      onClick={() =>
                        handleComponentChange({
                          columns: [
                            ...(activeComponent.columns ?? []),
                            { key: nanoid(4), label: "Column", binding: "" },
                          ],
                        })
                      }
                    >
                      Add column
                    </Button>
                  </div>
                )}

                {/* Spacer height */}
                {activeComponent.type === "spacer" && (
                  <div>
                    <Label className="text-[10px]">Height (px)</Label>
                    <Input
                      type="number"
                      value={activeComponent.size ?? 12}
                      onChange={(e) => handleComponentChange({ size: Number(e.target.value) })}
                      className="h-7 text-xs"
                    />
                  </div>
                )}

                <Separator />

                {/* Delete button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive h-8"
                  onClick={() => handleRemoveComponent(activeComponent.id)}
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete Component
                </Button>
              </div>
            )}

            {/* Data Fields reference - renamed from "Bindings" for clarity */}
            <div className="mt-6">
              <div className="flex items-center gap-1 mb-2">
                <h3 className="text-sm font-semibold">Data Fields</h3>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      <p className="text-xs">
                        Data fields are placeholders that get replaced with actual values when the document is generated.
                        Use the path (e.g., customer.name) in your template.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">
                Click a field to copy its path. Use in text as {`{{field.path}}`}
              </p>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {DOCUMENT_FIELDS[state.documentType]?.map((f) => (
                    <button
                      key={f.path}
                      className="w-full rounded-md border px-2 py-1.5 text-xs bg-background hover:bg-muted/50 hover:border-primary/50 transition-colors text-left"
                      onClick={() => {
                        navigator.clipboard.writeText(f.path);
                        toast.success(`${f.path} copied to clipboard`);
                      }}
                    >
                      <div className="font-medium">{f.label}</div>
                      <div className="text-muted-foreground text-[10px] font-mono">{f.path}</div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Test email section */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-2">Test Email</h3>
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="recipient@example.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8"
                  onClick={handleSendEmail}
                >
                  <Send className="h-3 w-3 mr-2" />
                  Send Test
                </Button>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Preview modal/panel could go here */}
      {previewHtml && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-[800px] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Preview</h3>
              <Button variant="ghost" size="sm" onClick={() => setPreviewHtml("")}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                title="preview"
                className="w-full h-[600px] border rounded"
                srcDoc={previewHtml}
              />
            </div>
          </div>
        </div>
      )}

      {/* Style Picker Modal - shown when creating new template */}
      <StylePickerModal
        open={showStylePicker}
        onClose={() => setShowStylePicker(false)}
        documentType={stylePickerDocType}
        onStyleSelect={handleStyleSelected}
      />
    </div>
  );
}




