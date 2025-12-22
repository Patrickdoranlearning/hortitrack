"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [state, setState] = useState<EditorState>({
    id: null,
    name: "New Template",
    description: "",
    documentType: "invoice",
    status: "draft",
    layout: defaultLayoutFor("invoice"),
  });
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState<string>("");

  // Canvas view state
  const [editorMode, setEditorMode] = useState<"visual" | "list">("visual");
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(5);
  const [activeZone, setActiveZone] = useState<DocumentZone>("body");

  const activeComponent = useMemo(
    () => state.layout.find((c) => c.id === activeComponentId) ?? null,
    [activeComponentId, state.layout]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/documents/templates");
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setTemplates(json.templates ?? []);
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Failed to load templates",
          description: err?.message,
        });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [toast]);

  const selectTemplate = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/documents/templates/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const tpl: DocumentTemplate = json.template;
      const layout = tpl.currentVersion?.layout ?? defaultLayoutFor(tpl.documentType);
      setState({
        id: tpl.id,
        name: tpl.name,
        description: tpl.description ?? "",
        documentType: tpl.documentType,
        status: tpl.status,
        layout: Array.isArray(layout) ? layout : layout.components,
      });
      setActiveComponentId(null);
      setPreviewHtml("");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to load template",
        description: err?.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

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
      toast({ title: "Template created" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Create failed", description: err?.message });
    } finally {
      setIsSaving(false);
    }
  };

  const updateLayout = (updater: (layout: DocumentComponent[]) => DocumentComponent[]) => {
    setState((prev) => ({ ...prev, layout: updater(prev.layout) }));
  };

  const handleAddComponent = (type: DocumentComponent["type"]) => {
    const component = makeComponent(type, activeZone);
    updateLayout((layout) => [...layout, component]);
    setActiveComponentId(component.id);
  };

  const handleRemoveComponent = (id: string) => {
    updateLayout((layout) => layout.filter((c) => c.id !== id));
    if (activeComponentId === id) setActiveComponentId(null);
  };

  const handleComponentMove = (id: string, position: Position) => {
    updateLayout((layout) =>
      layout.map((c) =>
        c.id === id
          ? { ...c, style: { ...c.style, position: { ...c.style?.position, ...position } } }
          : c
      )
    );
  };

  const handleComponentDrop = (type: string, position: Position) => {
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
  };

  const handleComponentChange = (patch: Partial<DocumentComponent>) => {
    if (!activeComponentId) return;
    updateLayout((layout) =>
      layout.map((c) =>
        c.id === activeComponentId ? ({ ...c, ...patch } as DocumentComponent) : c
      )
    );
  };

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

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const payload = {
        id: state.id ?? undefined,
        name: state.name,
        description: state.description,
        documentType: state.documentType,
        status: "draft",
        layout: state.layout,
      };
      const res = await fetch(
        state.id ? `/api/documents/templates/${state.id}` : "/api/documents/templates",
        {
          method: state.id ? "PUT" : "POST",
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
      toast({ title: "Draft saved" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err?.message });
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
      toast({ title: "Template published" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Publish failed", description: err?.message });
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
          layout: state.layout,
          documentType: state.documentType,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setPreviewHtml(json.html ?? "");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Preview failed", description: err?.message });
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
          layout: state.layout,
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
      toast({ title: "PDF downloaded" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "PDF failed", description: err?.message });
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo) {
      toast({ variant: "destructive", title: "Add recipient email first" });
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
          layout: state.layout,
          documentType: state.documentType,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.sent === false) {
        throw new Error(json.error ?? "Send failed");
      }
      toast({ title: "Test email queued" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Send failed", description: err?.message });
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
            onValueChange={(v) =>
              setState((prev) => ({
                ...prev,
                documentType: v as DocumentType,
                layout: defaultLayoutFor(v as DocumentType),
              }))
            }
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
          {/* View toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={editorMode === "visual" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none h-8"
              onClick={() => setEditorMode("visual")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={editorMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none h-8"
              onClick={() => setEditorMode("list")}
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

          {/* Actions */}
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={isPreviewing}>
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button variant="accent" size="sm" onClick={handlePublish} disabled={isSaving}>
            <Upload className="h-4 w-4 mr-1" />
            Publish
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Templates & Palette */}
        <div className="w-56 border-r flex flex-col bg-muted/30">
          <Tabs defaultValue="templates" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2">
              <TabsTrigger value="templates" className="text-xs">
                Templates
              </TabsTrigger>
              <TabsTrigger value="components" className="text-xs">
                Components
              </TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="flex-1 p-2 mt-0 overflow-hidden">
              <div className="mb-2">
                <Select onValueChange={(v) => handleNewTemplate(v as DocumentType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="+ New template" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ScrollArea className="h-[calc(100%-40px)]">
                <div className="space-y-1">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => selectTemplate(tpl.id)}
                      className={cn(
                        "w-full rounded-md border px-2 py-2 text-left hover:border-primary transition text-xs",
                        state.id === tpl.id ? "border-primary bg-primary/5" : "border-muted bg-background"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium truncate">{tpl.name}</span>
                        <Badge
                          variant={tpl.status === "published" ? "default" : "secondary"}
                          className="text-[10px] px-1"
                        >
                          {tpl.status === "published" ? "pub" : "draft"}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">{tpl.documentType}</div>
                    </button>
                  ))}
                  {isLoading && (
                    <p className="text-xs text-muted-foreground p-2">Loading...</p>
                  )}
                  {!isLoading && templates.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">No templates yet</p>
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

        {/* Canvas area */}
        <div className="flex-1 overflow-hidden">
          {editorMode === "visual" ? (
            <DocumentCanvas
              layout={state.layout}
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
                    {state.layout.map((c) => (
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
                    {state.layout.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No components. Add from the palette.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right sidebar - Properties */}
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
                {editorMode === "visual" && (
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
                          placeholder="Binding (e.g. totals.total)"
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
                      <Label className="text-[10px]">Rows binding</Label>
                      <Input
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
                          placeholder="Binding"
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

            {/* Bindings reference */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-2">Available Bindings</h3>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {DOCUMENT_FIELDS[state.documentType]?.map((f) => (
                    <div key={f.path} className="rounded-md border px-2 py-1 text-xs bg-background">
                      <div className="font-medium">{f.label}</div>
                      <div className="text-muted-foreground text-[10px] font-mono">{f.path}</div>
                    </div>
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
    </div>
  );
}

