'use server';

/**
 * @fileOverview AI-powered handwriting/document OCR for genealogy research.
 * Extracts text from photos of old handwritten documents using AI vision.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
    return extractDocumentTextFlow(input);
}

const extractDocumentTextFlow = ai.defineFlow(
    {
        name: 'extractDocumentTextFlow',
        inputSchema: ExtractDocumentTextInputSchema,
        outputSchema: ExtractDocumentTextOutputSchema,
    },
    async (input) => {
        const prompt = `You are an expert at reading and transcribing historical documents, including handwritten text.

Analyze this image and extract all readable text. This appears to be a ${input.documentType || 'historical document'}.

INSTRUCTIONS:
1. Transcribe ALL visible text from the document, preserving the original structure as much as possible
2. For handwritten text, do your best to interpret difficult-to-read cursive or archaic handwriting
3. Identify the language of the document
4. Rate your confidence in the transcription accuracy (high/medium/low)
5. Extract genealogy-relevant information:
   - Names of people mentioned
   - Dates (birth, death, marriage, etc.)
   - Places and locations
   - Relationship terms (father, mother, son, daughter, spouse, etc.)

If parts are illegible, indicate with [illegible] or [unclear: possible interpretation].

Return the extracted text, detected language, confidence level, and any genealogy data found.`;

        const { output } = await ai.generate({
            model: 'googleai/gemini-2.0-flash',
            prompt: [
                { text: prompt },
                {
                    media: {
                        url: `data:${input.mimeType};base64,${input.imageBase64}`,
                        contentType: input.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
                    }
                }
            ],
            output: { schema: ExtractDocumentTextOutputSchema },
        });

        if (!output) {
            throw new Error('AI failed to extract text from the document.');
        }

        return output;
    }
);
