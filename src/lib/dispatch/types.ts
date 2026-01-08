import { z } from "zod";

// ================================================
// DISPATCH MODULE TYPES
// ================================================

// --- Enums ---

export const DeliveryRunStatus = z.enum([
  'planned',
  'loading',
  'in_transit',
  'completed',
  'cancelled'
]);
export type DeliveryRunStatusType = z.infer<typeof DeliveryRunStatus>;

export const DeliveryItemStatus = z.enum([
  'pending',
  'loading',
  'in_transit',
  'delivered',
  'failed',
  'rescheduled'
]);
export type DeliveryItemStatusType = z.infer<typeof DeliveryItemStatus>;

export const TrolleyStatus = z.enum([
  'available',
  'loaded',
  'at_customer',
  'returned',
  'damaged',
  'lost'
]);
export type TrolleyStatusType = z.infer<typeof TrolleyStatus>;

export const PackingStatus = z.enum([
  'not_started',
  'in_progress',
  'completed',
  'verified'
]);
export type PackingStatusType = z.infer<typeof PackingStatus>;

// --- Delivery Runs (Routes) ---

export const DeliveryRunSchema = z.object({
  id: z.string(),
  orgId: z.string(),

  // Route Identification
  runNumber: z.string(),
  runDate: z.string(), // ISO date string
  loadName: z.string().optional(), // Custom name like "Cork Load 1"
  weekNumber: z.number().int().optional(), // ISO week number

  // Haulier & Vehicle
  haulierId: z.string().optional(),
  vehicleId: z.string().optional(),
  driverName: z.string().optional(),
  vehicleRegistration: z.string().optional(),
  vehicleType: z.enum(['van', 'truck', 'trailer']).optional(),

  // Route Planning
  plannedDepartureTime: z.string().optional(), // ISO datetime
  actualDepartureTime: z.string().optional(),
  estimatedReturnTime: z.string().optional(),
  actualReturnTime: z.string().optional(),

  // Status
  status: DeliveryRunStatus.default('planned'),

  // Trolley Tracking
  trolleysLoaded: z.number().int().nonnegative().default(0),
  trolleysReturned: z.number().int().nonnegative().default(0),

  // Notes
  routeNotes: z.string().optional(),

  // Display
  displayOrder: z.number().int().default(0),

  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),

  // UI helpers (from joins/aggregations)
  totalDeliveries: z.number().int().optional(),
  completedDeliveries: z.number().int().optional(),
  pendingDeliveries: z.number().int().optional(),
  trolleysOutstanding: z.number().int().optional(),
});
export type DeliveryRun = z.infer<typeof DeliveryRunSchema>;

// Input schema for creating a delivery run
export const CreateDeliveryRunSchema = z.object({
  runDate: z.string(),
  loadName: z.string().optional(), // Custom name for the load
  haulierId: z.string().optional(),
  vehicleId: z.string().optional(), // Reference to haulier_vehicles
  driverName: z.string().optional(),
  vehicleRegistration: z.string().optional(),
  vehicleType: z.enum(['van', 'truck', 'trailer']).optional(),
  plannedDepartureTime: z.string().optional(),
  estimatedReturnTime: z.string().optional(),
  routeNotes: z.string().optional(),
  orderIds: z.array(z.string()).optional(), // Orders to include in this run
});
export type CreateDeliveryRun = z.infer<typeof CreateDeliveryRunSchema>;

// --- Delivery Items ---

export const DeliveryItemSchema = z.object({
  id: z.string(),
  orgId: z.string(),

  // Relationships
  deliveryRunId: z.string(),
  orderId: z.string(),

  // Delivery Sequence
  sequenceNumber: z.number().int().positive(),

  // Delivery Window
  estimatedDeliveryTime: z.string().optional(),
  actualDeliveryTime: z.string().optional(),
  deliveryWindowStart: z.string().optional(), // HH:MM format
  deliveryWindowEnd: z.string().optional(),

  // Status
  status: DeliveryItemStatus.default('pending'),

  // Trolley Tracking
  trolleysDelivered: z.number().int().nonnegative().default(0),
  trolleysReturned: z.number().int().nonnegative().default(0),
  trolleysOutstanding: z.number().int().nonnegative().default(0), // Computed

  // Delivery Details
  recipientName: z.string().optional(),
  recipientSignatureUrl: z.string().url().optional(),
  deliveryNotes: z.string().optional(),
  deliveryPhotoUrl: z.string().url().optional(),

  // Failed Delivery
  failureReason: z.string().optional(),
  rescheduledTo: z.string().optional(),

  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),

  // UI helpers (from joins)
  orderNumber: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  orderTotal: z.number().optional(),
});
export type DeliveryItem = z.infer<typeof DeliveryItemSchema>;

