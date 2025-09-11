'use server';

/**
 * @fileOverview This file defines a Genkit flow for a chatbot that answers
 * questions about a specific plant batch.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BatchSchema } from '@/lib/types';

// Define the input schema for the chatbot flow
const BatchChatInputSchema = z.object({
  batch: BatchSchema,
  query: z.string(),
});
export type BatchChatInput = z.infer<typeof BatchChatInputSchema>;

// Define the output schema for the chatbot flow
const BatchChatOutputSchema = z.object({
  response: z.string(),
});
export type BatchChatOutput = z.infer<typeof BatchChatOutputSchema>;

// Define the Genkit prompt
const batchChatPrompt = ai.definePrompt(
  {
    name: 'batchChatPrompt',
    input: { schema: BatchChatInputSchema },
    output: { schema: BatchChatOutputSchema },
    prompt: `You are an expert horticulturalist and data analyst for a nursery. Your task is to answer questions about a specific plant batch based on the JSON data provided. Be concise and helpful.

    Use the data to answer the user's question. Perform calculations if necessary (e.g., calculating days since planting).

    Batch Data:
    {{{JSONstringify batch}}}

    User's Question:
    "{{{query}}}"

    Your Answer:
    `,
    model: 'googleai/gemini-2.0-flash-preview',
    context: [
      {
        role: 'system',
        content:
          'Handlebars helper to stringify JSON objects. Use as `{{{JSONstringify anObject}}}`.',
      },
    ],
    config: {
      templateFormat: 'handlebars',
      helpers: {
        JSONstringify: (value: any) => JSON.stringify(value, null, 2),
      },
    },
  }
);


// Define the Genkit flow
const batchChatFlow = ai.defineFlow(
  {
    name: 'batchChatFlow',
    inputSchema: BatchChatInputSchema,
    outputSchema: BatchChatOutputSchema,
  },
  async (input) => {
    const { output } = await batchChatPrompt(input);
    return output!;
  }
);

/**
 * Generates an AI-powered response to a question about a batch.
 * @param input - The batch data and user query.
 * @returns A promise that resolves to the AI's response.
 */
export async function batchChat(
  input: BatchChatInput
): Promise<BatchChatOutput> {
  return batchChatFlow(input);
}
