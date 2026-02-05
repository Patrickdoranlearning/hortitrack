import { nanoid } from "nanoid";

export type AttributeKey =
  | "production_phase"
  | "production_status"
  | "waste_reason"
  | "sub_location"
  | "audit_type"
  | "plant_category"
  | "delivery_route"
  | "plant_health_issue"
  | "sprayer_used"
  | "trolley_type"
  | "size_container_type";

export type AttributeBehavior = "growing" | "available" | "waste" | "archived";

export type AttributeOption = {
  id: string;
  attributeKey: AttributeKey;
  systemCode: string;
  displayLabel: string;
  sortOrder: number;
  isActive: boolean;
  behavior?: AttributeBehavior | null;
  color?: string | null;
  category?: string | null;
  source?: "custom" | "default";
};

export type AttributeOptionInput = Omit<AttributeOption, "id" | "attributeKey" | "sortOrder"> & {
  id?: string;
  sortOrder?: number;
};

type DefaultOption = Omit<AttributeOption, "id" | "attributeKey" | "source">;

// Category options for plant_health_issue
export const PLANT_HEALTH_CATEGORIES = ["Pest", "Disease", "Environmental"] as const;
export type PlantHealthCategory = typeof PLANT_HEALTH_CATEGORIES[number];

export const ATTRIBUTE_META: Record<
  AttributeKey,
  {
    label: string;
    description: string;
    requiresBehavior?: boolean;
    allowColor?: boolean;
    allowCategory?: boolean;
    categoryOptions?: string[];
  }
> = {
  production_phase: {
    label: "Production Phases",
    description: "Propagation, potting, spacing, finishing – editable per grower.",
  },
  production_status: {
    label: "Production Status",
    description: "Maps visible statuses to system behaviors for availability logic.",
    requiresBehavior: true,
    allowColor: true,
  },
  waste_reason: {
    label: "Waste / Dump Reasons",
    description: "Capture horticulture-specific loss reasons for reporting.",
  },
  sub_location: {
    label: "Sub-Locations",
    description: "Benches, bays, or zones within a location.",
  },
  audit_type: {
    label: "Audit Types",
    description: "Stock takes, health checks, QC checks.",
  },
  plant_category: {
    label: "Plant Categories",
    description: "Taxonomy for crops, e.g. Bedding, Perennials, Shrubs.",
  },
  delivery_route: {
    label: "Delivery Routes",
    description: "Predefined delivery routes for dispatch planning.",
    allowColor: true,
  },
  plant_health_issue: {
    label: "Plant Health Issues",
    description: "Common pest and disease issues for scouting and IPM logging.",
    allowColor: true,
    allowCategory: true,
    categoryOptions: ["Pest", "Disease", "Environmental"],
  },
  sprayer_used: {
    label: "Sprayers",
    description: "Spray equipment used for IPM applications.",
  },
  trolley_type: {
    label: "Trolley Types",
    description: "Types of trolleys used for dispatch and delivery.",
  },
  size_container_type: {
    label: "Container Types",
    description: "Container types for plant sizes (pots, trays, bareroot, etc).",
  },
};

