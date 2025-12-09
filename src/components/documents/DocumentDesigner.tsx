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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  DocumentComponent,
  DocumentTemplate,
  DocumentType,
  TemplateStatus,
} from "@/lib/documents/types";
import { DOCUMENT_FIELDS, defaultLayoutFor } from "@/lib/documents/presets";

type PaletteItem = {
  type: DocumentComponent["type"];
  label: string;
  description: string;
};

const PALETTE: PaletteItem[] = [
  { type: "heading", label: "Heading", description: "Section titles and page headers" },
  { type: "text", label: "Text", description: "Paragraph or label text" },
  { type: "list", label: "Key/Value List", description: "Small summary rows" },
  { type: "table", label: "Table", description: "Line items and tabular data" },
  { type: "divider", label: "Divider", description: "Horizontal rule" },
  { type: "spacer", label: "Spacer", description: "Vertical spacing" },
  { type: "box", label: "Box", description: "Bordered container" },
  { type: "chips", label: "Chips", description: "Inline tags/pills" },
];

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "invoice", label: "Invoice" },
  { value: "delivery_docket", label: "Delivery Docket" },
  { value: "order_confirmation", label: "Order Confirmation" },
  { value: "av_list", label: "Availability List" },
  { value: "lookin_good", label: "Lookin' Good List" },
];

type EditorState = {
  id: string | null;
  name: string;
  description: string;
  documentType: DocumentType;
  status: TemplateStatus;
  layout: DocumentComponent[];
};

