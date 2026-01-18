
"use server";

import { suggestName as suggestNameFlow, type SuggestNameInput, type SuggestNameOutput } from '@/ai/flows/suggest-name';
import { generateBiography as generateBiographyFlow, type GenerateBiographyInput, type GenerateBiographyOutput } from '@/ai/flows/generate-biography-flow';
import { findRelationship as findRelationshipFlow, type FindRelationshipInput, type FindRelationshipOutput } from '@/ai/flows/find-relationship-flow';
import { translateDocument as translateDocumentFlow, type TranslateDocumentInput, type TranslateDocumentOutput } from '@/ai/flows/translate-document';
import { extractDocumentText as extractDocumentTextFlow, type ExtractDocumentTextInput, type ExtractDocumentTextOutput } from '@/ai/flows/extract-document-text';
import { z } from 'zod';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from '@/lib/firebase/clients';
import { getAuth } from 'firebase/auth';

const storage = getStorage(app);

const SuggestNameActionSchema = z.object({
  gender: z.enum(['male', 'female', 'other', 'unknown']),
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

export async function handleFindRelationship(input: FindRelationshipInput): Promise<FindRelationshipOutput | { error: string }> {
  try {
    const result = await findRelationshipFlow(input);
    return result;
  } catch (error) {
    console.error("Error in handleFindRelationship:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { error: `Failed to find relationship: ${errorMessage}. Please try again.` };
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

// Translation action
const HandleTranslateDocumentInputSchema = z.object({
  text: z.string().min(1, "Text is required"),
  sourceLanguage: z.string().optional(),
  targetLanguage: z.string().default('English'),
});

export async function handleTranslateDocument(input: TranslateDocumentInput): Promise<TranslateDocumentOutput | { error: string }> {
  const parsedInput = HandleTranslateDocumentInputSchema.safeParse(input);

  if (!parsedInput.success) {
    console.error("Invalid input for translation:", parsedInput.error.format());
    return { error: "Invalid input: " + parsedInput.error.format()._errors.join(', ') };
  }

  try {
    const result = await translateDocumentFlow(parsedInput.data);
    return result;
  } catch (error) {
    console.error("Error in handleTranslateDocument:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { error: `Failed to translate: ${errorMessage}. Please try again.` };
  }
}

// OCR Document Text Extraction action
const HandleExtractDocumentTextInputSchema = z.object({
  imageBase64: z.string().min(1, "Image data is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  documentType: z.enum(['letter', 'certificate', 'record', 'diary', 'other']).optional(),
});

export async function handleExtractDocumentText(input: ExtractDocumentTextInput): Promise<ExtractDocumentTextOutput | { error: string }> {
  const parsedInput = HandleExtractDocumentTextInputSchema.safeParse(input);

  if (!parsedInput.success) {
    console.error("Invalid input for OCR:", parsedInput.error.format());
    return { error: "Invalid input: " + parsedInput.error.format()._errors.join(', ') };
  }

  try {
    const result = await extractDocumentTextFlow(parsedInput.data);
    return result;
  } catch (error) {
    console.error("Error in handleExtractDocumentText:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { error: `Failed to extract text: ${errorMessage}. Please try again.` };
  }
}
