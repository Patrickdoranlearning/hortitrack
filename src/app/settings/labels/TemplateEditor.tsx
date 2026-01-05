"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescriptionHidden,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Save,
  Type,
  Barcode,
  Square,
  Trash2,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  GripVertical,
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
  layout?: TemplateLayout;
  created_at?: string;
};

type FieldType = "text" | "barcode" | "static_text" | "line";

type TemplateField = {
  id: string;
  type: FieldType;
  binding?: string; // e.g., "productTitle", "size", "priceText", "barcode"
  staticText?: string; // for static_text type
  x: number; // position in mm
  y: number;
  width: number; // in mm
  height: number;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  align?: "left" | "center" | "right";
  barcodeType?: "code128" | "datamatrix" | "qr";
};

type TemplateLayout = {
  fields: TemplateField[];
  // Legacy fields for backward compatibility
  showSize?: boolean;
  showLot?: boolean;
  showFooter?: boolean;
  barcodeHeight?: number;
  titleFontSize?: number;
  priceFontSize?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean, saved?: boolean) => void;
  template: LabelTemplate | null;
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
  { label: "Small Square (40×40mm)", width: 40, height: 40 },
  { label: "Standard (70×50mm)", width: 70, height: 50 },
  { label: "Wide (100×50mm)", width: 100, height: 50 },
  { label: "Tall (50×70mm)", width: 50, height: 70 },
  { label: "Custom", width: 0, height: 0 },
];

const SCALE = 3; // pixels per mm for canvas

