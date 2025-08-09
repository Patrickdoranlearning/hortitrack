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
 *   batchInfo: { plantType: 'Roses', plantingDate: '2024-01-01' },
 *   logHistory: ['Watered on 2024-03-01', 'Fertilized on 2024-02-15'],
 *   weatherInfo: { temperature: 20, humidity: 70 },
 * });
 * console.log(recommendations.careActivities);
 * ```
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the schema for the input data
const CareRecommendationsInputSchema = z.object({
  batchInfo: z
    .object({
      plantType: z.string().describe('The type of plant in the batch.'),
      plantingDate: z.string().describe('The date the batch was planted.'),
    })
    .describe('Information about the plant batch.'),
  logHistory: z
    .array(z.string())
    .describe('Recent log history of care activities for the batch.'),
  weatherInfo: z
    .object({
      temperature: z.number().describe('The current temperature in Celsius.'),
      humidity: z.number().describe('The current humidity percentage.'),
    })
    .describe('External weather information.'),
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
  description: 'Retrieves detailed, contextual weather information including temperature, humidity, and precipitation forecasts.',
  inputSchema: z.object({
    plantType: z.string().describe('The type of plant for which weather information is needed.'),
  }),
  outputSchema: z.object({
    temperature: z.number().describe('The current temperature in Celsius.'),
    humidity: z.number().describe('The current humidity percentage.'),
    precipitationForecast: z.string().describe('The precipitation forecast.'),
  }),
}, async (input) => {
  console.log('Plant type is ', input.plantType)
  // Simulate fetching weather information. In a real application, this
  // would call an external weather API.
  return {
    temperature: 25,
    humidity: 60,
    precipitationForecast: 'No rain expected in the next 7 days.',
  };
});

// Define the Genkit prompt
const careRecommendationsPrompt = ai.definePrompt({
  name: 'careRecommendationsPrompt',
  input: {schema: CareRecommendationsInputSchema},
  output: {schema: CareRecommendationsOutputSchema},
  tools: [getContextualWeatherInfo],
  prompt: `You are an expert horticulturalist providing plant care recommendations.

  Based on the following batch information, recent log history, and weather information, provide a list of care activities to optimize plant health and yield.

  Batch Information:
  Plant Type: {{{batchInfo.plantType}}}
  Planting Date: {{{batchInfo.plantingDate}}}

  Log History:
  {{#each logHistory}}- {{{this}}}\n{{/each}}

  Weather Information:
  Temperature: {{{weatherInfo.temperature}}}°C
  Humidity: {{{weatherInfo.humidity}}}%

  Given the plant type, consider the following when creating recommendations:
  - Watering needs
  - Fertilization requirements
  - Pruning schedule
  - Pest control

  Make sure to use the getContextualWeatherInfo tool to refine your plant care recommendations based on localized weather.

  Care Activities:
  `,  
});

// Define the Genkit flow
const careRecommendationsFlow = ai.defineFlow(
  {
    name: 'careRecommendationsFlow',
    inputSchema: CareRecommendationsInputSchema,
    outputSchema: CareRecommendationsOutputSchema,
  },
  async input => {
    // Before calling the prompt, invoke the getContextualWeatherInfo tool.
    //const weatherInfo = await getContextualWeatherInfo({plantType: input.batchInfo.plantType});
    //console.log('WeatherInfo is ', weatherInfo);
    //const promptInput = {...input, weatherInfo: weatherInfo};

    const {output} = await careRecommendationsPrompt(input);

    return output!;
  }
);

/**
 * Provides AI-powered plant care recommendations based on batch information,
 * recent log history, and external weather data.
 * @param input - The input data for generating care recommendations.
 * @returns A promise that resolves to the care recommendations.
 */
export async function careRecommendations(
  input: CareRecommendationsInput
): Promise<CareRecommendationsOutput> {
  return careRecommendationsFlow(input);
}
