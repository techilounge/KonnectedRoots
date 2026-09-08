
import 'server-only';
/**
 * @fileOverview An AI agent that generates a biography for a person based on provided details.
 *
 * - generateBiography - A function that calls the biography generation flow.
 * - GenerateBiographyInput - The input type for the generateBiography function.
 * - GenerateBiographyOutput - The return type for the generateBiography function.
 */

import { structured } from '@/lib/ai/gateway';
import {z} from 'zod';

const GenerateBiographyInputSchema = z.object({
  firstName: z.string().optional().describe('The first name of the person.'),
  lastName: z.string().optional().describe('The last name of the person.'),
  maidenName: z.string().optional().describe('The maiden name of the person, if applicable.'),
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

const GenerateBiographyOutputSchema = z.object({
  biography: z.string().describe('The AI-generated biography for the person.'),
});
export type GenerateBiographyOutput = z.infer<typeof GenerateBiographyOutputSchema>;

export async function generateBiography(input: GenerateBiographyInput): Promise<GenerateBiographyOutput> {
  const data = GenerateBiographyInputSchema.parse(input);
  return structured('generateBiography', "Write a concise biography of a few paragraphs using the provided facts. Preserve names, timeline and uncertainty. Do not invent missing facts or list missing fields." + '\nData: ' + JSON.stringify(data), GenerateBiographyOutputSchema, "{\"biography\":\"string\"}");
}
