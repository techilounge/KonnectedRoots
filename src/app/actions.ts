"use server";

import { withAIContext } from '@/lib/ai/gateway';

import { suggestName as suggestNameFlow, type SuggestNameInput, type SuggestNameOutput } from '@/ai/flows/suggest-name';
import { generateBiography as generateBiographyFlow, type GenerateBiographyInput, type GenerateBiographyOutput } from '@/ai/flows/generate-biography-flow';
import { findRelationship as findRelationshipFlow, type FindRelationshipInput, type FindRelationshipOutput } from '@/ai/flows/find-relationship-flow';
import { translateDocument as translateDocumentFlow, type TranslateDocumentInput, type TranslateDocumentOutput } from '@/ai/flows/translate-document';
import { extractDocumentText as extractDocumentTextFlow, type ExtractDocumentTextInput, type ExtractDocumentTextOutput } from '@/ai/flows/extract-document-text';
import { enhancePhoto as enhancePhotoFlow, type EnhancePhotoInput, type EnhancePhotoOutput } from '@/ai/flows/enhance-photo';
import { z } from 'zod';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from '@/lib/firebase/clients';
import { verifyAuthAndDeductAICredits, refundAICredits, recordExportOnServer } from '@/lib/billing/serverUsage';
import { getAdminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

const storage = getStorage(app);

// 1. Suggest Name
const SuggestNameActionSchema = z.object({
  gender: z.enum(['male', 'female', 'other', 'unknown']),
  origin: z.string().optional(),
  historicalPeriod: z.string().optional(),
  authToken: z.string().optional(),
});

export async function handleSuggestName(input: SuggestNameInput & { authToken?: string }): Promise<SuggestNameOutput | { error: string }> {
  const deductResult = await verifyAuthAndDeductAICredits(input.authToken, 'suggest_name');
  if (!deductResult.success) {
    return { error: deductResult.error || "Authentication or credit verification failed." };
  }

  const parsedInput = SuggestNameActionSchema.safeParse(input);
  if (!parsedInput.success) {
    if (deductResult.uid && deductResult.cost) {
      await refundAICredits(deductResult.uid, deductResult.cost);
    }
    return { error: "Invalid input: " + parsedInput.error.format()._errors.join(', ') };
  }

  try {
    const result = await withAIContext(deductResult.uid!, () => suggestNameFlow(parsedInput.data));
    return result;
  } catch (error) {
    console.error("Error in handleSuggestName:", error);
    if (deductResult.uid && deductResult.cost) {
      await refundAICredits(deductResult.uid, deductResult.cost);
    }
    return { error: "Failed to suggest name. Please try again." };
  }
}

// 2. Generate Biography
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
  authToken: z.string().optional(),
});

export async function handleGenerateBiography(input: GenerateBiographyInput & { authToken?: string }): Promise<GenerateBiographyOutput | { error: string }> {
  const deductResult = await verifyAuthAndDeductAICredits(input.authToken, 'generate_biography');
  if (!deductResult.success) {
    return { error: deductResult.error || "Authentication or credit verification failed." };
  }

  const parsedInput = HandleGenerateBiographyInputSchema.safeParse(input);
  if (!parsedInput.success) {
    console.error("Invalid input for biography generation:", parsedInput.error.format());
    if (deductResult.uid && deductResult.cost) {
      await refundAICredits(deductResult.uid, deductResult.cost);
    }
    return { error: "Invalid input for biography: " + parsedInput.error.format()._errors.join(', ') };
  }

  try {
    const result = await withAIContext(deductResult.uid!, () => generateBiographyFlow(parsedInput.data));
    return result;
  } catch (error) {
    console.error("Error in handleGenerateBiography:", error);
    if (deductResult.uid && deductResult.cost) {
      await refundAICredits(deductResult.uid, deductResult.cost);
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { error: `Failed to generate biography: ${errorMessage}. Please try again.` };
  }
}

// 3. Find Relationship
const PersonInfoSchema = z.object({
  id: z.string().min(1),
  firstName: z.string(),
  lastName: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).nullable(),
  parentId1: z.string().nullable().optional(),
  parentId2: z.string().nullable().optional(),
  spouseIds: z.array(z.string()).optional(),
  childrenIds: z.array(z.string()).optional(),
});

const FindRelationshipInputSchema = z.object({
  person1: PersonInfoSchema,
  person2: PersonInfoSchema,
  allPeople: z.array(PersonInfoSchema),
  authToken: z.string().optional(),
});

export async function handleFindRelationship(input: FindRelationshipInput & { authToken?: string }): Promise<FindRelationshipOutput | { error: string }> {
  const parsed = FindRelationshipInputSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid relationship input.' };
  return findRelationshipFlow(parsed.data);
}

// 4. Translate Document
const HandleTranslateDocumentInputSchema = z.object({
  text: z.string().min(1, "Text is required"),
  sourceLanguage: z.string().optional(),
  targetLanguage: z.string().default('English'),
  authToken: z.string().optional(),
});

