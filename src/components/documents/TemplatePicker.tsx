"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Receipt,
  Truck,
  ClipboardCheck,
  FileText,
  Check,
  Loader2,
} from "lucide-react";

// Document types
type DocumentType = "invoice" | "delivery_docket" | "credit_note" | "order_confirmation";

type TemplateStyle = {
  id: string;
  name: string;
  description: string;
  preview: React.ReactNode;
};

type DocumentTypeConfig = {
  id: DocumentType;
  label: string;
  icon: React.ReactNode;
  styles: TemplateStyle[];
};

// Simple preview components for each style
function ClassicPreview({ type }: { type: string }) {
  return (
    <div className="w-full h-full bg-white p-3 text-[8px] leading-tight">
      <div className="flex justify-between items-start mb-3">
        <div className="w-8 h-8 bg-slate-200 rounded flex items-center justify-center text-[6px] text-slate-500">
          LOGO
        </div>
        <div className="text-right">
          <div className="font-bold text-[10px] uppercase">{type}</div>
          <div className="text-slate-500">#INV-001</div>
        </div>
      </div>
      <div className="border-t border-slate-200 pt-2 mb-2">
        <div className="font-semibold mb-1">Bill To:</div>
        <div className="text-slate-600">Customer Name</div>
        <div className="text-slate-600">123 Address St</div>
      </div>
      <div className="border border-slate-200 rounded mt-2">
        <div className="bg-slate-100 px-2 py-1 font-semibold flex">
          <span className="flex-1">Item</span>
          <span className="w-8 text-right">Qty</span>
          <span className="w-12 text-right">Total</span>
        </div>
        <div className="px-2 py-1 flex border-t border-slate-100">
          <span className="flex-1 text-slate-600">Plant item</span>
          <span className="w-8 text-right">10</span>
          <span className="w-12 text-right">€50</span>
        </div>
      </div>
      <div className="mt-2 text-right">
        <span className="font-bold">Total: €50.00</span>
      </div>
    </div>
  );
}

function ModernPreview({ type }: { type: string }) {
  return (
    <div className="w-full h-full bg-white p-3 text-[8px] leading-tight">
      <div className="bg-emerald-600 -m-3 mb-3 p-3 text-white">
        <div className="flex justify-between items-center">
          <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center text-[6px]">
            LOGO
          </div>
          <div className="text-right">
            <div className="font-bold text-[11px] uppercase">{type}</div>
            <div className="text-emerald-100 text-[7px]">#INV-001</div>
          </div>
        </div>
      </div>
      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <div className="text-[6px] uppercase text-slate-400 mb-0.5">From</div>
          <div className="font-medium">Your Company</div>
        </div>
        <div className="flex-1">
          <div className="text-[6px] uppercase text-slate-400 mb-0.5">To</div>
          <div className="font-medium">Customer</div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between py-1 border-b border-slate-100">
          <span>Plant item</span>
          <span className="font-medium">€50.00</span>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t-2 border-emerald-600 flex justify-between">
        <span className="font-bold">Total</span>
        <span className="font-bold text-emerald-600">€50.00</span>
      </div>
    </div>
  );
}

function MinimalPreview({ type }: { type: string }) {
  return (
    <div className="w-full h-full bg-white p-3 text-[8px] leading-tight">
      <div className="text-center mb-4">
        <div className="w-6 h-6 bg-slate-100 rounded mx-auto mb-1 flex items-center justify-center text-[5px] text-slate-400">
          LOGO
        </div>
        <div className="font-light text-[11px] uppercase tracking-widest text-slate-700">{type}</div>
        <div className="text-slate-400 text-[7px]">#INV-001 · 04 Feb 2024</div>
      </div>
      <div className="text-center text-slate-600 mb-3">
        <div>Customer Name</div>
      </div>
      <div className="border-t border-b border-slate-100 py-2 my-2">
        <div className="flex justify-between">
          <span className="text-slate-500">Plant item × 10</span>
          <span>€50.00</span>
        </div>
      </div>
      <div className="text-center mt-3">
        <div className="text-[6px] uppercase text-slate-400">Total Due</div>
        <div className="text-[12px] font-light">€50.00</div>
      </div>
    </div>
  );
}

