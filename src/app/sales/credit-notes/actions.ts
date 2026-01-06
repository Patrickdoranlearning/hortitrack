'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type CreditNoteStatus = 'draft' | 'issued' | 'void';

export interface CreateCreditNoteInput {
  customerId: string;
  invoiceId?: string;
  notes?: string;
  items: Array<{
    skuId: string | null;
    description: string;
    quantity: number;
    unitPriceExVat: number;
    vatRate: number;
  }>;
}

export interface CreditNote {
  id: string;
  creditNumber: string;
  customerId: string;
  status: CreditNoteStatus;
  issueDate: string;
  subtotalExVat: number;
  vatAmount: number;
  totalIncVat: number;
  notes: string | null;
  createdAt: string;
}

/**
 * Generate a unique credit note number
 */
async function generateCreditNumber(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CN-${year}-`;
  
  // Get the latest credit note number for this year
  const { data: latest } = await supabase
    .from('credit_notes')
    .select('credit_number')
    .eq('org_id', orgId)
    .like('credit_number', `${prefix}%`)
    .order('credit_number', { ascending: false })
    .limit(1)
    .single();

  let sequence = 1;
  if (latest?.credit_number) {
    const lastSeq = parseInt(latest.credit_number.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`;
}

/**
 * Create a new credit note
 */
export async function createCreditNoteAction(input: CreateCreditNoteInput): Promise<{
  success?: boolean;
  creditNoteId?: string;
  creditNumber?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Get user's org
  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Organization not found' };
  }

  const orgId = membership.org_id;

  // Calculate totals
  const subtotalExVat = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceExVat,
    0
  );
  const vatAmount = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceExVat * (item.vatRate / 100),
    0
  );
  const totalIncVat = subtotalExVat + vatAmount;

  // Generate credit number
  const creditNumber = await generateCreditNumber(supabase, orgId);

  // Create the credit note
  const { data: creditNote, error: creditNoteError } = await supabase
    .from('credit_notes')
    .insert({
      org_id: orgId,
      customer_id: input.customerId,
      credit_number: creditNumber,
      status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      notes: input.notes || null,
      subtotal_ex_vat: subtotalExVat,
      vat_amount: vatAmount,
      total_inc_vat: totalIncVat,
      currency: 'EUR',
    })
    .select()
    .single();

  if (creditNoteError || !creditNote) {
    console.error('Error creating credit note:', creditNoteError);
    return { error: 'Failed to create credit note' };
  }

  // Create credit note items
  const creditNoteItems = input.items.map((item) => ({
    credit_note_id: creditNote.id,
    sku_id: item.skuId,
    description: item.description,
    quantity: item.quantity,
    unit_price_ex_vat: item.unitPriceExVat,
    vat_rate: item.vatRate,
    line_total_ex_vat: item.quantity * item.unitPriceExVat,
    line_vat_amount: item.quantity * item.unitPriceExVat * (item.vatRate / 100),
  }));

  const { error: itemsError } = await supabase
    .from('credit_note_items')
    .insert(creditNoteItems);

  if (itemsError) {
    console.error('Error creating credit note items:', itemsError);
    // Delete the credit note if items failed
    await supabase.from('credit_notes').delete().eq('id', creditNote.id);
    return { error: 'Failed to create credit note items' };
  }

  // If linked to an invoice, create allocation
  if (input.invoiceId) {
    await supabase.from('credit_allocations').insert({
      credit_note_id: creditNote.id,
      invoice_id: input.invoiceId,
      amount: totalIncVat,
    });
  }

  revalidatePath('/sales/credit-notes');
  revalidatePath('/sales/invoices');

  return {
    success: true,
    creditNoteId: creditNote.id,
    creditNumber: creditNote.credit_number,
  };
}

/**
 * Issue a credit note (change status from draft to issued)
 */