// Input schema for adding orders to a delivery run
export const AddToDeliveryRunSchema = z.object({
  deliveryRunId: z.string(),
  orderId: z.string(),
  sequenceNumber: z.number().int().positive().optional(), // Auto-assigned if not provided
  deliveryWindowStart: z.string().optional(),
  deliveryWindowEnd: z.string().optional(),
  trolleysDelivered: z.number().int().nonnegative().default(0),
});
export type AddToDeliveryRun = z.infer<typeof AddToDeliveryRunSchema>;

// Input schema for updating delivery status
export const UpdateDeliveryItemSchema = z.object({
  status: DeliveryItemStatus.optional(),
  recipientName: z.string().optional(),
  deliveryNotes: z.string().optional(),
  trolleysReturned: z.number().int().nonnegative().optional(),
  actualDeliveryTime: z.string().optional(),
  failureReason: z.string().optional(),
});
export type UpdateDeliveryItem = z.infer<typeof UpdateDeliveryItemSchema>;

// --- Order Packing ---

export const OrderPackingSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  orderId: z.string(),

  // Packing Status
  status: PackingStatus.default('not_started'),

  // Packing Details
  trolleysUsed: z.number().int().nonnegative().default(0),
  totalUnits: z.number().int().nonnegative().optional(),

  // Quality Control
  verifiedBy: z.string().optional(),
  verifiedAt: z.string().optional(),

  // Notes
  packingNotes: z.string().optional(),
  specialInstructions: z.string().optional(),

  // Timing
  packingStartedAt: z.string().optional(),
  packingCompletedAt: z.string().optional(),

  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),

  // UI helpers
  orderNumber: z.string().optional(),
  customerName: z.string().optional(),
});
export type OrderPacking = z.infer<typeof OrderPackingSchema>;

// Input schema for updating packing status
export const UpdatePackingSchema = z.object({
  status: PackingStatus.optional(),
  trolleysUsed: z.number().int().nonnegative().optional(),
  totalUnits: z.number().int().nonnegative().optional(),
  packingNotes: z.string().optional(),
  specialInstructions: z.string().optional(),
});
export type UpdatePacking = z.infer<typeof UpdatePackingSchema>;

// --- Trolleys ---

export const TrolleySchema = z.object({
  id: z.string(),
  orgId: z.string(),

  // Identification
  trolleyNumber: z.string().min(1),
  trolleyType: z.string().default('danish'),

  // Current Status
  status: TrolleyStatus.default('available'),

  // Current Location
  currentLocation: z.string().optional(),
  customerId: z.string().optional(),
  deliveryRunId: z.string().optional(),

  // Condition
  conditionNotes: z.string().optional(),
  lastInspectionDate: z.string().optional(),

  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),

  // UI helpers
  customerName: z.string().optional(),
  runNumber: z.string().optional(),
});
export type Trolley = z.infer<typeof TrolleySchema>;

// Input schema for creating/updating trolleys
export const CreateTrolleySchema = z.object({
  trolleyNumber: z.string().min(1, "Trolley number is required"),
  trolleyType: z.string().default('danish'),
  status: TrolleyStatus.default('available'),
  conditionNotes: z.string().optional(),
});
export type CreateTrolley = z.infer<typeof CreateTrolleySchema>;

// --- Trolley Transactions ---

