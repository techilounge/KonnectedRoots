import 'server-only';

/**
 * @fileOverview AI-powered document translation for genealogy research.
 * Translates foreign-language documents while preserving genealogy-specific terms.
 */

import { structured } from '@/lib/ai/gateway';
import { z } from 'zod';

const TranslateDocumentInputSchema = z.object({
    text: z.string().describe('The text to translate'),
    sourceLanguage: z.string().optional().describe('Source language (auto-detect if not provided)'),
    targetLanguage: z.string().default('English').describe('Target language for translation'),
});
export type TranslateDocumentInput = z.infer<typeof TranslateDocumentInputSchema>;

const TranslateDocumentOutputSchema = z.object({
    translatedText: z.string().describe('The translated text'),
    detectedLanguage: z.string().describe('The detected or specified source language'),
    genealogyTerms: z.array(z.object({
        original: z.string().describe('Original term'),
        translation: z.string().describe('Translated term'),
        context: z.string().optional().describe('Context or notes about the term'),
    })).optional().describe('Genealogy-specific terms found in the text'),
});
export type TranslateDocumentOutput = z.infer<typeof TranslateDocumentOutputSchema>;

export async function translateDocument(input: TranslateDocumentInput): Promise<TranslateDocumentOutput> {
  const data = TranslateDocumentInputSchema.parse(input);
  return structured('translateDocument', "Translate to targetLanguage (English by default). Auto-detect source language unless specified. Preserve formatting, proper names and ambiguous dates; list genealogy-specific terms and meanings." + '\nData: ' + JSON.stringify(data), TranslateDocumentOutputSchema, "{\"translatedText\":\"string\",\"detectedLanguage\":\"string\",\"genealogyTerms\":[{\"original\":\"string\",\"translation\":\"string\",\"context\":\"string\"}]}");
}
