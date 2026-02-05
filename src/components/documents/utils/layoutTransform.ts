/**
 * Layout Transform Utilities
 *
 * Converts between DocumentComponent[] layout and FormState for the simplified editor.
 * One-directional initially: form writes to layout, not reverse.
 */

import type { DocumentComponent, DocumentType, DocumentZone, TableColumn } from "@/lib/documents/types";
import { nanoid } from "nanoid";

// Form state types for simplified editing
export type FormFieldValue = string | number | boolean | null;

export type FormListItem = {
  id: string;
  label: string;
  binding: string;
  visible: boolean;
};

export type FormTableColumn = {
  id: string;
  label: string;
  binding: string;
  align: "left" | "center" | "right";
  format: "text" | "currency" | "number" | "date";
  visible: boolean;
};

export type FormHeaderState = {
  showLogo: boolean;
  logoUrl: string;
  title: string;
  titleBinding: string;
  subtitle: string;
  subtitleBinding: string;
  showDivider: boolean;
};

export type FormContentState = {
  // Customer/Recipient section
  showRecipientBox: boolean;
  recipientFields: FormListItem[];

  // Metadata section (order number, date, etc.)
  showMetadata: boolean;
  metadataFields: FormListItem[];

  // Table section
  showTable: boolean;
  tableRowsBinding: string;
  tableColumns: FormTableColumn[];
  showTableHeader: boolean;

  // Totals section
  showTotals: boolean;
  totalsFields: FormListItem[];
};

export type FormFooterState = {
  showNotes: boolean;
  notesText: string;
  notesBinding: string;

  showTerms: boolean;
  termsText: string;

  showPageNumber: boolean;
  pageNumberFormat: string;
};

export type FormState = {
  header: FormHeaderState;
  content: FormContentState;
  footer: FormFooterState;
};

/**
 * Default form state for a new document
 */
