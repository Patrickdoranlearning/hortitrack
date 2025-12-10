// src/lib/sales/picking-types.ts
// Client-side type definitions for picking module

export type PickListStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type PickItemStatus = "pending" | "picked" | "short" | "substituted" | "skipped";

export interface PickingTeam {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  memberCount?: number;
}

export interface PickingTeamMember {
  id: string;
  teamId: string;
  userId: string;
  isLead: boolean;
  displayName?: string;
  email?: string;
}

export interface PickList {
  id: string;
  orgId: string;
  orderId: string;
  assignedTeamId?: string;
  sequence: number;
  status: PickListStatus;
  startedAt?: string;
  completedAt?: string;
  startedBy?: string;
  completedBy?: string;
  notes?: string;
  createdAt: string;
  // Joined fields
  orderNumber?: string;
  orderStatus?: string;
  customerName?: string;
  requestedDeliveryDate?: string;
  teamName?: string;
  totalItems?: number;
  pickedItems?: number;
  totalQty?: number;
  pickedQty?: number;
}

export interface PickItem {
  id: string;
  pickListId: string;
  orderItemId: string;
  targetQty: number;
  pickedQty: number;
  status: PickItemStatus;
  originalBatchId?: string;
  pickedBatchId?: string;
  substitutionReason?: string;
  notes?: string;
  pickedAt?: string;
  pickedBy?: string;
  locationHint?: string;
  // Joined fields
  productName?: string;
  plantVariety?: string;
  size?: string;
  originalBatchNumber?: string;
  pickedBatchNumber?: string;
  batchLocation?: string;
}

export interface AvailableBatch {
  id: string;
  batchNumber: string;
  quantity: number;
  location: string;
  grade?: string;
  status?: string;
}



