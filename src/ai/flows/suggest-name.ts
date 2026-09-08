
import 'server-only';

/**
 * @fileOverview An AI agent that suggests names based on historical trends, cultural origins, and naming conventions.
 *
 * - suggestName - A function that suggests a name for a person.
 * - SuggestNameInput - The input type for the suggestName function.
 * - SuggestNameOutput - The return type for the suggestName function.
 */

import { structured } from '@/lib/ai/gateway';
import { z } from 'zod';

const SuggestNameInputSchema = z.object({
  gender: z.enum(['male', 'female', 'other', 'unknown']).describe('The gender of the person.'), // Updated gender
  origin: z.string().optional().describe('The cultural origin of the person.'),
  historicalPeriod: z.string().optional().describe('The historical period the person lived in.'),
});
export type SuggestNameInput = z.infer<typeof SuggestNameInputSchema>;

const SuggestNameOutputSchema = z.object({
  name: z.string().describe('The suggested name for the person.'),
  reason: z.string().describe('The reason for suggesting the name.'),
});
export type SuggestNameOutput = z.infer<typeof SuggestNameOutputSchema>;

export async function suggestName(input: SuggestNameInput): Promise<SuggestNameOutput> {
  const data = SuggestNameInputSchema.parse(input);
  return structured('suggestName', "Suggest a historically and culturally appropriate name for the provided gender, origin and period. Explain the reasoning." + '\nData: ' + JSON.stringify(data), SuggestNameOutputSchema, "{\"name\":\"string\",\"reason\":\"string\"}");
}
