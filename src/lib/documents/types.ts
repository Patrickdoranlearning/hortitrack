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
};

export type BaseComponent = {
  id: string;
  type: ComponentType;
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

export type TemplateLayout = DocumentComponent[];

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



