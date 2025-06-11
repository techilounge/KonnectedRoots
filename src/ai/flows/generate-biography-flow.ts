
'use server';
/**
 * @fileOverview An AI agent that generates a biography for a person based on provided details.
 *
 * - generateBiography - A function that calls the biography generation flow.
 * - GenerateBiographyInput - The input type for the generateBiography function.
 * - GenerateBiographyOutput - The return type for the generateBiography function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const GenerateBiographyInputSchema = z.object({
  firstName: z.string().optional().describe('The first name of the person.'),
  lastName: z.string().optional().describe('The last name of the person.'),
  birthDate: z.string().optional().describe('The birth date of the person (e.g., YYYY-MM-DD or descriptive text like "about 1885").'),
  placeOfBirth: z.string().optional().describe('The place of birth of the person.'),
  deathDate: z.string().optional().describe('The death date of the person (e.g., YYYY-MM-DD or descriptive text).'),
  placeOfDeath: z.string().optional().describe('The place of death of the person.'),
  occupation: z.string().optional().describe('The occupation or profession of the person.'),
  education: z.string().optional().describe('The educational background of the person.'),
  religion: z.string().optional().describe('The religious affiliation or faith tradition of the person.'),
  existingBiography: z.string().optional().describe('Any existing biography or notes to expand upon or use as reference.'),
});
export type GenerateBiographyInput = z.infer<typeof GenerateBiographyInputSchema>;

export const GenerateBiographyOutputSchema = z.object({
  biography: z.string().describe('The AI-generated biography for the person.'),
});
export type GenerateBiographyOutput = z.infer<typeof GenerateBiographyOutputSchema>;

export async function generateBiography(input: GenerateBiographyInput): Promise<GenerateBiographyOutput> {
  return generateBiographyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBiographyPrompt',
  input: {schema: GenerateBiographyInputSchema},
  output: {schema: GenerateBiographyOutputSchema},
  prompt: `You are a helpful assistant tasked with writing a concise and engaging biography.
Based on the following details for {{#if firstName}}{{{firstName}}}{{/if}} {{#if lastName}}{{{lastName}}}{{/if}}, craft a narrative biography.
Highlight key life events, achievements, and personal characteristics if information is available.
If dates are provided, use them to frame the timeline of their life.

Details:
{{#if firstName}}- First Name: {{{firstName}}}{{/if}}
{{#if lastName}}- Last Name: {{{lastName}}}{{/if}}
{{#if birthDate}}- Birth Date: {{{birthDate}}}{{/if}}
{{#if placeOfBirth}}- Place of Birth: {{{placeOfBirth}}}{{/if}}
{{#if deathDate}}- Death Date: {{{deathDate}}}{{/if}}
{{#if placeOfDeath}}- Place of Death: {{{placeOfDeath}}}{{/if}}
{{#if occupation}}- Occupation: {{{occupation}}}{{/if}}
{{#if education}}- Education: {{{education}}}{{/if}}
{{#if religion}}- Religion: {{{religion}}}{{/if}}
{{#if existingBiography}}- Existing Notes/Biography (for reference/expansion): {{{existingBiography}}}{{/if}}

Please generate a biography of a few paragraphs. If some information is missing, write the biography based on the available data and do not explicitly mention the missing fields.
Focus on creating a readable and informative summary.
`,
});

const generateBiographyFlow = ai.defineFlow(
  {
    name: 'generateBiographyFlow',
    inputSchema: GenerateBiographyInputSchema,
    outputSchema: GenerateBiographyOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("AI failed to generate a biography.");
    }
    return output;
  }
);