export async function handleTranslateDocument(input: TranslateDocumentInput & { authToken?: string }): Promise<TranslateDocumentOutput | { error: string }> {
  const deductResult = await verifyAuthAndDeductAICredits(input.authToken, 'translate_document');
  if (!deductResult.success) {
    return { error: deductResult.error || "Authentication or credit verification failed." };
  }

  const parsedInput = HandleTranslateDocumentInputSchema.safeParse(input);
  if (!parsedInput.success) {
    console.error("Invalid input for translation:", parsedInput.error.format());
    if (deductResult.uid && deductResult.cost) {
      await refundAICredits(deductResult.uid, deductResult.cost);
    }
    return { error: "Invalid input: " + parsedInput.error.format()._errors.join(', ') };
  }

  try {
    const result = await withAIContext(deductResult.uid!, () => translateDocumentFlow(parsedInput.data));
    return result;
  } catch (error) {
    console.error("Error in handleTranslateDocument:", error);
    if (deductResult.uid && deductResult.cost) {
      await refundAICredits(deductResult.uid, deductResult.cost);
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { error: `Failed to translate: ${errorMessage}. Please try again.` };
  }
}

// 5. OCR Document Text Extraction
const HandleExtractDocumentTextInputSchema = z.object({
  imageBase64: z.string().min(1, "Image data is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  documentType: z.enum(['letter', 'certificate', 'record', 'diary', 'other']).optional(),
  authToken: z.string().optional(),
});

export async function handleExtractDocumentText(input: ExtractDocumentTextInput & { authToken?: string }): Promise<ExtractDocumentTextOutput | { error: string }> {
  const deductResult = await verifyAuthAndDeductAICredits(input.authToken, 'ocr_document');
  if (!deductResult.success) {
    return { error: deductResult.error || "Authentication or credit verification failed." };
  }

  const parsedInput = HandleExtractDocumentTextInputSchema.safeParse(input);
  if (!parsedInput.success) {
    console.error("Invalid input for OCR:", parsedInput.error.format());
    if (deductResult.uid && deductResult.cost) {
      await refundAICredits(deductResult.uid, deductResult.cost);
    }
    return { error: "Invalid input: " + parsedInput.error.format()._errors.join(', ') };
  }

  try {
    const result = await withAIContext(deductResult.uid!, () => extractDocumentTextFlow(parsedInput.data));
    return result;
  } catch (error) {
    console.error("Error in handleExtractDocumentText:", error);
    if (deductResult.uid && deductResult.cost) {
      await refundAICredits(deductResult.uid, deductResult.cost);
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { error: `Failed to extract text: ${errorMessage}. Please try again.` };
  }
}

// 6. Photo Enhancement
const HandleEnhancePhotoInputSchema = z.object({
  imageBase64: z.string().min(1, "Image data is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  options: z.object({
    upscale: z.boolean().optional(),
    restoreFaces: z.boolean().optional(),
    colorize: z.boolean().optional(),
    removeNoise: z.boolean().optional(),
  }).optional(),
  authToken: z.string().optional(),
});

export async function handleEnhancePhoto(input: EnhancePhotoInput & { authToken?: string }): Promise<EnhancePhotoOutput | { error: string }> {
  const deductResult = await verifyAuthAndDeductAICredits(input.authToken, 'enhance_photo');
  if (!deductResult.success) {
    return { error: deductResult.error || "Authentication or credit verification failed." };
  }

  const parsedInput = HandleEnhancePhotoInputSchema.safeParse(input);
  if (!parsedInput.success) {
    console.error("Invalid input for enhancement:", parsedInput.error.format());
    if (deductResult.uid && deductResult.cost) {
      await refundAICredits(deductResult.uid, deductResult.cost);
    }
    return { error: "Invalid input: " + parsedInput.error.format()._errors.join(', ') };
  }

  try {
    const result = await withAIContext(deductResult.uid!, () => enhancePhotoFlow(parsedInput.data));
    return result;
  } catch (error) {
    console.error("Error in handleEnhancePhoto:", error);
    if (deductResult.uid && deductResult.cost) {
      await refundAICredits(deductResult.uid, deductResult.cost);
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { error: `Failed to enhance photo: ${errorMessage}. Please try again.` };
  }
}

export async function handleUploadProfilePicture(formData: FormData): Promise<{ downloadURL: string } | { error: string }> {
  const file = formData.get('profilePicture') as File;
  const treeId = formData.get('treeId') as string;
  const personId = formData.get('personId') as string;

  if (!file || !treeId || !personId) {
    return { error: "Missing required data for file upload." };
  }

  try {
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

export async function handleRecordExport(authToken?: string): Promise<{
  success: boolean;
  error?: string;
  exportsUsed?: number;
  limit?: number | null;
}> {
  return await recordExportOnServer(authToken);
}

// 7. Contact Us Form Submission
const ContactMessageSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Please enter a valid email address"),
  subject: z.string().trim().min(5, "Subject must be at least 5 characters").max(200),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000),
});

export type ContactMessageInput = z.infer<typeof ContactMessageSchema>;

export async function handleContactMessage(input: ContactMessageInput): Promise<{
  success: boolean;
  error?: string;
}> {
  const parsed = ContactMessageSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map(i => i.message).join(', ');
    return { success: false, error: errorMsg };
  }

  try {
    const db = getAdminDb();
    await db.collection('contact_messages').add({
      ...parsed.data,
      status: 'unread',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'web_contact_form',
    });

    return { success: true };
  } catch (error) {
    console.error("Error saving contact message to Firestore:", error);
    return {
      success: false,
      error: "Failed to send your message. Please try again later.",
    };
  }
}