// Defaults keep legacy values to avoid breaking existing data,
// but can be fully renamed/hidden/reordered per org.
const DEFAULTS: Record<AttributeKey, DefaultOption[]> = {
  production_phase: [
    { systemCode: "propagation", displayLabel: "Propagation", sortOrder: 10, isActive: true },
    { systemCode: "plug", displayLabel: "Plugs/Liners", sortOrder: 20, isActive: true },
    { systemCode: "potting", displayLabel: "Potting", sortOrder: 30, isActive: true },
    { systemCode: "growing", displayLabel: "Growing", sortOrder: 40, isActive: true },
    { systemCode: "finished", displayLabel: "Finished", sortOrder: 50, isActive: true },
  ],
  production_status: [
    { systemCode: "Planned", displayLabel: "Planned", sortOrder: 5, isActive: true, behavior: "growing" },
    { systemCode: "Incoming", displayLabel: "Incoming", sortOrder: 10, isActive: true, behavior: "growing" },
    { systemCode: "Propagation", displayLabel: "Propagation", sortOrder: 20, isActive: true, behavior: "growing" },
    { systemCode: "Growing", displayLabel: "Growing", sortOrder: 30, isActive: true, behavior: "growing" },
    { systemCode: "Plugs/Liners", displayLabel: "Plugs/Liners", sortOrder: 40, isActive: true, behavior: "growing" },
    { systemCode: "Potted", displayLabel: "Potted", sortOrder: 50, isActive: true, behavior: "growing" },
    { systemCode: "Ready for Sale", displayLabel: "Ready for Sale", sortOrder: 60, isActive: true, behavior: "available" },
    { systemCode: "Looking Good", displayLabel: "Looking Good", sortOrder: 70, isActive: true, behavior: "available" },
    { systemCode: "Archived", displayLabel: "Archived", sortOrder: 1000, isActive: true, behavior: "archived" },
  ],
  waste_reason: [
    { systemCode: "BOTRYTIS", displayLabel: "Botrytis", sortOrder: 10, isActive: true },
    { systemCode: "VINE_WEEVIL", displayLabel: "Vine Weevil", sortOrder: 20, isActive: true },
    { systemCode: "FROST", displayLabel: "Frost", sortOrder: 30, isActive: true },
    { systemCode: "OVERGROWN", displayLabel: "Overgrown", sortOrder: 40, isActive: true },
  ],
  sub_location: [
    { systemCode: "BENCH", displayLabel: "Bench", sortOrder: 10, isActive: true },
    { systemCode: "FLOOR", displayLabel: "Floor", sortOrder: 20, isActive: true },
    { systemCode: "BAY", displayLabel: "Bay", sortOrder: 30, isActive: true },
    { systemCode: "ZONE", displayLabel: "Zone", sortOrder: 40, isActive: true },
  ],
  audit_type: [
    { systemCode: "STOCK_TAKE", displayLabel: "Stock Take", sortOrder: 10, isActive: true },
    { systemCode: "HEALTH_CHECK", displayLabel: "Health Check", sortOrder: 20, isActive: true },
    { systemCode: "QC_CHECK", displayLabel: "QC Check", sortOrder: 30, isActive: true },
  ],
  plant_category: [
    { systemCode: "BEDDING", displayLabel: "Bedding", sortOrder: 10, isActive: true },
    { systemCode: "PERENNIAL", displayLabel: "Perennials", sortOrder: 20, isActive: true },
    { systemCode: "SHRUB", displayLabel: "Shrubs", sortOrder: 30, isActive: true },
    { systemCode: "TREE", displayLabel: "Trees", sortOrder: 40, isActive: true },
  ],
  delivery_route: [
    { systemCode: "DUBLIN", displayLabel: "Dublin", sortOrder: 10, isActive: true },
    { systemCode: "CORK", displayLabel: "Cork", sortOrder: 20, isActive: true },
    { systemCode: "GALWAY", displayLabel: "Galway", sortOrder: 30, isActive: true },
    { systemCode: "LIMERICK", displayLabel: "Limerick", sortOrder: 40, isActive: true },
    { systemCode: "NORTH", displayLabel: "North", sortOrder: 50, isActive: true },
    { systemCode: "SOUTH", displayLabel: "South", sortOrder: 60, isActive: true },
  ],
  plant_health_issue: [
    // Pests
    { systemCode: "APHIDS", displayLabel: "Aphids", sortOrder: 10, isActive: true, category: "Pest" },
    { systemCode: "VINE_WEEVIL", displayLabel: "Vine Weevil", sortOrder: 20, isActive: true, category: "Pest" },
    { systemCode: "SPIDER_MITES", displayLabel: "Spider Mites", sortOrder: 30, isActive: true, category: "Pest" },
    { systemCode: "WHITEFLY", displayLabel: "Whitefly", sortOrder: 40, isActive: true, category: "Pest" },
    { systemCode: "THRIPS", displayLabel: "Thrips", sortOrder: 50, isActive: true, category: "Pest" },
    { systemCode: "SLUG_DAMAGE", displayLabel: "Slug/Snail Damage", sortOrder: 60, isActive: true, category: "Pest" },
    { systemCode: "CATERPILLAR", displayLabel: "Caterpillar Damage", sortOrder: 70, isActive: true, category: "Pest" },
    { systemCode: "SCALE_INSECTS", displayLabel: "Scale Insects", sortOrder: 80, isActive: true, category: "Pest" },
    { systemCode: "MEALYBUG", displayLabel: "Mealybug", sortOrder: 90, isActive: true, category: "Pest" },
    // Diseases
    { systemCode: "FUNGAL_INFECTION", displayLabel: "Fungal Infection", sortOrder: 100, isActive: true, category: "Disease" },
    { systemCode: "POWDERY_MILDEW", displayLabel: "Powdery Mildew", sortOrder: 110, isActive: true, category: "Disease" },
    { systemCode: "DOWNY_MILDEW", displayLabel: "Downy Mildew", sortOrder: 120, isActive: true, category: "Disease" },
    { systemCode: "ROOT_ROT", displayLabel: "Root Rot", sortOrder: 130, isActive: true, category: "Disease" },
    { systemCode: "BOTRYTIS", displayLabel: "Botrytis", sortOrder: 140, isActive: true, category: "Disease" },
    { systemCode: "RUST", displayLabel: "Rust", sortOrder: 150, isActive: true, category: "Disease" },
    // Environmental
    { systemCode: "NUTRIENT_DEFICIENCY", displayLabel: "Nutrient Deficiency", sortOrder: 200, isActive: true, category: "Environmental" },
    { systemCode: "OVERWATERING", displayLabel: "Overwatering", sortOrder: 210, isActive: true, category: "Environmental" },
    { systemCode: "UNDERWATERING", displayLabel: "Underwatering", sortOrder: 220, isActive: true, category: "Environmental" },
  ],
  sprayer_used: [
    { systemCode: "KNAPSACK_1", displayLabel: "Knapsack #1", sortOrder: 10, isActive: true },
    { systemCode: "KNAPSACK_2", displayLabel: "Knapsack #2", sortOrder: 20, isActive: true },
    { systemCode: "KNAPSACK_3", displayLabel: "Knapsack #3", sortOrder: 30, isActive: true },
    { systemCode: "BOOM_SPRAYER", displayLabel: "Boom Sprayer", sortOrder: 40, isActive: true },
    { systemCode: "MIST_BLOWER", displayLabel: "Mist Blower", sortOrder: 50, isActive: true },
    { systemCode: "HAND_PUMP", displayLabel: "Hand Pump Sprayer", sortOrder: 60, isActive: true },
    { systemCode: "FOGGING_MACHINE", displayLabel: "Fogging Machine", sortOrder: 70, isActive: true },
  ],
  trolley_type: [
    { systemCode: "tag6", displayLabel: "Tag 6 (Yellow)", sortOrder: 10, isActive: true },
    { systemCode: "dc", displayLabel: "DC (No Tag)", sortOrder: 20, isActive: true },
    { systemCode: "danish", displayLabel: "Danish Trolley", sortOrder: 30, isActive: true },
    { systemCode: "dutch", displayLabel: "Dutch Trolley", sortOrder: 40, isActive: true },
    { systemCode: "half_trolley", displayLabel: "Half Trolley", sortOrder: 50, isActive: true },
    { systemCode: "pallet", displayLabel: "Pallet", sortOrder: 60, isActive: true },
  ],
  size_container_type: [
    { systemCode: "pot", displayLabel: "Pot", sortOrder: 10, isActive: true },
    { systemCode: "tray", displayLabel: "Tray", sortOrder: 20, isActive: true },
    { systemCode: "plug_tray", displayLabel: "Plug Tray", sortOrder: 30, isActive: true },
    { systemCode: "prop_tray", displayLabel: "Propagation Tray", sortOrder: 40, isActive: true },
    { systemCode: "bareroot", displayLabel: "Bareroot", sortOrder: 50, isActive: true },
  ],
};

export function normalizeSystemCode(input: string) {
  const safe = (input || "").trim();
  if (!safe) return `OPT_${nanoid(6).toUpperCase()}`;
  return safe
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 80);
}

export function defaultOptionsFor(attributeKey: AttributeKey, includeInactive = false): AttributeOption[] {
  const rows = DEFAULTS[attributeKey] ?? [];
  const filtered = includeInactive ? rows : rows.filter((o) => o.isActive);
  return filtered.map((opt) => ({
    id: `default-${attributeKey}-${opt.systemCode}`,
    attributeKey,
    source: "default",
    ...opt,
  }));
}

export function attributeKeys(): AttributeKey[] {
  return Object.keys(DEFAULTS) as AttributeKey[];
}

