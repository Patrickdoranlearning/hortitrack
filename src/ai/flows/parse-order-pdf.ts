'use server';

/**
 * Genkit flow for extracting structured order data from a supplier PDF
 * using Gemini 2.0 Flash multimodal.
 *
 * Accepts a base64-encoded PDF and returns structured OrderExtraction data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { OrderExtraction } from '@/lib/ai/match-extraction';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const PdfLineItemSchema = z.object({
  quantity: z.number().int().min(1).describe('Number of items ordered (Aantal)'),
  variety_name: z
    .string()
    .describe('Full plant variety name including cultivar, e.g. "Erica carnea \'Challenger\'"'),
  genus: z.string().optional().describe('Genus if identifiable, e.g. "Erica"'),
  species: z.string().optional().describe('Species if identifiable, e.g. "carnea"'),
  cultivar: z.string().optional().describe('Cultivar name if in quotes, e.g. "Challenger"'),
  size_description: z.string().describe('Raw size text from PDF, e.g. "286 gts tray"'),
  cell_multiple: z
    .number()
    .optional()
    .describe('Number of cells per tray if applicable, e.g. 286'),
  container_type: z
    .string()
    .optional()
    .describe('Container type: "tray" or "pot" based on the size description'),
  unit_price: z.number().optional().describe('Price per unit in euros'),
  line_total: z.number().optional().describe('Total price for this line in euros'),
});

const PdfExtractionSchema = z.object({
  supplier_name: z.string().describe('Name of the supplier company'),
  order_reference: z.string().describe('Order number / reference'),
  document_date: z.string().describe('Document date in YYYY-MM-DD format'),
  line_items: z.array(PdfLineItemSchema).describe('All line items from the order'),
  total_amount: z.number().optional().describe('Total order amount in euros'),
});

// ─── Flow Definition ────────────────────────────────────────────────────────

const parseOrderPdfFlow = ai.defineFlow(
  {
    name: 'parseOrderPdf',
    inputSchema: z.object({
      pdfBase64: z.string(),
      mimeType: z.string().default('application/pdf'),
    }),
    outputSchema: PdfExtractionSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: [
        {
          media: {
            contentType: input.mimeType as 'application/pdf',
            url: `data:${input.mimeType};base64,${input.pdfBase64}`,
          },
        },
        {
          text: `You are a data extraction specialist for a horticultural nursery.

Extract ALL structured data from this purchase order confirmation PDF.

This is likely a Dutch "INKOOPBEVESTIGING" (purchase confirmation) from a plant supplier, but it could be in any language.

Common Dutch column headers and their meanings:
- "Aantal" = Quantity
- "Omschrijving" = Description (plant variety name)
- "Mvl" = Multiplication factor
- "Maat" = Size (e.g., "286 gts tray" means 286-cell plug tray)
- "Ref." = Reference
- "p./stuk" = Price per unit
- "Bedrag" = Amount (line total)

For EACH line item, extract:
1. quantity: The number from the quantity column
2. variety_name: The full plant name (e.g., "Erica carnea 'Challenger'")
3. genus: The genus part (first word of the botanical name)
4. species: The species epithet (second word if botanical)
5. cultivar: The cultivar name (typically in quotes)
6. size_description: Raw text from the size column
7. cell_multiple: If size contains a number (e.g., "286 gts tray" -> 286, "77 gts tray" -> 77)
8. container_type: "tray" or "pot" based on the size description
9. unit_price: Price per unit
10. line_total: Total for this line

For the document header, extract:
- supplier_name: The company issuing the document
- order_reference: The order/confirmation number
- document_date: Convert to YYYY-MM-DD format (handle Dutch month names: januari, februari, maart, april, mei, juni, juli, augustus, september, oktober, november, december)
- total_amount: The total order amount

Return the data as valid JSON matching the schema. Extract EVERY line item — do not skip any rows.`,
        },
      ],
      output: { schema: PdfExtractionSchema },
    });

    if (!output) {
      throw new Error('Failed to extract data from PDF');
    }

    return output;
  }
);

// ─── Public API ─────────────────────────────────────────────────────────────

export async function parseOrderPdf(pdfBase64: string): Promise<OrderExtraction> {
  const result = await parseOrderPdfFlow({ pdfBase64, mimeType: 'application/pdf' });

  return {
    supplier_name: result.supplier_name,
    order_reference: result.order_reference,
    document_date: result.document_date,
    total_amount: result.total_amount ?? null,
    line_items: result.line_items.map((item) => ({
      quantity: item.quantity,
      variety_name: item.variety_name,
      genus: item.genus,
      species: item.species,
      cultivar: item.cultivar,
      size_description: item.size_description,
      cell_multiple: item.cell_multiple,
      container_type: item.container_type,
      unit_price: item.unit_price,
      line_total: item.line_total,
    })),
  };
}
