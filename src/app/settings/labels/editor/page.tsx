"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PageFrame } from "@/ui/templates";
import LabelPreview from "@/components/LabelPreview";
import {
  Loader2,
  Save,
  ArrowLeft,
  Type,
  Barcode,
  Square,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  GripVertical,
  Eye,
  Settings2,
  Palette,
  Printer,
} from "lucide-react";
import Link from "next/link";

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
  layout?: TemplateLayout;
  created_at?: string;
};

type FieldType = "text" | "barcode" | "static_text" | "line";

type TemplateField = {
  id: string;
  type: FieldType;
  binding?: string;
  staticText?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  align?: "left" | "center" | "right";
  barcodeType?: "code128" | "datamatrix" | "qr";
};

type TemplateLayout = {
  fields: TemplateField[];
  showSize?: boolean;
  showLot?: boolean;
  showFooter?: boolean;
  barcodeHeight?: number;
  titleFontSize?: number;
  priceFontSize?: number;
};

const BINDING_OPTIONS = [
  { value: "productTitle", label: "Product Name" },
  { value: "size", label: "Size" },
  { value: "priceText", label: "Price" },
  { value: "barcode", label: "Barcode Data" },
  { value: "lotNumber", label: "Lot Number" },
  { value: "footerSmall", label: "Footer Text" },
  { value: "batchNumber", label: "Batch Number" },
  { value: "variety", label: "Variety" },
  { value: "family", label: "Family" },
  { value: "quantity", label: "Quantity" },
  { value: "location", label: "Location" },
];

const PRESET_SIZES = [
  { label: "Small Square (40x40mm)", width: 40, height: 40 },
  { label: "Standard (70x50mm)", width: 70, height: 50 },
  { label: "Wide (100x50mm)", width: 100, height: 50 },
  { label: "Tall (50x70mm)", width: 50, height: 70 },
  { label: "Custom", width: 0, height: 0 },
];

const SCALE = 4; // pixels per mm for canvas

