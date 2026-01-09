'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a production protocol
 * from a successful plant batch.
 *
 * The flow analyzes the log history and batch details to create a reusable
 * set of instructions for future cultivation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BatchSchema } from '@/lib/types';
import { ProductionProtocolOutputSchema, type ProductionProtocolOutput } from '@/lib/protocol-types';


// Define the Genkit prompt
const productionProtocolPrompt = ai.definePrompt({
  name: 'productionProtocolPrompt',
  model: 'googleai/gemini-2.0-flash',
  input: { schema: BatchSchema },
  output: { schema: ProductionProtocolOutputSchema },
  prompt: `You are an expert horticultural consultant tasked with creating a standardized production protocol based on a highly successful plant batch. Analyze the provided batch data to extract key timings, actions, and insights.

  The goal is to create a clear, step-by-step guide that can be used to replicate the success of this batch in future production cycles.

  Batch Information:
  - Plant Family: {{{plantFamily}}}
  - Plant Variety: {{{plantVariety}}}
  - Planting Date: {{{plantingDate}}}
  - Final Status: {{{status}}}
  - Initial Quantity: {{{initialQuantity}}}
  - Final Quantity: {{{quantity}}}
  - Container Size: {{{size}}}
  - Supplier: {{{supplier}}}

  Log History (Action and Date):
  {{#each logHistory}}
  - "{{this.action}}" on {{this.date}}
  {{/each}}

  Based on the log history, create a production timeline. Calculate the number of days from the initial planting date for each significant event.

  Generate a concise, professional production protocol. The protocol should include a summary, a detailed timeline of actions (with day numbers), and a list of key recommendations for future batches. The tone should be instructional and easy to follow for nursery staff.`,
});

// Define the Genkit flow
const productionProtocolFlow = ai.defineFlow(
  {
    name: 'productionProtocolFlow',
    inputSchema: BatchSchema,
    outputSchema: ProductionProtocolOutputSchema,
  },
  async (batch) => {
    const { output } = await productionProtocolPrompt(batch);
    return output!;
  }
);

/**
 * Generates an AI-powered production protocol from a batch's history.
 * @param batch - The batch data to analyze.
 * @returns A promise that resolves to the generated production protocol.
 */
export async function productionProtocol(
  batch: z.infer<typeof BatchSchema>
): Promise<ProductionProtocolOutput> {
  return productionProtocolFlow(batch);
}