// Document type configurations
const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  {
    id: "invoice",
    label: "Invoice",
    icon: <Receipt className="h-5 w-5" />,
    styles: [
      {
        id: "classic",
        name: "Classic",
        description: "Traditional business layout",
        preview: <ClassicPreview type="Invoice" />,
      },
      {
        id: "modern",
        name: "Modern",
        description: "Clean with color accents",
        preview: <ModernPreview type="Invoice" />,
      },
      {
        id: "minimal",
        name: "Minimal",
        description: "Simple and elegant",
        preview: <MinimalPreview type="Invoice" />,
      },
    ],
  },
  {
    id: "delivery_docket",
    label: "Delivery Docket",
    icon: <Truck className="h-5 w-5" />,
    styles: [
      {
        id: "classic",
        name: "Classic",
        description: "Traditional business layout",
        preview: <ClassicPreview type="Delivery Docket" />,
      },
      {
        id: "modern",
        name: "Modern",
        description: "Clean with color accents",
        preview: <ModernPreview type="Delivery Docket" />,
      },
      {
        id: "minimal",
        name: "Minimal",
        description: "Simple and elegant",
        preview: <MinimalPreview type="Delivery Docket" />,
      },
    ],
  },
  {
    id: "credit_note",
    label: "Credit Note",
    icon: <FileText className="h-5 w-5" />,
    styles: [
      {
        id: "classic",
        name: "Classic",
        description: "Traditional business layout",
        preview: <ClassicPreview type="Credit Note" />,
      },
      {
        id: "modern",
        name: "Modern",
        description: "Clean with color accents",
        preview: <ModernPreview type="Credit Note" />,
      },
      {
        id: "minimal",
        name: "Minimal",
        description: "Simple and elegant",
        preview: <MinimalPreview type="Credit Note" />,
      },
    ],
  },
  {
    id: "order_confirmation",
    label: "Order Confirmation",
    icon: <ClipboardCheck className="h-5 w-5" />,
    styles: [
      {
        id: "classic",
        name: "Classic",
        description: "Traditional business layout",
        preview: <ClassicPreview type="Order Confirmation" />,
      },
      {
        id: "modern",
        name: "Modern",
        description: "Clean with color accents",
        preview: <ModernPreview type="Order Confirmation" />,
      },
      {
        id: "minimal",
        name: "Minimal",
        description: "Simple and elegant",
        preview: <MinimalPreview type="Order Confirmation" />,
      },
    ],
  },
];

type ActiveTemplate = {
  documentType: DocumentType;
  styleId: string;
};

type Props = {
  initialSelections?: Record<DocumentType, string>;
  onSave?: (selections: Record<DocumentType, string>) => Promise<void>;
};

export function TemplatePicker({ initialSelections, onSave }: Props) {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<DocumentType>("invoice");
  const [selections, setSelections] = useState<Record<DocumentType, string>>(
    initialSelections || {
      invoice: "classic",
      delivery_docket: "classic",
      credit_note: "classic",
      order_confirmation: "classic",
    }
  );
  const [saving, setSaving] = useState(false);

  const currentDocType = DOCUMENT_TYPES.find((d) => d.id === selectedType)!;

  const handleSelectStyle = (styleId: string) => {
    setSelections((prev) => ({
      ...prev,
      [selectedType]: styleId,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (onSave) {
        await onSave(selections);
      } else {
        // Default: save to API
        const res = await fetch("/api/documents/template-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selections }),
        });
        if (!res.ok) throw new Error("Failed to save");
      }
      toast({
        title: "Templates saved",
        description: "Your document templates have been updated.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Could not save template preferences.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Document Templates</h1>
        <p className="text-muted-foreground">
          Choose a style for each document type. Your logo and company details will be added automatically.
        </p>
      </div>

      {/* Document Type Tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {DOCUMENT_TYPES.map((docType) => (
          <button
            key={docType.id}
            onClick={() => setSelectedType(docType.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
              selectedType === docType.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-border"
            )}
          >
            {docType.icon}
            <span className="font-medium">{docType.label}</span>
            {selections[docType.id] && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {selections[docType.id]}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Template Styles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {currentDocType.styles.map((style) => {
          const isSelected = selections[selectedType] === style.id;
          return (
            <Card
              key={style.id}
              className={cn(
                "cursor-pointer transition-all overflow-hidden",
                isSelected
                  ? "ring-2 ring-primary shadow-lg"
                  : "hover:shadow-md hover:border-primary/50"
              )}
              onClick={() => handleSelectStyle(style.id)}
            >
              {/* Preview */}
              <div className="aspect-[210/297] bg-slate-100 border-b relative">
                {style.preview}
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">{style.name}</h3>
                  {isSelected && (
                    <Badge>Selected</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{style.description}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Templates"
          )}
        </Button>
      </div>
    </div>
  );
}
