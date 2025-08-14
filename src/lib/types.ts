import { z } from "zod";

/**
 * Core log types used throughout the app.
 * IMPORTANT: When using z.discriminatedUnion('type', variants),
 * every variant MUST declare `type` as a z.literal(...).
 */

// ---- Log variants ----
const NoteLog = z.object({
  type: z.literal("NOTE"),
  note: z.string().min(1, "Please add a note."),
});

const MoveLog = z
  .object({
    type: z.literal("MOVE"),
    // prefer ID; keep name for backward compatibility
    newLocationId: z.string().optional(),
    newLocation: z.string().optional(),
    note: z.string().optional(),
  })
  .refine((v) => Boolean(v.newLocationId || v.newLocation), {
    message: "Select a new location",
    path: ["newLocation"],
  });

const LossLog = z.object({
  type: z.literal("LOSS"),
  qty: z.coerce.number().min(1, "Enter a quantity greater than 0"),
  reason: z.string().optional(),
  note: z.string().optional(),
});

const TransplantFromLog = z.object({
  type: z.literal("TRANSPLANT_FROM"),
  qty: z.coerce.number().min(1),
  fromBatch: z.string(),
  note: z.string().optional(),
});

const TransplantToLog = z.object({
  type: z.literal("TRANSPLANT_TO"),
  // your UI stores negative qty; allow any number
  qty: z.coerce.number(),
  toBatch: z.string(),
  reason: z.string().optional(),
  note: z.string().optional(),
});

const CreateLog = z.object({
  type: z.literal("CREATE"),
  qty: z.coerce.number().optional(),
  note: z.string().optional(),
});

const ArchiveLog = z.object({
  type: z.literal("ARCHIVE"),
  qty: z.coerce.number().optional(),
  reason: z.string().optional(),
  note: z.string().optional(),
});

// keep legacy/other types seen in data
const AdjustLog = z.object({
  type: z.literal("ADJUST"),
  qty: z.coerce.number().optional(),
  note: z.string().optional(),
});

const BatchSpacedLog = z.object({
  type: z.literal("Batch Spaced"),
  note: z.string().optional(),
});

// envelope with id+date that we AND onto the union below
export const LogEnvelope = z.object({
  id: z.string(),
  date: z.any(), // Firestore Timestamp or ISO string; normalize at edges
});

// Final discriminated union for LogEntry
export const LogEntrySchema = LogEnvelope.and(
  z.discriminatedUnion("type", [
    NoteLog,
    MoveLog,
    LossLog,
    TransplantFromLog,
    TransplantToLog,
    CreateLog,
    ArchiveLog,
    AdjustLog,
    BatchSpacedLog,
  ])
);
export type LogEntry = z.infer<typeof LogEntrySchema>;

// ---- Action Log Form Values (NOTE | MOVE | LOSS only) ----
export const ActionLogSchema = z.discriminatedUnion("type", [
  NoteLog,
  MoveLog,
  LossLog,
]);
export type ActionLogFormValues = z.infer<typeof ActionLogSchema>;

// ---- Domain types ----

export const BatchStatus = z.enum([
  "Propagation",
  "Plugs/Liners",
  "Potted",
  "Ready for Sale",
  "Looking Good",
  "Archived",
]);

export const BatchSchema = z.object({
  id: z.string().optional(),
  batchNumber: z.string(),
  category: z.string(),
  plantFamily: z.string(),
  plantVariety: z.string(),
  plantingDate: z.string(), // ISO
  initialQuantity: z.number(),
  quantity: z.number(),
  status: BatchStatus,
  location: z.string(),
  locationId: z.string().optional(),
  size: z.string(),
  logHistory: z.array(LogEntrySchema),
  transplantedFrom: z.string().optional(),
  supplier: z.string().optional(),
  growerPhotoUrl: z.string().optional(),
  salesPhotoUrl: z.string().optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});
export type Batch = z.infer<typeof BatchSchema>;

export const VarietySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Variety name is required"),
  commonName: z.string().optional(),
  family: z.string().min(1, "Family is required"),
  category: z.string().min(1, "Category is required"),
  grouping: z.string().optional(),
  rating: z.string().optional(),
  salesPeriod: z.string().optional(),
  floweringPeriod: z.string().optional(),
  flowerColour: z.string().optional(),
  evergreen: z.string().optional(),
});
export type Variety = z.infer<typeof VarietySchema>;

export const NurseryLocationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  nursery: z.string().min(1),
  type: z.string().min(1), // e.g., "Tunnel", "Section", ...
  area: z.coerce.number().nonnegative().optional(),
  isCovered: z.boolean().optional(),
});
export type NurseryLocation = z.infer<typeof NurseryLocationSchema>;

export const PlantSizeSchema = z.object({
  id: z.string().optional(),
  size: z.string().min(1), // e.g., "10.5", "54"
  type: z.enum(["Tray", "Pot", "Bareroot"]),
  area: z.coerce.number().nonnegative(),
  shelfQuantity: z.coerce.number().nonnegative(),
  multiple: z.coerce.number().positive(),
});
export type PlantSize = z.infer<typeof PlantSizeSchema>;

export const SupplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  address: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  producerCode: z.string().optional(),
});
export type Supplier = z.infer<typeof SupplierSchema>;

// ---- misc UI form types ----

export const TransplantFormSchema = z.object({
  size: z.string().optional(),
  location: z.string().optional(),
  supplier: z.string().optional(),
  status: BatchStatus.optional(),
  transplantQuantity: z.coerce.number().min(1),
  logRemainingAsLoss: z.boolean().optional(),
});
export type TransplantFormData = z.infer<typeof TransplantFormSchema>;

// ---- AI flow output types ----

/**
 * Output schema for the Production Protocol AI flow.
 * Matches the shape used by <ProductionProtocolDialog />.
 */
export const ProductionProtocolOutputSchema = z.object({
  protocolTitle: z.string(),
  summary: z.string(),
  timeline: z.array(z.object({
    day: z.number(),
    action: z.string(),
    date: z.string(),
    details: z.string(),
  })),
  recommendations: z.array(z.string()),
});
export type ProductionProtocolOutput = z.infer<typeof ProductionProtocolOutputSchema>;
