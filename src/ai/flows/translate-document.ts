'use server';

/**
 * @fileOverview AI-powered document translation for genealogy research.
 * Translates foreign-language documents while preserving genealogy-specific terms.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
    return translateDocumentFlow(input);
}

const prompt = ai.definePrompt({
    name: 'translateDocumentPrompt',
    input: { schema: TranslateDocumentInputSchema },
    output: { schema: TranslateDocumentOutputSchema },
    prompt: `You are an expert translator specializing in genealogy and historical documents.

Your task is to translate the following text to {{targetLanguage}}.

{{#if sourceLanguage}}
Source language: {{sourceLanguage}}
{{else}}
Detect the source language automatically.
{{/if}}

TEXT TO TRANSLATE:
"""
{{{text}}}
"""

INSTRUCTIONS:
1. Provide an accurate translation preserving the original meaning
2. Maintain formatting (line breaks, paragraphs) where possible
3. Keep proper nouns (names, places) in their original form when appropriate
4. Identify any genealogy-specific terms (birth, death, marriage, baptism, etc.) and list them separately
5. For dates, preserve the original format but clarify if ambiguous

Genealogy terms to look for include:
- Birth/born, death/died, marriage/married, baptism/christening
- Father, mother, son, daughter, spouse, widow/widower
- Occupation, residence, witness, godparent
- Church, parish, cemetery, registry

Return the translation along with detected language and any genealogy terms found.`,
});

const translateDocumentFlow = ai.defineFlow(
    {
        name: 'translateDocumentFlow',
        inputSchema: TranslateDocumentInputSchema,
        outputSchema: TranslateDocumentOutputSchema,
    },
    async (input) => {
        const { output } = await prompt(input);
        if (!output) {
            throw new Error('AI failed to translate the document.');
        }
        return output;
    }
);