export const TrolleyTransactionSchema = z.object({
  id: z.string(),
  orgId: z.string(),

  // Relationships
  trolleyId: z.string(),
  deliveryRunId: z.string().optional(),
  deliveryItemId: z.string().optional(),
  customerId: z.string().optional(),

  // Transaction Details
  transactionType: z.enum(['loaded', 'delivered', 'returned', 'damaged', 'lost']),
  quantity: z.number().int().default(1),

  // Context
  notes: z.string().optional(),

  // Actor
  recordedBy: z.string().optional(),

  // Metadata
  transactionDate: z.string(),
  createdAt: z.string(),

  // UI helpers
  trolleyNumber: z.string().optional(),
  customerName: z.string().optional(),
});
export type TrolleyTransaction = z.infer<typeof TrolleyTransactionSchema>;

// Input schema for recording trolley transactions
export const CreateTrolleyTransactionSchema = z.object({
  trolleyId: z.string(),
  transactionType: z.enum(['loaded', 'delivered', 'returned', 'damaged', 'lost']),
  quantity: z.number().int().default(1),
  customerId: z.string().optional(),
  deliveryRunId: z.string().optional(),
  deliveryItemId: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateTrolleyTransaction = z.infer<typeof CreateTrolleyTransactionSchema>;

// --- Customer Trolley Balance ---

export const CustomerTrolleyBalanceSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  customerId: z.string(),

  // Balance
  trolleysOut: z.number().int().nonnegative().default(0),
  lastDeliveryDate: z.string().optional(),
  lastReturnDate: z.string().optional(),

  // Reminders
  reminderSentAt: z.string().optional(),
  reminderCount: z.number().int().default(0),

  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),

  // UI helpers
  customerName: z.string().optional(),
  daysOutstanding: z.number().int().optional(),
});
export type CustomerTrolleyBalance = z.infer<typeof CustomerTrolleyBalanceSchema>;

// --- Order Status Updates (Customer-Facing) ---

export const OrderStatusUpdateSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  orderId: z.string(),
  deliveryItemId: z.string().optional(),

  // Status Update
  statusType: z.enum([
    'order_confirmed',
    'packing_started',
    'packing_completed',
    'out_for_delivery',
    'delivered',
    'delivery_delayed',
    'delivery_failed'
  ]),
  title: z.string(),
  message: z.string().optional(),

  // Visibility
  visibleToCustomer: z.boolean().default(true),
  customerNotifiedAt: z.string().optional(),

  // Metadata
  createdAt: z.string(),
  createdBy: z.string().optional(),
});
export type OrderStatusUpdate = z.infer<typeof OrderStatusUpdateSchema>;

// Input schema for creating status updates
export const CreateOrderStatusUpdateSchema = z.object({
  orderId: z.string(),
  statusType: z.enum([
    'order_confirmed',
    'packing_started',
    'packing_completed',
    'out_for_delivery',
    'delivered',
    'delivery_delayed',
    'delivery_failed'
  ]),
  title: z.string(),
  message: z.string().optional(),
  visibleToCustomer: z.boolean().default(true),
  deliveryItemId: z.string().optional(),
});
export type CreateOrderStatusUpdate = z.infer<typeof CreateOrderStatusUpdateSchema>;

// --- Aggregated/View Types ---

export interface OrderReadyForDispatch {
  id: string;
  orderNumber: string;
  orgId: string;
  customerId: string;
  customerName: string;
  requestedDeliveryDate?: string;
  totalIncVat: number;
  packingStatus?: PackingStatusType;
  trolleysUsed?: number;
  deliveryStatus: string;
}

export interface ActiveDeliveryRunSummary {
  id: string;
  runNumber: string;
  loadName?: string;
  weekNumber?: number;
  orgId: string;
  runDate: string;
  status: DeliveryRunStatusType;
  driverName?: string;
  vehicleRegistration?: string;
  trolleysLoaded: number;
  trolleysReturned: number;
  trolleysOutstanding: number;
  totalDeliveries: number;
  completedDeliveries: number;
  pendingDeliveries: number;
  haulierId?: string;
  haulierName?: string;
  vehicleId?: string;
  vehicleName?: string;
  vehicleCapacity?: number;
  displayOrder: number;
  // Computed fill info
  totalTrolleysAssigned: number;
  fillPercentage: number;
}

export interface CustomerTrolleySummary {
  customerId: string;
  customerName: string;
  orgId: string;
  trolleysOutstanding: number;
  lastDeliveryDate?: string;
  lastReturnDate?: string;
  daysOutstanding?: number;
}

// --- Helper Types for UI ---

