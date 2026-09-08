import 'server-only';

/**
 * @fileOverview AI-powered handwriting/document OCR for genealogy research.
 * Extracts text from photos of old handwritten documents using AI vision.
 */

import { structured } from '@/lib/ai/gateway';
import { z } from 'zod';

const ExtractDocumentTextInputSchema = z.object({
    imageBase64: z.string().describe('Base64 encoded image data'),
    mimeType: z.string().describe('Image MIME type (image/png, image/jpeg, etc.)'),
    documentType: z.enum(['letter', 'certificate', 'record', 'diary', 'other']).optional()
        .describe('Type of document to help with context'),
});
export type ExtractDocumentTextInput = z.infer<typeof ExtractDocumentTextInputSchema>;

const ExtractDocumentTextOutputSchema = z.object({
    extractedText: z.string().describe('The full text extracted from the document'),
    confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in the extraction accuracy'),
    detectedLanguage: z.string().describe('The detected language of the document'),
    genealogyData: z.object({
        names: z.array(z.string()).optional().describe('Names found in the document'),
        dates: z.array(z.string()).optional().describe('Dates found in the document'),
        places: z.array(z.string()).optional().describe('Places/locations found in the document'),
        relationships: z.array(z.string()).optional().describe('Relationship terms found (father, mother, son, etc.)'),
    }).optional().describe('Extracted genealogy-relevant data'),
});
export type ExtractDocumentTextOutput = z.infer<typeof ExtractDocumentTextOutputSchema>;

export async function extractDocumentText(input: ExtractDocumentTextInput): Promise<ExtractDocumentTextOutput> {
  const data = ExtractDocumentTextInputSchema.parse(input);
  return structured('extractDocumentText', "Transcribe all visible text, preserving structure. Mark illegible or unclear text; detect language, confidence and genealogical names, dates, places, and relationships." + '\nData: ' + JSON.stringify({ documentType: data.documentType }), ExtractDocumentTextOutputSchema, "{\"extractedText\":\"string\",\"confidence\":\"high|medium|low\",\"detectedLanguage\":\"string\",\"genealogyData\":{\"names\":[],\"dates\":[],\"places\":[],\"relationships\":[]}}", { base64: data.imageBase64, mimeType: data.mimeType });
}