export default function TemplateEditor({ open, onOpenChange, template }: Props) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("design");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [labelType, setLabelType] = useState("sale");
  const [widthMm, setWidthMm] = useState(70);
  const [heightMm, setHeightMm] = useState(50);
  const [marginMm, setMarginMm] = useState(3);
  const [dpi, setDpi] = useState(203);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // Drag state
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Initialize form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setLabelType(template.label_type);
      setWidthMm(template.width_mm);
      setHeightMm(template.height_mm);
      setMarginMm(template.margin_mm);
      setDpi(template.dpi);
      setFields(template.layout?.fields || getDefaultFields(template.label_type, template.width_mm, template.height_mm));
    } else {
      // New template defaults
      setName("");
      setDescription("");
      setLabelType("sale");
      setWidthMm(70);
      setHeightMm(50);
      setMarginMm(3);
      setDpi(203);
      setFields(getDefaultFields("sale", 70, 50));
    }
    setSelectedFieldId(null);
  }, [template, open]);

  const getDefaultFields = (type: string, width: number, height: number): TemplateField[] => {
    const isCompact = width <= 45 && height <= 45;
    
    if (type === "sale") {
      if (isCompact) {
        return [
          { id: "f1", type: "barcode", binding: "barcode", x: 2, y: 2, width: width - 4, height: 12, barcodeType: "code128", align: "center" },
          { id: "f2", type: "text", binding: "productTitle", x: 2, y: 16, width: width - 4, height: 10, fontSize: 10, align: "center" },
          { id: "f3", type: "text", binding: "priceText", x: 2, y: 28, width: width - 4, height: 10, fontSize: 14, fontWeight: "bold", align: "center" },
        ];
      }
      return [
        { id: "f1", type: "text", binding: "productTitle", x: 3, y: 3, width: width - 6, height: 10, fontSize: 12, fontWeight: "bold" },
        { id: "f2", type: "text", binding: "size", x: 3, y: 14, width: width - 6, height: 6, fontSize: 9 },
        { id: "f3", type: "text", binding: "priceText", x: 3, y: 22, width: width - 6, height: 10, fontSize: 14, fontWeight: "bold" },
        { id: "f4", type: "barcode", binding: "barcode", x: 3, y: 34, width: width - 6, height: 12, barcodeType: "code128" },
      ];
    }
    
    if (type === "batch") {
      return [
        { id: "f1", type: "barcode", binding: "barcode", x: 3, y: 3, width: 20, height: 20, barcodeType: "datamatrix" },
        { id: "f2", type: "text", binding: "batchNumber", x: 26, y: 3, width: width - 29, height: 12, fontSize: 18, fontWeight: "bold" },
        { id: "f3", type: "text", binding: "variety", x: 26, y: 18, width: width - 29, height: 10, fontSize: 12 },
        { id: "f4", type: "text", binding: "size", x: 3, y: 26, width: 20, height: 6, fontSize: 8 },
        { id: "f5", type: "text", binding: "quantity", x: 3, y: 33, width: 20, height: 6, fontSize: 8 },
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

      const url = template 
        ? `/api/label-templates/${template.id}` 
        : "/api/label-templates";
      const method = template ? "PUT" : "POST";

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
        title: template ? "Template Updated" : "Template Created",
        description: `"${name}" has been saved`,
      });
      onOpenChange(false, true);
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
      width: type === "barcode" ? widthMm - marginMm * 2 : 30,
      height: type === "barcode" ? 15 : 8,
      fontSize: type === "text" ? 10 : undefined,
      align: "left",
      binding: type === "text" ? "productTitle" : type === "barcode" ? "barcode" : undefined,
      staticText: type === "static_text" ? "Static Text" : undefined,
      barcodeType: type === "barcode" ? "code128" : undefined,
    };
    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  const updateField = (fieldId: string, updates: Partial<TemplateField>) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const deleteField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  const selectedField = fields.find(f => f.id === selectedFieldId);

  // Handle mouse down on field for dragging
  const handleFieldMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const field = fields.find(f => f.id === fieldId);
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

  // Handle mouse move for dragging
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingFieldId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / SCALE;
    const mouseY = (e.clientY - rect.top) / SCALE;

    let newX = Math.max(0, Math.min(mouseX - dragOffset.x, widthMm - 10));
    let newY = Math.max(0, Math.min(mouseY - dragOffset.y, heightMm - 5));

    // Snap to grid (1mm)
    newX = Math.round(newX);
    newY = Math.round(newY);

    updateField(draggingFieldId, { x: newX, y: newY });
  }, [draggingFieldId, dragOffset, widthMm, heightMm]);

  // Handle mouse up to stop dragging
  const handleCanvasMouseUp = () => {
    setDraggingFieldId(null);
  };

  const handlePresetSize = (preset: typeof PRESET_SIZES[0]) => {
    if (preset.width > 0) {
      setWidthMm(preset.width);
      setHeightMm(preset.height);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Template" : "Create New Template"}
          </DialogTitle>
          <DialogDescriptionHidden>
            Design your label template with the visual editor
          </DialogDescriptionHidden>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="design" className="flex-1 min-h-0 mt-4 overflow-hidden">
            <div className="flex gap-4 h-full">
              {/* Toolbox */}
              <div className="w-48 flex-shrink-0 space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Add Elements</h4>
                  <div className="space-y-1">
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
                  </div>
                </div>

                <Separator />

                {/* Field List */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Fields</h4>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {fields.map((field, idx) => (
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
                          {field.type === "static_text" && (field.staticText || "Static")}
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
                </div>
              </div>

              {/* Canvas */}
              <div className="flex-1 bg-muted/30 rounded-lg p-4 flex items-center justify-center overflow-auto">
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
                  {/* Grid lines */}
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
                        backgroundColor: field.type === "barcode" ? "#f5f5f5" : "transparent",
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
                          fontSize: `${(field.fontSize || 10) * 0.8}px`,
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
                          <div className="text-[8px] text-muted-foreground flex items-center gap-1">
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

              {/* Properties Panel */}
              <div className="w-56 flex-shrink-0 space-y-4">
                <h4 className="text-sm font-medium">Properties</h4>
                {selectedField ? (
                  <div className="space-y-3">
                    {/* Position */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">X (mm)</Label>
                        <Input
                          type="number"
                          value={selectedField.x}
                          onChange={(e) =>
                            updateField(selectedField.id, { x: parseFloat(e.target.value) || 0 })
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
                            updateField(selectedField.id, { y: parseFloat(e.target.value) || 0 })
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
                            updateField(selectedField.id, { width: parseFloat(e.target.value) || 10 })
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
                            updateField(selectedField.id, { height: parseFloat(e.target.value) || 5 })
                          }
                          className="h-8"
                        />
                      </div>
                    </div>

                    {/* Text-specific properties */}
                    {(selectedField.type === "text" || selectedField.type === "static_text") && (
                      <>
                        <div>
                          <Label className="text-xs">Font Size</Label>
                          <Input
                            type="number"
                            value={selectedField.fontSize || 10}
                            onChange={(e) =>
                              updateField(selectedField.id, { fontSize: parseInt(e.target.value) || 10 })
                            }
                            className="h-8"
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Alignment</Label>
                          <div className="flex gap-1 mt-1">
                            <Button
                              variant={selectedField.align === "left" ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateField(selectedField.id, { align: "left" })}
                            >
                              <AlignLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={selectedField.align === "center" ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateField(selectedField.id, { align: "center" })}
                            >
                              <AlignCenter className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={selectedField.align === "right" ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateField(selectedField.id, { align: "right" })}
                            >
                              <AlignRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={selectedField.fontWeight === "bold" ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateField(selectedField.id, {
                                  fontWeight: selectedField.fontWeight === "bold" ? "normal" : "bold",
                                })
                              }
                            >
                              <Bold className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Binding for text fields */}
                    {selectedField.type === "text" && (
                      <div>
                        <Label className="text-xs">Data Binding</Label>
                        <Select
                          value={selectedField.binding || ""}
                          onValueChange={(v) => updateField(selectedField.id, { binding: v })}
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
                            updateField(selectedField.id, { staticText: e.target.value })
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
                          value={selectedField.barcodeType || "code128"}
                          onValueChange={(v) =>
                            updateField(selectedField.id, { barcodeType: v as any })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="code128">Code 128</SelectItem>
                            <SelectItem value="datamatrix">Data Matrix</SelectItem>
                            <SelectItem value="qr">QR Code</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive"
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
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 min-h-0 mt-4 overflow-y-auto">
            <div className="grid gap-6 max-w-xl">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Template Info</h4>
                <div className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Standard Price Label"
                    />
                  </div>
                  <div>
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
                        <SelectItem value="sale">Sale/Price Label</SelectItem>
                        <SelectItem value="batch">Batch Label</SelectItem>
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
                <div className="space-y-3">
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
                  <div className="grid grid-cols-3 gap-3">
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
                        onChange={(e) => setHeightMm(parseInt(e.target.value) || 40)}
                      />
                    </div>
                    <div>
                      <Label>Margin (mm)</Label>
                      <Input
                        type="number"
                        value={marginMm}
                        onChange={(e) => setMarginMm(parseInt(e.target.value) || 2)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Printer DPI</Label>
                    <Select value={String(dpi)} onValueChange={(v) => setDpi(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="203">203 DPI (Standard)</SelectItem>
                        <SelectItem value="300">300 DPI (High)</SelectItem>
                        <SelectItem value="600">600 DPI (Ultra High)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}