export function defaultFormState(documentType: DocumentType): FormState {
  const baseState: FormState = {
    header: {
      showLogo: false,
      logoUrl: "",
      title: "{{title}}",
      titleBinding: "title",
      subtitle: "{{subtitle}}",
      subtitleBinding: "subtitle",
      showDivider: true,
    },
    content: {
      showRecipientBox: true,
      recipientFields: [],
      showMetadata: true,
      metadataFields: [],
      showTable: true,
      tableRowsBinding: "lines",
      tableColumns: [],
      showTableHeader: true,
      showTotals: false,
      totalsFields: [],
    },
    footer: {
      showNotes: false,
      notesText: "",
      notesBinding: "notes",
      showTerms: false,
      termsText: "",
      showPageNumber: false,
      pageNumberFormat: "Page {{page}} of {{pages}}",
    },
  };

  // Customize based on document type
  switch (documentType) {
    case "invoice":
      baseState.content.recipientFields = [
        { id: nanoid(6), label: "Customer", binding: "customer.name", visible: true },
        { id: nanoid(6), label: "Address", binding: "customer.address", visible: true },
        { id: nanoid(6), label: "Email", binding: "customer.email", visible: true },
      ];
      baseState.content.metadataFields = [
        { id: nanoid(6), label: "Invoice #", binding: "invoice.number", visible: true },
        { id: nanoid(6), label: "Date", binding: "invoice.date", visible: true },
        { id: nanoid(6), label: "Due Date", binding: "invoice.dueDate", visible: true },
      ];
      baseState.content.tableColumns = [
        { id: nanoid(6), label: "Description", binding: "description", align: "left", format: "text", visible: true },
        { id: nanoid(6), label: "Qty", binding: "quantity", align: "right", format: "number", visible: true },
        { id: nanoid(6), label: "Unit Price", binding: "unitPrice", align: "right", format: "currency", visible: true },
        { id: nanoid(6), label: "Total", binding: "total", align: "right", format: "currency", visible: true },
      ];
      baseState.content.showTotals = true;
      baseState.content.totalsFields = [
        { id: nanoid(6), label: "Subtotal", binding: "totals.subtotal", visible: true },
        { id: nanoid(6), label: "Tax", binding: "totals.tax", visible: true },
        { id: nanoid(6), label: "Total", binding: "totals.grandTotal", visible: true },
      ];
      break;

    case "delivery_docket":
      baseState.content.recipientFields = [
        { id: nanoid(6), label: "Deliver to", binding: "delivery.contact", visible: true },
        { id: nanoid(6), label: "Address", binding: "delivery.address", visible: true },
      ];
      baseState.content.metadataFields = [
        { id: nanoid(6), label: "Docket #", binding: "docket.number", visible: true },
        { id: nanoid(6), label: "Date", binding: "docket.date", visible: true },
      ];
      baseState.content.tableColumns = [
        { id: nanoid(6), label: "Description", binding: "description", align: "left", format: "text", visible: true },
        { id: nanoid(6), label: "Qty", binding: "quantity", align: "right", format: "number", visible: true },
        { id: nanoid(6), label: "Location", binding: "location", align: "left", format: "text", visible: true },
      ];
      baseState.footer.showNotes = true;
      break;

    case "order_confirmation":
      baseState.content.recipientFields = [
        { id: nanoid(6), label: "Customer", binding: "customer.name", visible: true },
        { id: nanoid(6), label: "Email", binding: "customer.email", visible: true },
      ];
      baseState.content.metadataFields = [
        { id: nanoid(6), label: "Order #", binding: "order.number", visible: true },
        { id: nanoid(6), label: "Order Date", binding: "order.date", visible: true },
        { id: nanoid(6), label: "Requested Date", binding: "order.requestedDate", visible: true },
      ];
      baseState.content.tableColumns = [
        { id: nanoid(6), label: "Description", binding: "description", align: "left", format: "text", visible: true },
        { id: nanoid(6), label: "Qty", binding: "quantity", align: "right", format: "number", visible: true },
        { id: nanoid(6), label: "Unit Price", binding: "unitPrice", align: "right", format: "currency", visible: true },
      ];
      break;

    case "av_list":
      baseState.content.showRecipientBox = false;
      baseState.content.metadataFields = [
        { id: nanoid(6), label: "Generated", binding: "generatedAt", visible: true },
      ];
      baseState.content.tableRowsBinding = "items";
      baseState.content.tableColumns = [
        { id: nanoid(6), label: "Product", binding: "name", align: "left", format: "text", visible: true },
        { id: nanoid(6), label: "Size", binding: "size", align: "left", format: "text", visible: true },
        { id: nanoid(6), label: "Grade", binding: "grade", align: "left", format: "text", visible: true },
        { id: nanoid(6), label: "Available", binding: "qty", align: "right", format: "number", visible: true },
        { id: nanoid(6), label: "Price", binding: "price", align: "right", format: "currency", visible: true },
      ];
      break;

    case "lookin_good":
      baseState.content.showRecipientBox = false;
      baseState.content.metadataFields = [
        { id: nanoid(6), label: "Generated", binding: "generatedAt", visible: true },
      ];
      baseState.content.tableRowsBinding = "items";
      baseState.content.tableColumns = [
        { id: nanoid(6), label: "Product", binding: "name", align: "left", format: "text", visible: true },
        { id: nanoid(6), label: "Description", binding: "description", align: "left", format: "text", visible: true },
        { id: nanoid(6), label: "Photo", binding: "photo", align: "left", format: "text", visible: true },
      ];
      break;
  }

  return baseState;
}

/**
 * Extract FormState from an existing layout
 * Attempts to parse the layout and extract editable values
 */