export interface DeliveryItemWithDetails extends DeliveryItem {
  order: {
    orderNumber: string;
    customerId: string;
    customerName: string;
    totalIncVat: number;
    requestedDeliveryDate?: string;
    shipToAddress?: {
      line1: string;
      line2?: string;
      city?: string;
      county?: string;
      eircode?: string;
    };
  };
}

export interface DeliveryRunWithItems extends DeliveryRun {
  items: DeliveryItemWithDetails[];
}

// --- Utility Types ---

export type DeliveryRunUpdateInput = Partial<Omit<DeliveryRun, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'runNumber'>>;
export type TrolleyUpdateInput = Partial<Omit<Trolley, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'trolleyNumber'>>;

// --- Dispatch Board ---

export type DispatchStage =
  | "to_pick"
  | "picking"
  | "ready_to_load"
  | "on_route";

export interface DispatchBoardOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  county?: string;
  eircode?: string;
  requestedDeliveryDate?: string;
  trolleysEstimated: number;
  // Stage (computed from pick_list + packing + delivery_item status)
  stage: DispatchStage;
  status: string; // Order status (e.g., "confirmed")
  totalIncVat: number;
  // Picking - uses individual picker (grower) instead of team
  pickListId?: string;
  pickerId?: string;
  pickerName?: string;
  pickListStatus?: string;
  pickProgress?: { picked: number; total: number };
  // Delivery
  deliveryItemId?: string;
  deliveryRunId?: string;
  deliveryRunNumber?: string;
  routeName?: string;
  routeColor?: string;
  haulierId?: string;
  haulierName?: string;
  deliveryItemStatus?: string;
}

export interface DispatchOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  requestedDeliveryDate?: string;
  totalIncVat: number;
  status: string;
  trolleysEstimated?: number;
  shipToAddress?: {
    line1: string;
    line2?: string;
    city?: string;
    county?: string;
    eircode?: string;
  };
  // Joined from pick_lists
  pickListId?: string;
  assignedTeamId?: string;
  pickingTeamName?: string;
  pickListStatus?: string;
  // Joined from delivery_items and delivery_runs
  deliveryItemId?: string;
  deliveryRunId?: string;
  deliveryRunNumber?: string;
  haulierId?: string;
  haulierName?: string;
  deliveryItemStatus?: DeliveryItemStatusType;
}

// ================================================
// QC FEEDBACK
// ================================================

export const QCIssueType = z.enum([
  'wrong_item',
  'wrong_qty',
  'quality_issue',
  'missing_label',
  'damaged',
  'other'
]);
export type QCIssueTypeValue = z.infer<typeof QCIssueType>;

export const QCActionRequired = z.enum(['repick', 'relabel', 'accept']);
export type QCActionRequiredValue = z.infer<typeof QCActionRequired>;

export const QCFeedbackSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  pickListId: z.string(),
  pickItemId: z.string().optional(),

  // Feedback details
  issueType: QCIssueType,
  notes: z.string().optional(),
  actionRequired: QCActionRequired.optional(),

  // Resolution
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
  resolutionNotes: z.string().optional(),

  // Notification
  pickerNotifiedAt: z.string().optional(),
  pickerAcknowledgedAt: z.string().optional(),

  // Metadata
  createdAt: z.string(),
  createdBy: z.string().optional(),

  // UI helpers
  pickerName: z.string().optional(),
  orderNumber: z.string().optional(),
});
export type QCFeedback = z.infer<typeof QCFeedbackSchema>;

export const CreateQCFeedbackSchema = z.object({
  pickListId: z.string(),
  pickItemId: z.string().optional(),
  issueType: QCIssueType,
  notes: z.string().optional(),
  actionRequired: QCActionRequired.optional(),
});
export type CreateQCFeedback = z.infer<typeof CreateQCFeedbackSchema>;

// ================================================
// TROLLEY LABELS
// ================================================

export const TrolleyLabelSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  orderId: z.string().optional(),
  pickListId: z.string().optional(),

  // Label identification
  labelCode: z.string(), // Encoded datamatrix content
  trolleyNumber: z.string().optional(),
  customerName: z.string().optional(),
  orderNumber: z.string().optional(),

  // Status
  printedAt: z.string().optional(),
  printedBy: z.string().optional(),
  scannedAt: z.string().optional(),
  scannedBy: z.string().optional(),

  // Metadata
  createdAt: z.string(),
});
export type TrolleyLabel = z.infer<typeof TrolleyLabelSchema>;

