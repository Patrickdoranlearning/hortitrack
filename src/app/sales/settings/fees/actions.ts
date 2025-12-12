'use server';

import { getSupabaseServerApp } from '@/server/db/supabase';
import { revalidatePath } from 'next/cache';
import { STANDARD_FEE_TYPES } from './constants';

export type FeeUnit = 'per_unit' | 'flat' | 'per_km' | 'percentage';

export type OrgFee = {
  id: string;
  orgId: string;
  feeType: string;
  name: string;
  description: string | null;
  amount: number;
  unit: FeeUnit;
  vatRate: number;
  isActive: boolean;
  isDefault: boolean;
  minOrderValue: number | null;
  maxAmount: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateFeeInput = {
  feeType: string;
  name: string;
  description?: string;
  amount: number;
  unit: FeeUnit;
  vatRate?: number;
  isActive?: boolean;
  isDefault?: boolean;
  minOrderValue?: number;
  maxAmount?: number;
  metadata?: Record<string, unknown>;
};

export type UpdateFeeInput = Partial<CreateFeeInput>;

// Helper to get supabase with any typing for org_fees table
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrgFeesTable(): Promise<any> {
  const supabase = await getSupabaseServerApp();
  // Cast to any to bypass type checking for tables not yet in generated types
  return (supabase as unknown as { from: (table: string) => unknown }).from('org_fees');
}

/**
 * Get all fees for the current organization
 */
export async function getOrgFees(): Promise<OrgFee[]> {
  const supabase = await getSupabaseServerApp();
  
  const { data: membership } = await supabase
    .from('org_memberships')
    .select('org_id')
    .single();

  if (!membership?.org_id) {
    return [];
  }

  const orgFeesTable = await getOrgFeesTable();
  const { data, error } = await orgFeesTable
    .select('*')
    .eq('org_id', membership.org_id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching org fees:', error);
    return [];
  }

  return (data || []).map(mapFeeRow);
}

/**
 * Get a specific fee by type
 */
export async function getOrgFeeByType(feeType: string): Promise<OrgFee | null> {
  const supabase = await getSupabaseServerApp();
  
  const { data: membership } = await supabase
    .from('org_memberships')
    .select('org_id')
    .single();

  if (!membership?.org_id) {
    return null;
  }

  const orgFeesTable = await getOrgFeesTable();
  const { data, error } = await orgFeesTable
    .select('*')
    .eq('org_id', membership.org_id)
    .eq('fee_type', feeType)
    .single();

  if (error || !data) {
    return null;
  }

  return mapFeeRow(data);
}

/**
 * Create a new fee configuration
 */
export async function createOrgFee(input: CreateFeeInput): Promise<{ success: boolean; fee?: OrgFee; error?: string }> {
  const supabase = await getSupabaseServerApp();
  
  const { data: membership } = await supabase
    .from('org_memberships')
    .select('org_id')
    .single();

  if (!membership?.org_id) {
    return { success: false, error: 'No organization found' };
  }

  const orgFeesTable = await getOrgFeesTable();
  const { data, error } = await orgFeesTable
    .insert({
      org_id: membership.org_id,
      fee_type: input.feeType,
      name: input.name,
      description: input.description || null,
      amount: input.amount,
      unit: input.unit,
      vat_rate: input.vatRate ?? 0,
      is_active: input.isActive ?? true,
      is_default: input.isDefault ?? false,
      min_order_value: input.minOrderValue ?? null,
      max_amount: input.maxAmount ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating org fee:', error);
    if (error.code === '23505') {
      return { success: false, error: 'A fee with this type already exists' };
    }
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/settings/fees');
  return { success: true, fee: mapFeeRow(data) };
}

/**
 * Update an existing fee configuration
 */
export async function updateOrgFee(feeId: string, input: UpdateFeeInput): Promise<{ success: boolean; error?: string }> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.amount !== undefined) updateData.amount = input.amount;
  if (input.unit !== undefined) updateData.unit = input.unit;
  if (input.vatRate !== undefined) updateData.vat_rate = input.vatRate;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;
  if (input.isDefault !== undefined) updateData.is_default = input.isDefault;
  if (input.minOrderValue !== undefined) updateData.min_order_value = input.minOrderValue;
  if (input.maxAmount !== undefined) updateData.max_amount = input.maxAmount;
  if (input.metadata !== undefined) updateData.metadata = input.metadata;

  const orgFeesTable = await getOrgFeesTable();
  const { error } = await orgFeesTable
    .update(updateData)
    .eq('id', feeId);

  if (error) {
    console.error('Error updating org fee:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/settings/fees');
  return { success: true };
}

/**
 * Delete a fee configuration
 */
export async function deleteOrgFee(feeId: string): Promise<{ success: boolean; error?: string }> {
  const orgFeesTable = await getOrgFeesTable();
  const { error } = await orgFeesTable
    .delete()
    .eq('id', feeId);

  if (error) {
    console.error('Error deleting org fee:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/settings/fees');
  return { success: true };
}

/**
 * Initialize default fees for an organization (call on first setup)
 */
export async function initializeDefaultFees(): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerApp();
  
  const { data: membership } = await supabase
    .from('org_memberships')
    .select('org_id')
    .single();

  if (!membership?.org_id) {
    return { success: false, error: 'No organization found' };
  }

  // Check if fees already exist
  const orgFeesTable = await getOrgFeesTable();
  const { data: existingFees } = await orgFeesTable
    .select('id')
    .eq('org_id', membership.org_id)
    .limit(1);

  if (existingFees && existingFees.length > 0) {
    return { success: true }; // Already initialized
  }

  // Insert default fees
  const defaultFees = [
    {
      org_id: membership.org_id,
      fee_type: STANDARD_FEE_TYPES.PRE_PRICING,
      name: 'Pre-pricing (RRP Labels)',
      description: 'Cost per unit for printing retail prices on pot labels',
      amount: 0.05, // 5 cents
      unit: 'per_unit',
      vat_rate: 23, // Standard VAT
      is_active: true,
      is_default: true,
    },
    {
      org_id: membership.org_id,
      fee_type: STANDARD_FEE_TYPES.DELIVERY_FLAT,
      name: 'Standard Delivery',
      description: 'Flat rate delivery charge',
      amount: 25.00,
      unit: 'flat',
      vat_rate: 23,
      is_active: true,
      is_default: false,
      min_order_value: 500, // Free delivery over €500
    },
  ];

  const { error } = await orgFeesTable.insert(defaultFees);

  if (error) {
    console.error('Error initializing default fees:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/settings/fees');
  return { success: true };
}

// Helper to map database row to typed object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFeeRow(row: any): OrgFee {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    feeType: row.fee_type as string,
    name: row.name as string,
    description: row.description as string | null,
    amount: Number(row.amount),
    unit: row.unit as FeeUnit,
    vatRate: Number(row.vat_rate),
    isActive: row.is_active as boolean,
    isDefault: row.is_default as boolean,
    minOrderValue: row.min_order_value ? Number(row.min_order_value) : null,
    maxAmount: row.max_amount ? Number(row.max_amount) : null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