export function layoutToFormState(layout: DocumentComponent[], documentType: DocumentType): FormState {
  const formState = defaultFormState(documentType);

  // Find header components
  const headingComponent = layout.find(c => c.type === "heading" && c.zone !== "footer");
  if (headingComponent && headingComponent.type === "heading") {
    formState.header.title = headingComponent.text ?? "{{title}}";
    // Extract binding from {{...}} pattern
    const bindingMatch = headingComponent.text?.match(/\{\{([^}]+)\}\}/);
    if (bindingMatch) {
      formState.header.titleBinding = bindingMatch[1];
    }
  }

  const subtitleComponent = layout.find(c =>
    c.type === "text" &&
    (c.id === "subtitle" || (c.text?.includes("{{subtitle}}") ?? false))
  );
  if (subtitleComponent && subtitleComponent.type === "text") {
    formState.header.subtitle = subtitleComponent.text ?? "{{subtitle}}";
  }

  const dividerComponent = layout.find(c => c.type === "divider" && c.zone !== "footer");
  formState.header.showDivider = !!dividerComponent;

  // Find recipient/customer box
  const recipientBox = layout.find(c =>
    c.type === "box" &&
    (c.label?.toLowerCase().includes("customer") ||
     c.label?.toLowerCase().includes("delivery") ||
     c.id?.includes("customer") ||
     c.id?.includes("delivery"))
  );
  if (recipientBox && recipientBox.type === "box" && recipientBox.children) {
    formState.content.showRecipientBox = true;
    formState.content.recipientFields = recipientBox.children
      .filter((child): child is DocumentComponent & { type: "text" } => child.type === "text")
      .map(child => {
        const bindingMatch = child.text?.match(/\{\{([^}]+)\}\}/);
        const labelMatch = child.text?.match(/^([^:]+):/);
        return {
          id: child.id ?? nanoid(6),
          label: labelMatch ? labelMatch[1].trim() : "Field",
          binding: bindingMatch ? bindingMatch[1] : "",
          visible: true,
        };
      });
  }

  // Find metadata list
  const metadataList = layout.find(c =>
    c.type === "list" &&
    !c.id?.includes("total") &&
    c.zone !== "footer"
  );
  if (metadataList && metadataList.type === "list" && metadataList.items) {
    formState.content.showMetadata = true;
    formState.content.metadataFields = metadataList.items.map(item => ({
      id: nanoid(6),
      label: item.label ?? "Field",
      binding: item.binding ?? "",
      visible: true,
    }));
  }

  // Find main table
  const tableComponent = layout.find(c => c.type === "table");
  if (tableComponent && tableComponent.type === "table") {
    formState.content.showTable = true;
    formState.content.tableRowsBinding = tableComponent.rowsBinding ?? "lines";
    formState.content.showTableHeader = tableComponent.showHeader ?? true;
    formState.content.tableColumns = (tableComponent.columns ?? []).map(col => ({
      id: col.key ?? nanoid(6),
      label: col.label ?? "Column",
      binding: col.binding ?? "",
      align: col.align ?? "left",
      format: col.format ?? "text",
      visible: true,
    }));
  }

  // Find totals list
  const totalsList = layout.find(c =>
    c.type === "list" &&
    (c.id?.includes("total") ||
     c.items?.some(item => item.binding?.includes("total")))
  );
  if (totalsList && totalsList.type === "list" && totalsList.items) {
    formState.content.showTotals = true;
    formState.content.totalsFields = totalsList.items.map(item => ({
      id: nanoid(6),
      label: item.label ?? "Total",
      binding: item.binding ?? "",
      visible: true,
    }));
  }

  // Find footer notes
  const notesComponent = layout.find(c =>
    c.zone === "footer" &&
    c.type === "text" &&
    (c.id?.includes("notes") || c.text?.includes("{{notes}}"))
  );
  if (notesComponent && notesComponent.type === "text") {
    formState.footer.showNotes = true;
    formState.footer.notesText = notesComponent.text ?? "";
  }

  return formState;
}

/**
 * Convert FormState back to DocumentComponent[] layout
 */