export async function issueCreditNoteAction(creditNoteId: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Get the credit note
  const { data: creditNote, error: fetchError } = await supabase
    .from('credit_notes')
    .select('*, credit_allocations(invoice_id, amount)')
    .eq('id', creditNoteId)
    .single();

  if (fetchError || !creditNote) {
    return { error: 'Credit note not found' };
  }

  if (creditNote.status !== 'draft') {
    return { error: 'Credit note is not in draft status' };
  }

  // Update status to issued
  const { error: updateError } = await supabase
    .from('credit_notes')
    .update({
      status: 'issued',
      issue_date: new Date().toISOString().split('T')[0],
    })
    .eq('id', creditNoteId);

  if (updateError) {
    console.error('Error issuing credit note:', updateError);
    return { error: 'Failed to issue credit note' };
  }

  // If there are allocations, update the invoice balance
  const allocations = creditNote.credit_allocations as Array<{ invoice_id: string; amount: number }> | null;
  if (allocations && allocations.length > 0) {
    for (const allocation of allocations) {
      // Get current invoice
      const { data: invoice } = await supabase
        .from('invoices')
        .select('amount_credited, total_inc_vat')
        .eq('id', allocation.invoice_id)
        .single();

      if (invoice) {
        const newAmountCredited = (invoice.amount_credited || 0) + allocation.amount;
        const newBalanceDue = invoice.total_inc_vat - newAmountCredited;

        await supabase
          .from('invoices')
          .update({
            amount_credited: newAmountCredited,
            balance_due: newBalanceDue,
            updated_at: new Date().toISOString(),
          })
          .eq('id', allocation.invoice_id);
      }
    }
  }

  revalidatePath('/sales/credit-notes');
  revalidatePath('/sales/invoices');
  revalidatePath(`/sales/credit-notes/${creditNoteId}`);

  return { success: true };
}

/**
 * Void a credit note
 */
export async function voidCreditNoteAction(creditNoteId: string, reason: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Get the credit note
  const { data: creditNote, error: fetchError } = await supabase
    .from('credit_notes')
    .select('*, credit_allocations(invoice_id, amount)')
    .eq('id', creditNoteId)
    .single();

  if (fetchError || !creditNote) {
    return { error: 'Credit note not found' };
  }

  if (creditNote.status === 'void') {
    return { error: 'Credit note is already voided' };
  }

  // If it was issued, reverse the invoice credits
  if (creditNote.status === 'issued') {
    const allocations = creditNote.credit_allocations as Array<{ invoice_id: string; amount: number }> | null;
    if (allocations && allocations.length > 0) {
      for (const allocation of allocations) {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('amount_credited, total_inc_vat')
          .eq('id', allocation.invoice_id)
          .single();

        if (invoice) {
          const newAmountCredited = Math.max(0, (invoice.amount_credited || 0) - allocation.amount);
          const newBalanceDue = invoice.total_inc_vat - newAmountCredited;

          await supabase
            .from('invoices')
            .update({
              amount_credited: newAmountCredited,
              balance_due: newBalanceDue,
              updated_at: new Date().toISOString(),
            })
            .eq('id', allocation.invoice_id);
        }
      }
    }
  }

  // Update status to void
  const { error: updateError } = await supabase
    .from('credit_notes')
    .update({
      status: 'void',
      notes: creditNote.notes 
        ? `${creditNote.notes}\n\nVOIDED: ${reason}`
        : `VOIDED: ${reason}`,
    })
    .eq('id', creditNoteId);

  if (updateError) {
    console.error('Error voiding credit note:', updateError);
    return { error: 'Failed to void credit note' };
  }

  revalidatePath('/sales/credit-notes');
  revalidatePath('/sales/invoices');
  revalidatePath(`/sales/credit-notes/${creditNoteId}`);

  return { success: true };
}

/**
 * Get all credit notes for the organization
 */
export async function getCreditNotesAction(): Promise<{
  creditNotes?: CreditNote[];
  error?: string;
}> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Organization not found' };
  }

  const { data, error } = await supabase
    .from('credit_notes')
    .select(`
      id,
      credit_number,
      customer_id,
      status,
      issue_date,
      subtotal_ex_vat,
      vat_amount,
      total_inc_vat,
      notes,
      created_at,
      customer:customers(name)
    `)
    .eq('org_id', membership.org_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching credit notes:', error);
    return { error: 'Failed to fetch credit notes' };
  }

  const creditNotes: CreditNote[] = (data || []).map((cn: unknown) => {
    const c = cn as {
      id: string;
      credit_number: string;
      customer_id: string;
      status: CreditNoteStatus;
      issue_date: string;
      subtotal_ex_vat: number;
      vat_amount: number;
      total_inc_vat: number;
      notes: string | null;
      created_at: string;
    };
    return {
      id: c.id,
      creditNumber: c.credit_number,
      customerId: c.customer_id,
      status: c.status,
      issueDate: c.issue_date,
      subtotalExVat: c.subtotal_ex_vat,
      vatAmount: c.vat_amount,
      totalIncVat: c.total_inc_vat,
      notes: c.notes,
      createdAt: c.created_at,
    };
  });

  return { creditNotes };
}





