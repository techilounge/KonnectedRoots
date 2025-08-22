
'use server';

/**
 * @fileOverview An AI agent that suggests names based on historical trends, cultural origins, and naming conventions.
 *
 * - suggestName - A function that suggests a name for a person.
 * - SuggestNameInput - The input type for the suggestName function.
 * - SuggestNameOutput - The return type for the suggestName function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestNameInputSchema = z.object({
  gender: z.enum(['male', 'female']).describe('The gender of the person.'), // Updated gender
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
  return suggestNameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestNamePrompt',
  input: {schema: SuggestNameInputSchema},
  output: {schema: SuggestNameOutputSchema},
  prompt: `You are an expert in historical names and naming conventions.

  Based on the following information, suggest a name for the person and explain your reasoning.

  Gender: {{{gender}}}
  Origin: {{#if origin}}{{{origin}}}{{else}}Any{{/if}}
  Historical Period: {{#if historicalPeriod}}{{{historicalPeriod}}}{{else}}Any{{/if}}`,
});

const suggestNameFlow = ai.defineFlow(
  {
    name: 'suggestNameFlow',
    inputSchema: SuggestNameInputSchema,
    outputSchema: SuggestNameOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("AI failed to suggest a name.");
    }
    return output;
  }
);
