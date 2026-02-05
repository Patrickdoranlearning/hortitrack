"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HelpCircle,
  Users,
  List,
  Table,
  Calculator,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import type { DocumentType } from "@/lib/documents/types";
import type { FormContentState, FormListItem, FormTableColumn } from "../utils/layoutTransform";

type FormEditorContentProps = {
  state: FormContentState;
  documentType: DocumentType;
  onChange: (state: FormContentState) => void;
};

export function FormEditorContent({ state, documentType, onChange }: FormEditorContentProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    recipient: true,
    metadata: true,
    table: true,
    totals: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const update = <K extends keyof FormContentState>(
    key: K,
    value: FormContentState[K]
  ) => {
    onChange({ ...state, [key]: value });
  };

  // Field list helpers
  const addField = (listKey: "recipientFields" | "metadataFields" | "totalsFields") => {
    const newField: FormListItem = {
      id: nanoid(6),
      label: "New Field",
      binding: "",
      visible: true,
    };
    update(listKey, [...state[listKey], newField]);
  };

  const updateField = (
    listKey: "recipientFields" | "metadataFields" | "totalsFields",
    id: string,
    patch: Partial<FormListItem>
  ) => {
    update(
      listKey,
      state[listKey].map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  };

  const removeField = (listKey: "recipientFields" | "metadataFields" | "totalsFields", id: string) => {
    update(listKey, state[listKey].filter((f) => f.id !== id));
  };

  // Column helpers
  const addColumn = () => {
    const newColumn: FormTableColumn = {
      id: nanoid(6),
      label: "New Column",
      binding: "",
      align: "left",
      format: "text",
      visible: true,
    };
    update("tableColumns", [...state.tableColumns, newColumn]);
  };

  const updateColumn = (id: string, patch: Partial<FormTableColumn>) => {
    update(
      "tableColumns",
      state.tableColumns.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const removeColumn = (id: string) => {
    update("tableColumns", state.tableColumns.filter((c) => c.id !== id));
  };

  const recipientLabel = documentType === "delivery_docket" ? "Delivery Details" : "Customer Details";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <List className="h-4 w-4" />
          Content Sections
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs">
                  Configure what data appears in your document. Toggle sections
                  on/off and customize the fields shown.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recipient/Customer Section */}
        <Collapsible open={expandedSections.recipient}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger
              onClick={() => toggleSection("recipient")}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              {expandedSections.recipient ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Users className="h-4 w-4" />
              {recipientLabel}
            </CollapsibleTrigger>
            <Switch
              checked={state.showRecipientBox}
              onCheckedChange={(checked) => update("showRecipientBox", checked)}
            />
          </div>
          <CollapsibleContent className="pt-3 space-y-2">
            {state.showRecipientBox && (
              <>
                <FieldList
                  fields={state.recipientFields}
                  onUpdate={(id, patch) => updateField("recipientFields", id, patch)}
                  onRemove={(id) => removeField("recipientFields", id)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addField("recipientFields")}
                  className="w-full h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Field
                </Button>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Metadata Section (order/invoice details) */}
        <Collapsible open={expandedSections.metadata}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger
              onClick={() => toggleSection("metadata")}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              {expandedSections.metadata ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <List className="h-4 w-4" />
              Document Details
            </CollapsibleTrigger>
            <Switch
              checked={state.showMetadata}
              onCheckedChange={(checked) => update("showMetadata", checked)}
            />
          </div>
          <CollapsibleContent className="pt-3 space-y-2">
            {state.showMetadata && (
              <>
                <FieldList
                  fields={state.metadataFields}
                  onUpdate={(id, patch) => updateField("metadataFields", id, patch)}
                  onRemove={(id) => removeField("metadataFields", id)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addField("metadataFields")}
                  className="w-full h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Field
                </Button>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Table Section */}
        <Collapsible open={expandedSections.table}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger
              onClick={() => toggleSection("table")}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              {expandedSections.table ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Table className="h-4 w-4" />
              Items Table
            </CollapsibleTrigger>
            <Switch
              checked={state.showTable}
              onCheckedChange={(checked) => update("showTable", checked)}
            />
          </div>
          <CollapsibleContent className="pt-3 space-y-3">
            {state.showTable && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                    Data source:
                  </Label>
                  <Input
                    value={state.tableRowsBinding}
                    onChange={(e) => update("tableRowsBinding", e.target.value)}
                    placeholder="e.g., lines or items"
                    className="h-7 text-xs flex-1"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show column headers</Label>
                  <Switch
                    checked={state.showTableHeader}
                    onCheckedChange={(checked) => update("showTableHeader", checked)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Columns</Label>
                  {state.tableColumns.map((col) => (
                    <ColumnEditor
                      key={col.id}
                      column={col}
                      onUpdate={(patch) => updateColumn(col.id, patch)}
                      onRemove={() => removeColumn(col.id)}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addColumn}
                    className="w-full h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Column
                  </Button>
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Totals Section (only for invoices/orders) */}
        {(documentType === "invoice" || documentType === "order_confirmation") && (
          <Collapsible open={expandedSections.totals}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger
                onClick={() => toggleSection("totals")}
                className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {expandedSections.totals ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Calculator className="h-4 w-4" />
                Totals
              </CollapsibleTrigger>
              <Switch
                checked={state.showTotals}
                onCheckedChange={(checked) => update("showTotals", checked)}
              />
            </div>
            <CollapsibleContent className="pt-3 space-y-2">
              {state.showTotals && (
                <>
                  <FieldList
                    fields={state.totalsFields}
                    onUpdate={(id, patch) => updateField("totalsFields", id, patch)}
                    onRemove={(id) => removeField("totalsFields", id)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addField("totalsFields")}
                    className="w-full h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Total Line
                  </Button>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

// Field list component for metadata, recipient, totals
type FieldListProps = {
  fields: FormListItem[];
  onUpdate: (id: string, patch: Partial<FormListItem>) => void;
  onRemove: (id: string) => void;
};

function FieldList({ fields, onUpdate, onRemove }: FieldListProps) {
  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div
          key={field.id}
          className="flex items-center gap-2 rounded-md border bg-background p-2"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <Input
            value={field.label}
            onChange={(e) => onUpdate(field.id, { label: e.target.value })}
            placeholder="Label"
            className="h-6 text-xs flex-1"
          />
          <Input
            value={field.binding}
            onChange={(e) => onUpdate(field.id, { binding: e.target.value })}
            placeholder="data.field"
            className="h-6 text-xs flex-1 font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onUpdate(field.id, { visible: !field.visible })}
            className="h-6 w-6 p-0"
          >
            {field.visible ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(field.id)}
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No fields configured. Add one to get started.
        </p>
      )}
    </div>
  );
}

// Column editor for table columns
type ColumnEditorProps = {
  column: FormTableColumn;
  onUpdate: (patch: Partial<FormTableColumn>) => void;
  onRemove: () => void;
};

function ColumnEditor({ column, onUpdate, onRemove }: ColumnEditorProps) {
  return (
    <div className="rounded-md border bg-background p-2 space-y-2">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <Input
          value={column.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Column label"
          className="h-6 text-xs flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onUpdate({ visible: !column.visible })}
          className="h-6 w-6 p-0"
        >
          {column.visible ? (
            <Eye className="h-3 w-3" />
          ) : (
            <EyeOff className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-center gap-2 pl-6">
        <Input
          value={column.binding}
          onChange={(e) => onUpdate({ binding: e.target.value })}
          placeholder="data.field"
          className="h-6 text-xs flex-1 font-mono"
        />
        <Select
          value={column.align}
          onValueChange={(v) => onUpdate({ align: v as "left" | "center" | "right" })}
        >
          <SelectTrigger className="h-6 w-[70px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={column.format}
          onValueChange={(v) => onUpdate({ format: v as "text" | "currency" | "number" | "date" })}
        >
          <SelectTrigger className="h-6 w-[90px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="currency">Currency</SelectItem>
            <SelectItem value="date">Date</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