export default function LabelTemplateEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("id");
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("design");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [labelType, setLabelType] = useState("batch");
  const [widthMm, setWidthMm] = useState(70);
  const [heightMm, setHeightMm] = useState(50);
  const [marginMm, setMarginMm] = useState(2);
  const [dpi, setDpi] = useState(300);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // Drag state
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Preview data
  const [previewData] = useState({
    batchNumber: "3-2603-00004",
    variety: "Kramer's Red",
    family: "Erica X Darleyensis",
    quantity: 200,
    size: "Tubitel 1",
    location: "GH-A1",
  });

  // Fetch template if editing
  useEffect(() => {
    if (templateId) {
      fetchTemplate();
    } else {
      setFields(getDefaultFields("batch", 70, 50));
    }
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/label-templates/${templateId}`);
      if (!res.ok) throw new Error("Template not found");
      const json = await res.json();
      const template = json.data;

      setName(template.name);
      setDescription(template.description || "");
      setLabelType(template.label_type);
      setWidthMm(template.width_mm);
      setHeightMm(template.height_mm);
      setMarginMm(template.margin_mm);
      setDpi(template.dpi);
      setFields(
        template.layout?.fields ||
          getDefaultFields(template.label_type, template.width_mm, template.height_mm)
      );
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load template",
      });
      router.push("/settings/labels");
    } finally {
      setLoading(false);
    }
  };

  const getDefaultFields = (
    type: string,
    width: number,
    height: number
  ): TemplateField[] => {
    if (type === "batch") {
      return [
        {
          id: "f1",
          type: "barcode",
          binding: "barcode",
          x: 2,
          y: 2,
          width: 18,
          height: 18,
          barcodeType: "datamatrix",
        },
        {
          id: "f2",
          type: "text",
          binding: "variety",
          x: 23,
          y: 3,
          width: width - 26,
          height: 8,
          fontSize: 7,
          fontWeight: "bold",
        },
        {
          id: "f3",
          type: "text",
          binding: "family",
          x: 23,
          y: 11,
          width: width - 26,
          height: 6,
          fontSize: 5,
        },
        {
          id: "f4",
          type: "text",
          binding: "size",
          x: 2,
          y: 22,
          width: 30,
          height: 5,
          fontSize: 5,
        },
        {
          id: "f5",
          type: "text",
          binding: "quantity",
          x: 35,
          y: 22,
          width: 30,
          height: 5,
          fontSize: 5,
        },
        {
          id: "f6",
          type: "text",
          binding: "batchNumber",
          x: 2,
          y: height - 11,
          width: width - 4,
          height: 9,
          fontSize: 9,
          fontWeight: "bold",
          align: "right",
        },
      ];
    }

    if (type === "sale") {
      return [
        {
          id: "f1",
          type: "text",
          binding: "productTitle",
          x: 3,
          y: 3,
          width: width - 6,
          height: 10,
          fontSize: 12,
          fontWeight: "bold",
        },
        {
          id: "f2",
          type: "text",
          binding: "size",
          x: 3,
          y: 14,
          width: width - 6,
          height: 6,
          fontSize: 9,
        },
        {
          id: "f3",
          type: "text",
          binding: "priceText",
          x: 3,
          y: 22,
          width: width - 6,
          height: 10,
          fontSize: 14,
          fontWeight: "bold",
        },
        {
          id: "f4",
          type: "barcode",
          binding: "barcode",
          x: 3,
          y: 34,
          width: width - 6,
          height: 12,
          barcodeType: "code128",
        },
      ];
    }

    return [];
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Template name is required",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        description,
        label_type: labelType,
        width_mm: widthMm,
        height_mm: heightMm,
        margin_mm: marginMm,
        dpi,
        layout: { fields },
      };

      const url = templateId
        ? `/api/label-templates/${templateId}`
        : "/api/label-templates";
      const method = templateId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || "Failed to save template");
      }

      toast({
        title: templateId ? "Template Updated" : "Template Created",
        description: `"${name}" has been saved`,
      });
      router.push("/settings/labels");
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const addField = (type: FieldType) => {
    const newField: TemplateField = {
      id: `f${Date.now()}`,
      type,
      x: marginMm,
      y: marginMm,
      width: type === "barcode" ? 18 : 30,
      height: type === "barcode" ? 18 : 8,
      fontSize: type === "text" ? 10 : undefined,
      align: "left",
      binding:
        type === "text" ? "variety" : type === "barcode" ? "barcode" : undefined,
      staticText: type === "static_text" ? "Static Text" : undefined,
      barcodeType: type === "barcode" ? "datamatrix" : undefined,
    };
    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  const updateField = (fieldId: string, updates: Partial<TemplateField>) => {
    setFields(fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)));
  };

  const deleteField = (fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  const handleFieldMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const field = fields.find((f) => f.id === fieldId);
    if (!field || !canvasRef.current) return;

    setSelectedFieldId(fieldId);
    setDraggingFieldId(fieldId);

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / SCALE;
    const mouseY = (e.clientY - rect.top) / SCALE;

    setDragOffset({
      x: mouseX - field.x,
      y: mouseY - field.y,
    });
  };

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingFieldId || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / SCALE;
      const mouseY = (e.clientY - rect.top) / SCALE;

      let newX = Math.max(0, Math.min(mouseX - dragOffset.x, widthMm - 10));
      let newY = Math.max(0, Math.min(mouseY - dragOffset.y, heightMm - 5));

      newX = Math.round(newX);
      newY = Math.round(newY);

      updateField(draggingFieldId, { x: newX, y: newY });
    },
    [draggingFieldId, dragOffset, widthMm, heightMm]
  );

  const handleCanvasMouseUp = () => {
    setDraggingFieldId(null);
  };

  const handlePresetSize = (preset: (typeof PRESET_SIZES)[0]) => {
    if (preset.width > 0) {
      setWidthMm(preset.width);
      setHeightMm(preset.height);
    }
  };

  if (loading) {
    return (
      <PageFrame moduleKey="settings">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame moduleKey="settings">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/settings/labels">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="font-headline text-2xl">
                {templateId ? "Edit Label Template" : "Create Label Template"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Design your label layout with the visual editor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/settings/labels">Cancel</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
          {/* Left: Editor */}
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="design" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Design
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="design" className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_240px] gap-4">
                  {/* Toolbox */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Add Elements</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => addField("text")}
                      >
                        <Type className="h-4 w-4 mr-2" />
                        Text Field
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => addField("barcode")}
                      >
                        <Barcode className="h-4 w-4 mr-2" />
                        Barcode
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => addField("static_text")}
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Static Text
                      </Button>

                      <Separator className="my-3" />

                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        Fields ({fields.length})
                      </h4>
                      <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {fields.map((field) => (
                          <div
                            key={field.id}
                            className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer ${
                              selectedFieldId === field.id
                                ? "bg-primary/10 border border-primary"
                                : "bg-muted hover:bg-muted/80"
                            }`}
                            onClick={() => setSelectedFieldId(field.id)}
                          >
                            <GripVertical className="h-3 w-3 text-muted-foreground" />
                            <span className="flex-1 truncate">
                              {field.type === "text" && (field.binding || "Text")}
                              {field.type === "barcode" && "Barcode"}
                              {field.type === "static_text" &&
                                (field.staticText || "Static")}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteField(field.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Canvas */}
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Canvas ({widthMm}x{heightMm}mm)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center overflow-auto min-h-[300px]">
                        <div
                          ref={canvasRef}
                          className="bg-white border-2 border-dashed border-muted-foreground/30 relative cursor-crosshair shadow-lg"
                          style={{
                            width: `${widthMm * SCALE}px`,
                            height: `${heightMm * SCALE}px`,
                          }}
                          onMouseMove={handleCanvasMouseMove}
                          onMouseUp={handleCanvasMouseUp}
                          onMouseLeave={handleCanvasMouseUp}
                          onClick={() => setSelectedFieldId(null)}
                        >
                          {/* Grid */}
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              backgroundImage: `
                                linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
                              `,
                              backgroundSize: `${SCALE * 5}px ${SCALE * 5}px`,
                            }}
                          />

                          {/* Margin indicator */}
                          <div
                            className="absolute border border-dashed border-blue-300 pointer-events-none"
                            style={{
                              left: `${marginMm * SCALE}px`,
                              top: `${marginMm * SCALE}px`,
                              right: `${marginMm * SCALE}px`,
                              bottom: `${marginMm * SCALE}px`,
                            }}
                          />

                          {/* Fields */}
                          {fields.map((field) => (
                            <div
                              key={field.id}
                              className={`absolute cursor-move border ${
                                selectedFieldId === field.id
                                  ? "border-primary ring-2 ring-primary/30"
                                  : "border-muted-foreground/30"
                              }`}
                              style={{
                                left: `${field.x * SCALE}px`,
                                top: `${field.y * SCALE}px`,
                                width: `${field.width * SCALE}px`,
                                height: `${field.height * SCALE}px`,
                                backgroundColor:
                                  field.type === "barcode" ? "#f5f5f5" : "transparent",
                              }}
                              onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFieldId(field.id);
                              }}
                            >
                              <div
                                className="w-full h-full flex items-center overflow-hidden px-1"
                                style={{
                                  fontSize: `${(field.fontSize || 10) * 0.9}px`,
                                  fontWeight: field.fontWeight || "normal",
                                  justifyContent:
                                    field.align === "center"
                                      ? "center"
                                      : field.align === "right"
                                      ? "flex-end"
                                      : "flex-start",
                                }}
                              >
                                {field.type === "barcode" && (
                                  <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                                    <Barcode className="h-3 w-3" />
                                    {field.barcodeType}
                                  </div>
                                )}
                                {field.type === "text" && (
                                  <span className="truncate text-muted-foreground">
                                    {`{${field.binding || "field"}}`}
                                  </span>
                                )}
                                {field.type === "static_text" && (
                                  <span className="truncate">{field.staticText}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Properties Panel */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Properties</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedField ? (
                        <div className="space-y-4">
                          {/* Position */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">X (mm)</Label>
                              <Input
                                type="number"
                                value={selectedField.x}
                                onChange={(e) =>
                                  updateField(selectedField.id, {
                                    x: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Y (mm)</Label>
                              <Input
                                type="number"
                                value={selectedField.y}
                                onChange={(e) =>
                                  updateField(selectedField.id, {
                                    y: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="h-8"
                              />
                            </div>
                          </div>

                          {/* Size */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Width (mm)</Label>
                              <Input
                                type="number"
                                value={selectedField.width}
                                onChange={(e) =>
                                  updateField(selectedField.id, {
                                    width: parseFloat(e.target.value) || 10,
                                  })
                                }
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Height (mm)</Label>
                              <Input
                                type="number"
                                value={selectedField.height}
                                onChange={(e) =>
                                  updateField(selectedField.id, {
                                    height: parseFloat(e.target.value) || 5,
                                  })
                                }
                                className="h-8"
                              />
                            </div>
                          </div>

                          {/* Text properties */}
                          {(selectedField.type === "text" ||
                            selectedField.type === "static_text") && (
                            <>
                              <div>
                                <Label className="text-xs">Font Size (mm)</Label>
                                <Input
                                  type="number"
                                  value={selectedField.fontSize || 10}
                                  onChange={(e) =>
                                    updateField(selectedField.id, {
                                      fontSize: parseInt(e.target.value) || 10,
                                    })
                                  }
                                  className="h-8"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Alignment</Label>
                                <div className="flex gap-1 mt-1">
                                  <Button
                                    variant={
                                      selectedField.align === "left"
                                        ? "default"
                                        : "outline"
                                    }
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      updateField(selectedField.id, { align: "left" })
                                    }
                                  >
                                    <AlignLeft className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant={
                                      selectedField.align === "center"
                                        ? "default"
                                        : "outline"
                                    }
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      updateField(selectedField.id, { align: "center" })
                                    }
                                  >
                                    <AlignCenter className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant={
                                      selectedField.align === "right"
                                        ? "default"
                                        : "outline"
                                    }
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      updateField(selectedField.id, { align: "right" })
                                    }
                                  >
                                    <AlignRight className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant={
                                      selectedField.fontWeight === "bold"
                                        ? "default"
                                        : "outline"
                                    }
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      updateField(selectedField.id, {
                                        fontWeight:
                                          selectedField.fontWeight === "bold"
                                            ? "normal"
                                            : "bold",
                                      })
                                    }
                                  >
                                    <Bold className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}

                          {/* Text binding */}
                          {selectedField.type === "text" && (
                            <div>
                              <Label className="text-xs">Data Binding</Label>
                              <Select
                                value={selectedField.binding || ""}
                                onValueChange={(v) =>
                                  updateField(selectedField.id, { binding: v })
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select field" />
                                </SelectTrigger>
                                <SelectContent>
                                  {BINDING_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Static text content */}
                          {selectedField.type === "static_text" && (
                            <div>
                              <Label className="text-xs">Text Content</Label>
                              <Input
                                value={selectedField.staticText || ""}
                                onChange={(e) =>
                                  updateField(selectedField.id, {
                                    staticText: e.target.value,
                                  })
                                }
                                className="h-8"
                              />
                            </div>
                          )}

                          {/* Barcode properties */}
                          {selectedField.type === "barcode" && (
                            <div>
                              <Label className="text-xs">Barcode Type</Label>
                              <Select
                                value={selectedField.barcodeType || "datamatrix"}
                                onValueChange={(v) =>
                                  updateField(selectedField.id, {
                                    barcodeType: v as any,
                                  })
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="datamatrix">Data Matrix</SelectItem>
                                  <SelectItem value="code128">Code 128</SelectItem>
                                  <SelectItem value="qr">QR Code</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-destructive hover:text-destructive mt-4"
                            onClick={() => deleteField(selectedField.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Field
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Select a field to edit its properties
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid gap-6 max-w-2xl">
                      {/* Basic Info */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium">Template Info</h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Label>Name</Label>
                            <Input
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="e.g., Standard Batch Label"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label>Description</Label>
                            <Textarea
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Optional description..."
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label>Label Type</Label>
                            <Select value={labelType} onValueChange={setLabelType}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="batch">Batch Label</SelectItem>
                                <SelectItem value="sale">Sale/Price Label</SelectItem>
                                <SelectItem value="location">Location Label</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Dimensions */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium">Dimensions</h4>
                        <div>
                          <Label>Preset Size</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {PRESET_SIZES.map((preset) => (
                              <Badge
                                key={preset.label}
                                variant={
                                  preset.width === widthMm && preset.height === heightMm
                                    ? "default"
                                    : "outline"
                                }
                                className="cursor-pointer"
                                onClick={() => handlePresetSize(preset)}
                              >
                                {preset.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <Label>Width (mm)</Label>
                            <Input
                              type="number"
                              value={widthMm}
                              onChange={(e) => setWidthMm(parseInt(e.target.value) || 40)}
                            />
                          </div>
                          <div>
                            <Label>Height (mm)</Label>
                            <Input
                              type="number"
                              value={heightMm}
                              onChange={(e) =>
                                setHeightMm(parseInt(e.target.value) || 40)
                              }
                            />
                          </div>
                          <div>
                            <Label>Margin (mm)</Label>
                            <Input
                              type="number"
                              value={marginMm}
                              onChange={(e) =>
                                setMarginMm(parseInt(e.target.value) || 2)
                              }
                            />
                          </div>
                          <div>
                            <Label>Printer DPI</Label>
                            <Select
                              value={String(dpi)}
                              onValueChange={(v) => setDpi(parseInt(v))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="203">203 DPI</SelectItem>
                                <SelectItem value="300">300 DPI</SelectItem>
                                <SelectItem value="600">600 DPI</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Live Preview */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <LabelPreview
                    batchNumber={previewData.batchNumber}
                    variety={previewData.variety}
                    family={previewData.family}
                    quantity={previewData.quantity}
                    size={previewData.size}
                    location={previewData.location}
                    dataMatrixPayload={`ht:batch:${previewData.batchNumber}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  This preview shows how your label will appear when printed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Preview Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Variety:</span>
                    <span>{previewData.variety}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Family:</span>
                    <span>{previewData.family}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size:</span>
                    <span>{previewData.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Qty:</span>
                    <span>{previewData.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Batch:</span>
                    <span>{previewData.batchNumber}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
