'use server';

/**
 * @fileOverview This file defines a Genkit flow for providing AI-powered plant care recommendations.
 *
 * The flow takes into account batch information, recent log history, and external weather data to suggest optimal care activities.
 *
 * @example
 * ```typescript
 * // Example usage:
 * const recommendations = await careRecommendations({
 *   batchInfo: { plantFamily: 'Roses', plantVariety: 'Peace', plantingDate: '2024-01-01' },
 *   logHistory: ['Watered on 2024-03-01', 'Fertilized on 2024-02-15'],
 *   location: { latitude: 53.35, longitude: -6.26 }, // Optional
 * });
 * console.log(recommendations.careActivities);
 * ```
 */

import {ai} from '@/ai/genkit';
import { z } from 'zod';
import { getWeather, DEFAULT_COORDS } from '@/lib/weather/open-meteo';

// Store location for the current flow execution
let currentLocation: { latitude: number; longitude: number } = DEFAULT_COORDS;

// Define the schema for the input data
const CareRecommendationsInputSchema = z.object({
  batchInfo: z
    .object({
      plantFamily: z.string().describe('The family of the plant in the batch.'),
      plantVariety: z.string().describe('The variety of the plant in the batch.'),
      plantingDate: z.string().describe('The date the batch was planted.'),
    })
    .describe('Information about the plant batch.'),
  logHistory: z
    .array(z.string())
    .describe('Recent log history of care activities for the batch.'),
  location: z
    .object({
      latitude: z.number().describe('Latitude coordinate for weather lookup.'),
      longitude: z.number().describe('Longitude coordinate for weather lookup.'),
    })
    .optional()
    .describe('Optional location for weather data. Defaults to Ireland if not provided.'),
});
export type CareRecommendationsInput =
  z.infer<typeof CareRecommendationsInputSchema>;

// Define the schema for the output data
const CareRecommendationsOutputSchema = z.object({
  careActivities: z
    .array(z.string())
    .describe('AI-powered recommendations for plant care activities.'),
});
export type CareRecommendationsOutput =
  z.infer<typeof CareRecommendationsOutputSchema>;

// Define the tool for fetching weather information
const getContextualWeatherInfo = ai.defineTool({
  name: 'getContextualWeatherInfo',
  description: 'Retrieves detailed, contextual weather information including temperature, humidity, and precipitation forecasts for the nursery\'s location.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    temperature: z.number().describe('The current temperature in Celsius.'),
    humidity: z.number().describe('The current humidity percentage.'),
    precipitationForecast: z.string().describe('The precipitation forecast for the next 7 days.'),
  }),
}, async () => {
  // Fetch real weather data from Open-Meteo API
  const weather = await getWeather(
    currentLocation.latitude,
    currentLocation.longitude
  );
  return weather;
});

// Define the Genkit prompt
const careRecommendationsPrompt = ai.definePrompt({
  name: 'careRecommendationsPrompt',
  model: 'googleai/gemini-2.0-flash',
  input: {schema: CareRecommendationsInputSchema},
  output: {schema: CareRecommendationsOutputSchema},
  tools: [getContextualWeatherInfo],
  prompt: `You are an expert horticulturalist providing plant care recommendations for a nursery.

  Your primary instruction is to **always** call the \`getContextualWeatherInfo\` tool to get the current weather conditions before making any recommendations.

  Based on the retrieved weather and the following batch information and recent log history, provide a list of care activities to optimize plant health and yield.

  Batch Information:
  - Plant Family: {{{batchInfo.plantFamily}}}
  - Plant Variety: {{{batchInfo.plantVariety}}}
  - Planting Date: {{{batchInfo.plantingDate}}}

  Log History:
  {{#each logHistory}}- {{{this}}}\n{{/each}}

  Given the plant type, consider the following when creating recommendations:
  - Watering needs based on weather and plant type.
  - Fertilization requirements.
  - Pruning schedule.
  - Pest control measures.

  Your final output must be a list of actionable care activities.
  `,  
});

// Define the Genkit flow
const careRecommendationsFlow = ai.defineFlow(
  {
    name: 'careRecommendationsFlow',
    inputSchema: CareRecommendationsInputSchema,
    outputSchema: CareRecommendationsOutputSchema,
  },
  async (input) => {
    // Set location for this flow execution
    currentLocation = input.location ?? DEFAULT_COORDS;
    
    const {output} = await careRecommendationsPrompt(input);
    return output!;
  }
);

/**
 * Provides AI-powered plant care recommendations based on batch information
 * and recent log history. It will use a tool to fetch real weather data.
 * @param input - The input data for generating care recommendations.
 * @returns A promise that resolves to the care recommendations.
 */
export async function careRecommendations(
  input: CareRecommendationsInput
): Promise<CareRecommendationsOutput> {
  return careRecommendationsFlow(input);
}
