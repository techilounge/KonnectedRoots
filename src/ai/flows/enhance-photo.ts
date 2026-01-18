'use server';

/**
 * @fileOverview AI-powered photo enhancement for old/damaged family photos.
 * Uses Gemini's vision capabilities to analyze the photo, then uses Sharp.js
 * to apply actual pixel-level enhancements.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { enhanceImageWithSharp, type EnhancementOptions } from '@/lib/sharp-enhancer';

const EnhancePhotoInputSchema = z.object({
    imageBase64: z.string().describe('Base64 encoded image data'),
    mimeType: z.string().describe('Image MIME type'),
    options: z.object({
        upscale: z.boolean().optional().describe('Increase resolution'),
        restoreFaces: z.boolean().optional().describe('Restore/enhance faces (sharpening)'),
        colorize: z.boolean().optional().describe('Normalize colors'),
        removeNoise: z.boolean().optional().describe('Remove noise and artifacts'),
    }).optional(),
});
export type EnhancePhotoInput = z.infer<typeof EnhancePhotoInputSchema>;

const EnhancePhotoOutputSchema = z.object({
    enhancedImageBase64: z.string().describe('Base64 encoded enhanced image'),
    mimeType: z.string().describe('Output image MIME type'),
    enhancementsApplied: z.array(z.string()).describe('List of enhancements applied'),
    description: z.string().describe('Description of what was enhanced'),
    originalSize: z.object({
        width: z.number(),
        height: z.number()
    }).optional(),
    newSize: z.object({
        width: z.number(),
        height: z.number()
    }).optional(),
});
export type EnhancePhotoOutput = z.infer<typeof EnhancePhotoOutputSchema>;

// Analysis schema for understanding what the photo needs
const PhotoAnalysisSchema = z.object({
    isBlackAndWhite: z.boolean().describe('Whether the photo is black and white'),
    hasDamage: z.boolean().describe('Whether the photo has visible damage'),
    damageDescription: z.string().optional().describe('Description of any damage'),
    hasFaces: z.boolean().describe('Whether the photo contains faces'),
    faceCount: z.number().optional().describe('Number of faces detected'),
    quality: z.enum(['low', 'medium', 'high']).describe('Overall image quality'),
    suggestedEnhancements: z.array(z.string()).describe('List of suggested enhancements'),
    era: z.string().optional().describe('Estimated era of the photo'),
});

export async function analyzePhoto(imageBase64: string, mimeType: string) {
    const prompt = `Analyze this old/historical photo and provide details about its condition.

Examine the photo for:
1. Whether it's black and white or color
2. Any visible damage (tears, fading, water damage, scratches)
3. Whether there are faces and how many
4. Overall image quality
5. Suggested enhancements that would help restore it
6. The estimated era/time period of the photo

Be thorough in your analysis to help guide the restoration process.`;

    const { output } = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt: [
            { text: prompt },
            {
                media: {
                    url: `data:${mimeType};base64,${imageBase64}`,
                    contentType: mimeType as 'image/png' | 'image/jpeg' | 'image/webp',
                }
            }
        ],
        output: { schema: PhotoAnalysisSchema },
    });

    return output;
}

export async function enhancePhoto(input: EnhancePhotoInput): Promise<EnhancePhotoOutput> {
    return enhancePhotoFlow(input);
}

const enhancePhotoFlow = ai.defineFlow(
    {
        name: 'enhancePhotoFlow',
        inputSchema: EnhancePhotoInputSchema,
        outputSchema: EnhancePhotoOutputSchema,
    },
    async (input) => {
        // First, analyze the photo to understand what enhancements are needed
        const analysis = await analyzePhoto(input.imageBase64, input.mimeType);

        if (!analysis) {
            throw new Error('Failed to analyze the photo');
        }

        // Build Sharp enhancement options based on analysis and user options
        const userOptions = input.options || {};

        const sharpOptions: EnhancementOptions = {
            // Sharpen if faces need restoration or quality is low/medium
            sharpen: userOptions.restoreFaces || analysis.quality === 'low' || analysis.quality === 'medium',

            // Enhance contrast for low quality or damaged photos
            enhanceContrast: analysis.quality === 'low' || analysis.hasDamage,

            // Reduce noise if requested or quality is low
            reduceNoise: userOptions.removeNoise || analysis.quality === 'low',

            // Normalize colors (colorize option repurposed)
            normalizeColors: userOptions.colorize || true,

            // Upscale if requested
            upscale: userOptions.upscale ? 1.5 : undefined,
        };

        // Apply enhancements using Sharp
        const result = await enhanceImageWithSharp(
            input.imageBase64,
            input.mimeType,
            sharpOptions
        );

        // Build description
        const descriptionParts = [
            `Photo analyzed: ${analysis.quality} quality`,
            analysis.isBlackAndWhite ? 'black & white' : 'color',
            analysis.hasFaces ? `${analysis.faceCount || 'unknown number of'} face(s) detected` : 'no faces detected',
            analysis.era ? `estimated era: ${analysis.era}` : '',
        ].filter(Boolean);

        const description = `${descriptionParts.join(', ')}. Applied: ${result.enhancementsApplied.join(', ')}.`;

        return {
            enhancedImageBase64: result.enhancedImageBase64,
            mimeType: result.mimeType,
            enhancementsApplied: result.enhancementsApplied,
            description,
            originalSize: result.originalSize,
            newSize: result.newSize,
        };
    }
);

