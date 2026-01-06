export type DocumentType =
  | "invoice"
  | "delivery_docket"
  | "order_confirmation"
  | "av_list"
  | "lookin_good";

export type TemplateStatus = "draft" | "published" | "archived";

export type ComponentType =
  | "heading"
  | "text"
  | "table"
  | "list"
  | "box"
  | "image"
  | "divider"
  | "spacer"
  | "chips";

export type Alignment = "left" | "center" | "right";

export type VisibilityRule = {
  field: string;
  operator?: "exists" | "equals" | "not_equals";
  value?: string | number | boolean | null;
};

export type Position = {
  x: number;      // mm from left edge
  y: number;      // mm from top edge
  width?: number; // mm (optional, auto-fit if not set)
  height?: number; // mm (optional)
};

export type LayoutMode = "flow" | "absolute";

export type DocumentZone = "header" | "body" | "footer";

export type ZoneConfig = {
  zone: DocumentZone;
  height: number; // mm
  layoutMode: LayoutMode;
};

export type ComponentStyle = {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  background?: string;
  padding?: number;
  marginBottom?: number;
  align?: Alignment;
  border?: { color?: string; width?: number };
  position?: Position;
  layoutMode?: LayoutMode;
};

export type BaseComponent = {
  id: string;
  type: ComponentType;
  zone?: DocumentZone;
  label?: string;
  binding?: string;
  text?: string;
  style?: ComponentStyle;
  visibleWhen?: VisibilityRule | VisibilityRule[];
};

export type TextComponent = BaseComponent & {
  type: "text" | "heading";
  level?: 1 | 2 | 3 | 4;
  placeholder?: string;
};

export type ListComponent = BaseComponent & {
  type: "list";
  items?: Array<{ label?: string; binding?: string }>;
};

export type ChipComponent = BaseComponent & {
  type: "chips";
  items?: Array<{ label: string; color?: string }>;
};

export type BoxComponent = BaseComponent & {
  type: "box";
  children?: DocumentComponent[];
};

export type TableColumn = {
  key: string;
  label: string;
  binding?: string;
  width?: number;
  align?: Alignment;
  format?: "text" | "currency" | "number" | "date";
};

export type TableComponent = BaseComponent & {
  type: "table";
  rowsBinding?: string;
  columns: TableColumn[];
  showHeader?: boolean;
};

export type ImageComponent = BaseComponent & {
  type: "image";
  url?: string;
  width?: number;
  height?: number;
};

export type DividerComponent = BaseComponent & {
  type: "divider";
};

export type SpacerComponent = BaseComponent & {
  type: "spacer";
  size?: number;
};

export type DocumentComponent =
  | TextComponent
  | ListComponent
  | ChipComponent
  | BoxComponent
  | TableComponent
  | ImageComponent
  | DividerComponent
  | SpacerComponent;

export type TemplateLayout = DocumentComponent[] | DocumentLayout;

export type DocumentLayout = {
  pageSize: { width: number; height: number }; // mm, default A4 (210 x 297)
  margins: { top: number; right: number; bottom: number; left: number };
  zones: ZoneConfig[];
  components: DocumentComponent[];
};

export function isDocumentLayout(layout: TemplateLayout): layout is DocumentLayout {
  return layout !== null && typeof layout === 'object' && !Array.isArray(layout) && 'pageSize' in layout;
}

export function getLayoutComponents(layout: TemplateLayout): DocumentComponent[] {
  return isDocumentLayout(layout) ? layout.components : layout;
}

export type DocumentTemplateVersion = {
  id: string;
  templateId: string;
  versionNumber: number;
  layout: TemplateLayout;
  variables?: Record<string, unknown>;
  sampleData?: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  notes?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
};

export type DocumentTemplate = {
  id: string;
  orgId: string;
  name: string;
  documentType: DocumentType;
  description?: string | null;
  status: TemplateStatus;
  currentVersionId?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  currentVersion?: DocumentTemplateVersion | null;
  versions?: DocumentTemplateVersion[];
};

export type PreviewRequest = {
  templateId?: string;
  layout?: TemplateLayout;
  documentType?: DocumentType;
  variables?: Record<string, unknown>;
  dataContext?: Record<string, unknown>;
};

export type PreviewResult = {
  html: string;
  dataUsed: Record<string, unknown>;
};