export const CreateTrolleyLabelSchema = z.object({
  orderId: z.string().optional(),
  pickListId: z.string().optional(),
  trolleyNumber: z.string().optional(),
  customerName: z.string().optional(),
  orderNumber: z.string().optional(),
});
export type CreateTrolleyLabel = z.infer<typeof CreateTrolleyLabelSchema>;

// ================================================
// PICKER TASK VIEW
// ================================================

export interface PickerTask {
  id: string;
  orgId: string;
  orderId: string;
  assignedUserId?: string;
  assignedTeamId?: string;
  sequence: number;
  status: string;
  qcStatus?: string;
  isPartial: boolean;
  mergeStatus?: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;

  // Order details
  orderNumber: string;
  orderStatus: string;
  requestedDeliveryDate?: string;
  customerName: string;

  // Progress
  totalItems: number;
  pickedItems: number;
  totalQty: number;
  pickedQty: number;

  // Feedback
  pendingFeedbackCount: number;
  unacknowledgedFeedbackCount: number;
}

// ================================================
// COLOR CODING
// ================================================

export const LOAD_COLORS = {
  // Blue shades for external hauliers
  external: [
    'bg-blue-100 border-blue-300 text-blue-800',
    'bg-blue-200 border-blue-400 text-blue-900',
    'bg-sky-100 border-sky-300 text-sky-800',
    'bg-cyan-100 border-cyan-300 text-cyan-800',
    'bg-indigo-100 border-indigo-300 text-indigo-800',
  ],
  // Other colors for internal loads
  internal: [
    'bg-emerald-100 border-emerald-300 text-emerald-800',
    'bg-amber-100 border-amber-300 text-amber-800',
    'bg-rose-100 border-rose-300 text-rose-800',
    'bg-purple-100 border-purple-300 text-purple-800',
    'bg-teal-100 border-teal-300 text-teal-800',
    'bg-orange-100 border-orange-300 text-orange-800',
    'bg-lime-100 border-lime-300 text-lime-800',
    'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800',
  ],
} as const;

export const STATUS_PILL_COLORS = {
  // Picking stages
  to_pick: 'bg-gray-100 text-gray-700 border-gray-300',
  picking: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  ready_to_load: 'bg-green-100 text-green-800 border-green-300',
  on_route: 'bg-blue-100 text-blue-800 border-blue-300',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-300',

  // Pick list status
  pending: 'bg-gray-100 text-gray-700 border-gray-300',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',

  // QC status
  qc_pending: 'bg-orange-100 text-orange-800 border-orange-300',
  qc_passed: 'bg-green-100 text-green-800 border-green-300',
  qc_failed: 'bg-red-100 text-red-800 border-red-300',

  // Delivery status
  loading: 'bg-amber-100 text-amber-800 border-amber-300',
  in_transit: 'bg-blue-100 text-blue-800 border-blue-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
  rescheduled: 'bg-purple-100 text-purple-800 border-purple-300',
} as const;

// Helper function to get load color based on haulier type and index
export function getLoadColor(isInternal: boolean, index: number): string {
  const colors = isInternal ? LOAD_COLORS.internal : LOAD_COLORS.external;
  return colors[index % colors.length];
}

// Helper function to get status pill color
export function getStatusPillColor(status: string): string {
  return STATUS_PILL_COLORS[status as keyof typeof STATUS_PILL_COLORS] || STATUS_PILL_COLORS.pending;
}

// ================================================
// DISPATCH ROLES
// ================================================

export type DispatchRole = 'manager' | 'picker' | 'driver';

export const DISPATCH_ROLE_MAP: Record<string, DispatchRole> = {
  admin: 'manager',
  owner: 'manager',
  editor: 'manager',
  staff: 'manager',
  sales: 'manager',
  picker: 'picker',
  grower: 'picker',
  driver: 'driver',
};

export function getDispatchRole(userRole: string): DispatchRole {
  return DISPATCH_ROLE_MAP[userRole] || 'picker';
}
