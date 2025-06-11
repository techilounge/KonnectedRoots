
"use server";

import { suggestName as suggestNameFlow, type SuggestNameInput, type SuggestNameOutput } from '@/ai/flows/suggest-name';
import { generateBiography as generateBiographyFlow, type GenerateBiographyInput, type GenerateBiographyOutput, GenerateBiographyInputSchema } from '@/ai/flows/generate-biography-flow';
import { z } from 'zod';

const SuggestNameActionSchema = z.object({
  gender: z.enum(['male', 'female']), 
  origin: z.string().optional(),
  historicalPeriod: z.string().optional(),
});

export async function handleSuggestName(input: SuggestNameInput): Promise<SuggestNameOutput | { error: string }> {
  const parsedInput = SuggestNameActionSchema.safeParse(input);

  if (!parsedInput.success) {
    return { error: "Invalid input: " + parsedInput.error.format()._errors.join(', ') };
  }

  try {
    const result = await suggestNameFlow(parsedInput.data);
    return result;
  } catch (error) {
    console.error("Error in handleSuggestName:", error);
    return { error: "Failed to suggest name. Please try again." };
  }
}

export async function handleGenerateBiography(input: GenerateBiographyInput): Promise<GenerateBiographyOutput | { error: string }> {
  const parsedInput = GenerateBiographyInputSchema.safeParse(input);

  if (!parsedInput.success) {
    console.error("Invalid input for biography generation:", parsedInput.error.format());
    return { error: "Invalid input for biography: " + parsedInput.error.format()._errors.join(', ') };
  }

  try {
    const result = await generateBiographyFlow(parsedInput.data);
    return result;
  } catch (error) {
    console.error("Error in handleGenerateBiography:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { error: `Failed to generate biography: ${errorMessage}. Please try again.` };
  }
}


// Example of another action (not used in this scaffold but for structure)
export async function saveFamilyTree(treeData: any) {
  // In a real app, this would save to a database
  console.log("Saving family tree:", treeData);
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { success: true, message: "Family tree saved (simulated)." };
}
