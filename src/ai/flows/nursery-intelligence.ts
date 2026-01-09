'use server';

/**
 * @fileOverview This file defines the "Nursery Intelligence" flow.
 * It's a general-purpose AI agent that has access to nursery data (batches, stock, orders, customers).
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getUserAndOrg } from '@/server/auth/org';
import { getSaleableProducts } from '@/server/sales/queries.server';

// Define tools for the AI

const searchAllBatches = ai.defineTool(
  {
    name: 'searchAllBatches',
    description: 'Searches ALL plant batches including those still growing, propagating, or ready for sale. Use this to find total quantities of plants.',
    inputSchema: z.object({
      variety: z.string().optional().describe('Part of the plant variety name (e.g., "Kramers Red", "Erica", "Lavender")'),
      size: z.string().optional().describe('The pot size (e.g., "1.5L", "3L")'),
      status: z.string().optional().describe('Filter by status: propagating, growing, hardening, ready, saleable'),
    }),
    outputSchema: z.array(z.object({
      batchNumber: z.string(),
      varietyName: z.string(),
      sizeName: z.string(),
      quantity: z.number(),
      status: z.string(),
      locationName: z.string().nullable(),
    })),
  },
  async (input) => {
    try {
      const { supabase } = await getUserAndOrg();
      
      let query = supabase
        .from('v_batch_search')
        .select('batch_number, variety_name, size_name, quantity, status, location_name')
        .gt('quantity', 0)
        .order('quantity', { ascending: false })
        .limit(25);

      if (input.variety) {
        query = query.ilike('variety_name', `%${input.variety}%`);
      }
      if (input.size) {
        query = query.ilike('size_name', `%${input.size}%`);
      }
      if (input.status) {
        query = query.eq('status', input.status);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('searchAllBatches error:', error);
        return [];
      }

      return (data || []).map(b => ({
        batchNumber: b.batch_number || 'N/A',
        varietyName: b.variety_name || 'Unknown',
        sizeName: b.size_name || 'Unknown',
        quantity: b.quantity || 0,
        status: b.status || 'unknown',
        locationName: b.location_name || null,
      }));
    } catch (error) {
      console.error('searchAllBatches error:', error);
      return [];
    }
  }
);

const getStockSummary = ai.defineTool(
  {
    name: 'getStockSummary',
    description: 'Gets a summary of all stock grouped by variety. Use this to get an overview of what plants are available.',
    inputSchema: z.object({}),
    outputSchema: z.array(z.object({
      varietyName: z.string(),
      totalQuantity: z.number(),
      batchCount: z.number(),
    })),
  },
  async () => {
    try {
      const { supabase } = await getUserAndOrg();
      
      const { data, error } = await supabase
        .from('v_batch_search')
        .select('variety_name, quantity')
        .gt('quantity', 0);

      if (error || !data) return [];

      // Group by variety
      const grouped = data.reduce((acc: Record<string, { total: number; count: number }>, b) => {
        const name = b.variety_name || 'Unknown';
        if (!acc[name]) acc[name] = { total: 0, count: 0 };
        acc[name].total += b.quantity || 0;
        acc[name].count += 1;
        return acc;
      }, {});

      return Object.entries(grouped)
        .map(([name, stats]) => ({
          varietyName: name,
          totalQuantity: stats.total,
          batchCount: stats.count,
        }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 20);
    } catch (error) {
      console.error('getStockSummary error:', error);
      return [];
    }
  }
);

const getCustomerOrders = ai.defineTool(
  {
    name: 'getCustomerOrders',
    description: 'Retrieves recent orders for a specific customer. Call this when the user asks about a customer\'s orders or purchase history.',
    inputSchema: z.object({
      customerName: z.string().describe('The name of the customer (e.g., "Windyridge")'),
      limit: z.number().optional().default(5).describe('Number of orders to return'),
    }),
    outputSchema: z.array(z.object({
      orderNumber: z.string(),
      status: z.string(),
      createdAt: z.string(),
      totalIncVat: z.number().nullable(),
      requestedDeliveryDate: z.string().nullable(),
    })),
  },
  async (input) => {
    try {
      const { supabase } = await getUserAndOrg();
      
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name')
        .ilike('name', `%${input.customerName}%`)
        .limit(1);

      if (!customers || customers.length === 0) return [];

      const customerId = customers[0].id;

      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(input.limit || 5);

      return (orders || []).map(o => ({
        orderNumber: o.order_number || 'N/A',
        status: o.status || 'unknown',
        createdAt: o.created_at || '',
        totalIncVat: o.total_inc_vat ?? null,
        requestedDeliveryDate: o.requested_delivery_date ?? null,
      }));
    } catch (error) {
      console.error('getCustomerOrders error:', error);
      return [];
    }
  }
);

export async function askNurseryIntelligence(query: string): Promise<{ response: string }> {
  try {
    const { text } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      tools: [searchAllBatches, getStockSummary, getCustomerOrders],
      prompt: `You are "HortiTrack Intelligence", an AI assistant for a plant nursery.

You have access to these tools:
1. searchAllBatches - Search for specific plant varieties (by name, size, or status)
2. getStockSummary - Get an overview of all varieties and quantities
3. getCustomerOrders - Look up a customer's recent orders

IMPORTANT: Always use the tools to look up real data. Never make up numbers.

For stock questions, use searchAllBatches with the variety name. For a general overview, use getStockSummary.

User's question: "${query}"

Look up the relevant data and provide a helpful, concise answer:`,
    });

    return { response: text || "I couldn't generate a response. Please try again." };
  } catch (error: any) {
    console.error('askNurseryIntelligence error:', error);
    throw error;
  }
}

export type NurseryIntelligenceInput = { query: string };
