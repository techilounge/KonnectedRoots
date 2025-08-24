
"use server";

import { suggestName as suggestNameFlow, type SuggestNameInput, type SuggestNameOutput } from '@/ai/flows/suggest-name';
import { generateBiography as generateBiographyFlow, type GenerateBiographyInput, type GenerateBiographyOutput } from '@/ai/flows/generate-biography-flow';
import { z } from 'zod';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from '@/lib/firebase/clients';
import { getAuth } from 'firebase/auth';

const storage = getStorage(app);

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

// Define the Zod schema for input validation directly in the action file
const HandleGenerateBiographyInputSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  maidenName: z.string().optional(),
  birthDate: z.string().optional(),
  placeOfBirth: z.string().optional(),
  deathDate: z.string().optional(),
  placeOfDeath: z.string().optional(),
  occupation: z.string().optional(),
  education: z.string().optional(),
  religion: z.string().optional(),
  existingBiography: z.string().optional(),
});

export async function handleGenerateBiography(input: GenerateBiographyInput): Promise<GenerateBiographyOutput | { error: string }> {
  const parsedInput = HandleGenerateBiographyInputSchema.safeParse(input);

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

export async function handleUploadProfilePicture(formData: FormData): Promise<{ downloadURL: string } | { error: string }> {
  const file = formData.get('profilePicture') as File;
  const treeId = formData.get('treeId') as string;
  const personId = formData.get('personId') as string;

  if (!file || !treeId || !personId) {
    return { error: "Missing required data for file upload." };
  }
  
  // Note: In a real app, you'd get the current user's ID from a session, not assume auth().currentUser
  // This is a simplified example. You should add proper authentication checks here.

  try {
    // Sanitize filename
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const storageRef = ref(storage, `trees/${treeId}/people/${personId}/${safeFilename}`);
    
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return { downloadURL };
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { error: `File upload failed: ${errorMessage}` };
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

