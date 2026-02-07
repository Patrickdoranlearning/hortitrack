'use server';

import { getSupabaseServerApp } from '@/server/db/supabase';
import { revalidatePath } from 'next/cache';
import { STANDARD_FEE_TYPES } from './constants';
import type { Database } from '@/types/supabase';
import { logError } from '@/lib/log';

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

// Type for org_fees table row from database
type OrgFeeRow = Database['public']['Tables']['org_fees']['Row'];
type OrgFeeInsert = Database['public']['Tables']['org_fees']['Insert'];
type OrgFeeUpdate = Database['public']['Tables']['org_fees']['Update'];

/**
 * Get all fees for the current organization
 */
export async function getOrgFees(): Promise<OrgFee[]> {
  // getSupabaseServerApp() creates a Supabase client with the current user's auth context
  // It handles getCurrentUser() internally and returns a properly authenticated client
  const supabase = await getSupabaseServerApp();
  
  const { data: membership } = await supabase
    .from('org_memberships')
    .select('org_id')
    .single();

  if (!membership?.org_id) {
    return [];
  }

  const { data, error } = await supabase
    .from('org_fees')
    .select('*')
    .eq('org_id', membership.org_id)
    .order('created_at', { ascending: true });

  if (error) {
    logError('Error fetching org fees', { error: error?.message || String(error) });
    return [];
  }

  return (data || []).map(mapFeeRow);
}

/**
 * Get a specific fee by type
 */
export async function getOrgFeeByType(feeType: string): Promise<OrgFee | null> {
  // getSupabaseServerApp() creates a Supabase client with the current user's auth context
  // It handles getCurrentUser() internally and returns a properly authenticated client
  const supabase = await getSupabaseServerApp();
  
  const { data: membership } = await supabase
    .from('org_memberships')
    .select('org_id')
    .single();

  if (!membership?.org_id) {
    return null;
  }

  const { data, error } = await supabase
    .from('org_fees')
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

  const { data, error } = await supabase
    .from('org_fees')
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
    logError('Error creating org fee', { error: error?.message || String(error) });
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

  const supabase = await getSupabaseServerApp();
  const { error } = await supabase
    .from('org_fees')
    .update(updateData)
    .eq('id', feeId);

  if (error) {
    logError('Error updating org fee', { error: error?.message || String(error) });
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/settings/fees');
  return { success: true };
}

/**
 * Delete a fee configuration
 */
export async function deleteOrgFee(feeId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase
    .from('org_fees')
    .delete()
    .eq('id', feeId);

  if (error) {
    logError('Error deleting org fee', { error: error?.message || String(error) });
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
  const { data: existingFees } = await supabase
    .from('org_fees')
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

  const { error } = await supabase.from('org_fees').insert(defaultFees);

  if (error) {
    logError('Error initializing default fees', { error: error?.message || String(error) });
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/settings/fees');
  return { success: true };
}

// Helper to map database row to typed object
function mapFeeRow(row: OrgFeeRow): OrgFee {
  return {
    id: row.id,
    orgId: row.org_id,
    feeType: row.fee_type,
    name: row.name,
    description: row.description,
    amount: row.amount,
    unit: row.unit as FeeUnit,
    vatRate: row.vat_rate,
    isActive: row.is_active,
    isDefault: row.is_default,
    minOrderValue: row.min_order_value,
    maxAmount: row.max_amount,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}