export function formStateToLayout(formState: FormState, documentType: DocumentType): DocumentComponent[] {
  const layout: DocumentComponent[] = [];

  // Header section
  if (formState.header.title) {
    layout.push({
      id: "heading",
      type: "heading",
      zone: "header",
      text: formState.header.title,
      level: 2,
      style: { fontSize: 22, bold: true },
    });
  }

  if (formState.header.subtitle) {
    layout.push({
      id: "subtitle",
      type: "text",
      zone: "header",
      text: formState.header.subtitle,
      style: { color: "#475569" },
    });
  }

  if (formState.header.showDivider) {
    layout.push({
      id: "divider",
      type: "divider",
      zone: "header",
    });
  }

  // Recipient box
  if (formState.content.showRecipientBox && formState.content.recipientFields.length > 0) {
    const visibleFields = formState.content.recipientFields.filter(f => f.visible);
    if (visibleFields.length > 0) {
      const recipientLabel = documentType === "delivery_docket" ? "Delivery" : "Customer";
      layout.push({
        id: `${recipientLabel.toLowerCase()}-box`,
        type: "box",
        zone: "body",
        label: recipientLabel,
        children: visibleFields.map((field, idx) => ({
          id: `recipient-${idx}`,
          type: "text" as const,
          text: `${field.label}: {{${field.binding}}}`,
          style: idx === 0 ? { bold: true } : undefined,
        })),
      });
    }
  }

  // Metadata list
  if (formState.content.showMetadata && formState.content.metadataFields.length > 0) {
    const visibleFields = formState.content.metadataFields.filter(f => f.visible);
    if (visibleFields.length > 0) {
      layout.push({
        id: "metadata-list",
        type: "list",
        zone: "body",
        items: visibleFields.map(field => ({
          label: field.label,
          binding: field.binding,
        })),
      });
    }
  }

  // Main table
  if (formState.content.showTable && formState.content.tableColumns.length > 0) {
    const visibleColumns = formState.content.tableColumns.filter(c => c.visible);
    if (visibleColumns.length > 0) {
      layout.push({
        id: "main-table",
        type: "table",
        zone: "body",
        rowsBinding: formState.content.tableRowsBinding,
        showHeader: formState.content.showTableHeader,
        columns: visibleColumns.map(col => ({
          key: col.id,
          label: col.label,
          binding: col.binding,
          align: col.align,
          format: col.format,
        })),
      });
    }
  }

  // Totals list
  if (formState.content.showTotals && formState.content.totalsFields.length > 0) {
    const visibleFields = formState.content.totalsFields.filter(f => f.visible);
    if (visibleFields.length > 0) {
      layout.push({
        id: "totals-list",
        type: "list",
        zone: "body",
        items: visibleFields.map(field => ({
          label: field.label,
          binding: field.binding,
        })),
      });
    }
  }

  // Footer notes
  if (formState.footer.showNotes) {
    layout.push({
      id: "footer-notes",
      type: "text",
      zone: "footer",
      text: formState.footer.notesText || `{{${formState.footer.notesBinding}}}`,
    });
  }

  // Footer terms
  if (formState.footer.showTerms && formState.footer.termsText) {
    layout.push({
      id: "footer-terms",
      type: "text",
      zone: "footer",
      text: formState.footer.termsText,
      style: { fontSize: 8, color: "#64748b" },
    });
  }

  // Page number
  if (formState.footer.showPageNumber) {
    layout.push({
      id: "page-number",
      type: "text",
      zone: "footer",
      text: formState.footer.pageNumberFormat,
      style: { align: "center", fontSize: 9, color: "#94a3b8" },
    });
  }

  return layout;
}

/**
 * Merge form state changes into existing layout
 * Preserves components not managed by the form editor (custom additions in visual mode)
 */
export function mergeFormStateIntoLayout(
  formState: FormState,
  existingLayout: DocumentComponent[],
  documentType: DocumentType
): DocumentComponent[] {
  // Get IDs of components the form editor manages
  const managedIds = new Set([
    "heading", "subtitle", "divider",
    "customer-box", "delivery-box",
    "metadata-list",
    "main-table",
    "totals-list",
    "footer-notes", "footer-terms", "page-number",
  ]);

  // Keep components that aren't managed by the form editor
  const customComponents = existingLayout.filter(c => {
    // Check if it's a managed ID
    if (managedIds.has(c.id)) return false;

    // Check for pattern-matched managed components
    if (c.id.startsWith("recipient-")) return false;

    return true;
  });

  // Generate new layout from form state
  const formLayout = formStateToLayout(formState, documentType);

  // Merge: form layout takes precedence, custom components are appended
  // Sort by zone: header first, then body, then footer
  const zoneOrder: Record<string, number> = { header: 0, body: 1, footer: 2 };

  return [...formLayout, ...customComponents].sort((a, b) => {
    const zoneA = zoneOrder[a.zone ?? "body"] ?? 1;
    const zoneB = zoneOrder[b.zone ?? "body"] ?? 1;
    return zoneA - zoneB;
  });
}