function makeComponent(type: DocumentComponent["type"]): DocumentComponent {
  const id = nanoid(6);
  switch (type) {
    case "heading":
      return { id, type, text: "Heading", level: 2, style: { fontSize: 20, bold: true } };
    case "text":
      return { id, type, text: "Add text" };
    case "divider":
      return { id, type };
    case "spacer":
      return { id, type, size: 12 };
    case "list":
      return { id, type, items: [{ label: "Label", binding: "" }] };
    case "chips":
      return { id, type, items: [{ label: "Tag", color: "#e2e8f0" }] };
    case "table":
      return {
        id,
        type,
        rowsBinding: "lines",
        showHeader: true,
        columns: [
          { key: "col1", label: "Column 1", binding: "description" },
          { key: "col2", label: "Column 2", binding: "quantity", align: "right" },
        ],
      };
    case "box":
      return { id, type, children: [{ id: `${id}-text`, type: "text", text: "Inside box" } as DocumentComponent] };
    default:
      return { id, type: "text", text: "Text" };
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
  const [dragId, setDragId] = useState<string | null>(null);
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState<string>("");

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
        toast({ variant: "destructive", title: "Failed to load templates", description: err?.message });
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
      setState({
        id: tpl.id,
        name: tpl.name,
        description: tpl.description ?? "",
        documentType: tpl.documentType,
        status: tpl.status,
        layout: tpl.currentVersion?.layout ?? defaultLayoutFor(tpl.documentType),
      });
      setActiveComponentId(null);
      setPreviewHtml("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load template", description: err?.message });
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
    const component = makeComponent(type);
    updateLayout((layout) => [...layout, component]);
    setActiveComponentId(component.id);
  };

  const handleRemoveComponent = (id: string) => {
    updateLayout((layout) => layout.filter((c) => c.id !== id));
    if (activeComponentId === id) setActiveComponentId(null);
  };

  const handleReorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    updateLayout((layout) => {
      const next = [...layout];
      const from = next.findIndex((c) => c.id === dragId);
      const to = next.findIndex((c) => c.id === targetId);
      if (from === -1 || to === -1) return layout;
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleComponentChange = (patch: Partial<DocumentComponent>) => {
    if (!activeComponentId) return;
    updateLayout((layout) =>
      layout.map((c) => (c.id === activeComponentId ? { ...c, ...patch } as DocumentComponent : c))
    );
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
      const res = await fetch(state.id ? `/api/documents/templates/${state.id}` : "/api/documents/templates", {
        method: state.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
      const res = await fetch(`/api/documents/templates/${state.id}/publish`, { method: "POST" });
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
        body: JSON.stringify({ layout: state.layout, documentType: state.documentType }),
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
        body: JSON.stringify({ layout: state.layout, documentType: state.documentType }),
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

  const renderComponentSummary = (component: DocumentComponent) => {
    switch (component.type) {
      case "heading":
      case "text":
        return component.text;
      case "table":
        return `${component.columns?.length ?? 0} columns from ${component.rowsBinding ?? ""}`;
      case "list":
        return `${component.items?.length ?? 0} items`;
      case "box":
        return `${component.children?.length ?? 0} children`;
      default:
        return "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Document Designer</h1>
          <p className="text-sm text-muted-foreground">Design PDFs, print views, and emails for invoices, dockets, confirmations, AV and Lookin&apos; Good lists.</p>
        </div>
        <div className="flex gap-2">
          <Select onValueChange={(v) => handleNewTemplate(v as DocumentType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="New template" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSaveDraft} disabled={isSaving}>Save Draft</Button>
          <Button variant="accent" onClick={handlePublish} disabled={isSaving}>Publish</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Card className="xl:col-span-1 h-full">
          <CardHeader>
            <CardTitle>Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScrollArea className="h-[480px] pr-2">
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => selectTemplate(tpl.id)}
                    className={cn(
                      "w-full rounded-md border px-3 py-3 text-left hover:border-primary transition",
                      state.id === tpl.id ? "border-primary bg-primary/5" : "border-muted"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{tpl.name}</span>
                      <Badge variant={tpl.status === "published" ? "default" : "secondary"}>{tpl.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{tpl.documentType}</div>
                  </button>
                ))}
                {isLoading && <p className="text-xs text-muted-foreground">Loading templates…</p>}
                {!isLoading && templates.length === 0 && (
                  <p className="text-xs text-muted-foreground">No templates yet. Create one to start.</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 h-full">
          <CardHeader className="flex flex-row items-start gap-4">
            <div className="w-full space-y-2">
              <div className="flex gap-2 items-center">
                <Input
                  value={state.name}
                  onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Template name"
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
                  <SelectTrigger className="w-[190px]">
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
              </div>
              <Textarea
                value={state.description}
                onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description"
                rows={2}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <h3 className="text-sm font-semibold mb-2">Components</h3>
                <div className="grid grid-cols-2 gap-2">
                  {PALETTE.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => handleAddComponent(item.type)}
                      className="text-left rounded-md border px-3 py-2 hover:border-primary transition"
                    >
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </button>
                  ))}
                </div>
                <Separator className="my-4" />
                <h3 className="text-sm font-semibold mb-2">Bindings</h3>
                <ScrollArea className="h-[220px] pr-2">
                  <div className="space-y-1">
                    {DOCUMENT_FIELDS[state.documentType].map((f) => (
                      <div key={f.path} className="rounded-md border px-2 py-1 text-xs">
                        <div className="font-medium">{f.label}</div>
                        <div className="text-muted-foreground">{f.path}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="col-span-4">
                <h3 className="text-sm font-semibold mb-2">Layout</h3>
                <div className="space-y-2">
                  {state.layout.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleReorder(c.id)}
                      onClick={() => setActiveComponentId(c.id)}
                      className={cn(
                        "rounded-md border px-3 py-2 cursor-move",
                        activeComponentId === c.id ? "border-primary bg-primary/5" : "border-muted"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium capitalize">{c.type}</div>
                          <div className="text-xs text-muted-foreground">{renderComponentSummary(c)}</div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleRemoveComponent(c.id); }}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  {state.layout.length === 0 && (
                    <div className="text-xs text-muted-foreground border rounded-md px-3 py-2">
                      No components yet. Add from the palette.
                    </div>
                  )}
                </div>
              </div>

              <div className="col-span-4">
                <h3 className="text-sm font-semibold mb-2">Properties</h3>
                {!activeComponent && <p className="text-xs text-muted-foreground">Select a component to edit.</p>}
                {activeComponent && (
                  <div className="space-y-3">
                    {(activeComponent.type === "heading" || activeComponent.type === "text") && (
                      <>
                        <Label>Text</Label>
                        <Textarea
                          rows={3}
                          value={activeComponent.text ?? ""}
                          onChange={(e) => handleComponentChange({ text: e.target.value })}
                        />
                        {activeComponent.type === "heading" && (
                          <>
                            <Label>Level</Label>
                            <Input
                              type="number"
                              value={activeComponent.level ?? 2}
                              onChange={(e) => handleComponentChange({ level: Number(e.target.value) as any })}
                            />
                          </>
                        )}
                      </>
                    )}
                    {activeComponent.type === "list" && (
                      <div className="space-y-2">
                        <Label>Items</Label>
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
                            />
                            <Input
                              placeholder="Binding (e.g. totals.total)"
                              value={item.binding ?? ""}
                              onChange={(e) => {
                                const items = [...(activeComponent.items ?? [])];
                                items[idx] = { ...items[idx], binding: e.target.value };
                                handleComponentChange({ items });
                              }}
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleComponentChange({ items: [...(activeComponent.items ?? []), { label: "Label", binding: "" }] })}
                        >
                          Add item
                        </Button>
                      </div>
                    )}
                    {activeComponent.type === "chips" && (
                      <div className="space-y-2">
                        <Label>Chips</Label>
                        {(activeComponent.items ?? []).map((item, idx) => (
                          <div key={idx} className="flex gap-2">
                            <Input
                              value={item.label}
                              onChange={(e) => {
                                const items = [...(activeComponent.items ?? [])];
                                items[idx] = { ...items[idx], label: e.target.value };
                                handleComponentChange({ items });
                              }}
                            />
                            <Input
                              value={item.color ?? ""}
                              placeholder="#e2e8f0"
                              onChange={(e) => {
                                const items = [...(activeComponent.items ?? [])];
                                items[idx] = { ...items[idx], color: e.target.value };
                                handleComponentChange({ items });
                              }}
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleComponentChange({ items: [...(activeComponent.items ?? []), { label: "Tag", color: "#e2e8f0" }] })}
                        >
                          Add chip
                        </Button>
                      </div>
                    )}
                    {activeComponent.type === "table" && (
                      <div className="space-y-2">
                        <Label>Rows binding</Label>
                        <Input
                          value={activeComponent.rowsBinding ?? ""}
                          onChange={(e) => handleComponentChange({ rowsBinding: e.target.value })}
                        />
                        <Label>Columns</Label>
                        {(activeComponent.columns ?? []).map((col, idx) => (
                          <div key={col.key} className="space-y-1 rounded-md border p-2">
                            <Input
                              value={col.label}
                              onChange={(e) => {
                                const columns = [...(activeComponent.columns ?? [])];
                                columns[idx] = { ...columns[idx], label: e.target.value };
                                handleComponentChange({ columns });
                              }}
                            />
                            <Input
                              value={col.binding ?? ""}
                              placeholder="Binding (e.g. description)"
                              onChange={(e) => {
                                const columns = [...(activeComponent.columns ?? [])];
                                columns[idx] = { ...columns[idx], binding: e.target.value };
                                handleComponentChange({ columns });
                              }}
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          size="sm"
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
                    {activeComponent.type === "spacer" && (
                      <>
                        <Label>Height (px)</Label>
                        <Input
                          type="number"
                          value={activeComponent.size ?? 12}
                          onChange={(e) => handleComponentChange({ size: Number(e.target.value) })}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1 h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Preview & Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" onClick={handlePreview} disabled={isPreviewing}>
                {isPreviewing ? "Generating…" : "Preview"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
                PDF
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Send test email</Label>
              <Input
                type="email"
                placeholder="recipient@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
              <Button size="sm" variant="secondary" onClick={handleSendEmail}>
                Send test
              </Button>
            </div>
            <Separator />
            <div className="h-[320px] rounded-md border overflow-hidden bg-white">
              {previewHtml ? (
                <iframe title="preview" className="w-full h-full" srcDoc={previewHtml} />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground px-4 text-center">
                  Generate a preview to see the rendered document.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

