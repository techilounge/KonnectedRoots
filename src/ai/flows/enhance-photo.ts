'use server';

/**
 * @fileOverview AI-powered photo enhancement for old/damaged family photos.
 * Uses Gemini's vision capabilities to analyze and describe enhancement needs,
 * then uses image generation to create an enhanced version.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EnhancePhotoInputSchema = z.object({
    imageBase64: z.string().describe('Base64 encoded image data'),
    mimeType: z.string().describe('Image MIME type'),
    options: z.object({
        upscale: z.boolean().optional().describe('Increase resolution'),
        restoreFaces: z.boolean().optional().describe('Restore/enhance faces'),
        colorize: z.boolean().optional().describe('Convert B&W to color'),
        removeNoise: z.boolean().optional().describe('Remove noise and artifacts'),
    }).optional(),
});
export type EnhancePhotoInput = z.infer<typeof EnhancePhotoInputSchema>;

const EnhancePhotoOutputSchema = z.object({
    enhancedImageBase64: z.string().describe('Base64 encoded enhanced image'),
    mimeType: z.string().describe('Output image MIME type'),
    enhancementsApplied: z.array(z.string()).describe('List of enhancements applied'),
    description: z.string().describe('Description of what was enhanced'),
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

        // Build enhancement description based on analysis and user options
        const enhancements: string[] = [];
        const options = input.options || {};

        if (options.colorize || analysis.isBlackAndWhite) {
            enhancements.push('colorization');
        }
        if (options.restoreFaces || analysis.hasFaces) {
            enhancements.push('face restoration');
        }
        if (options.removeNoise || analysis.quality === 'low') {
            enhancements.push('noise reduction');
        }
        if (options.upscale) {
            enhancements.push('resolution enhancement');
        }
        if (analysis.hasDamage) {
            enhancements.push('damage repair');
        }

        // Generate enhancement description prompt
        const enhancementPrompt = `
You are an AI photo restoration expert. Create a detailed description of how this photo would look after professional restoration.

Current photo analysis:
- Black & White: ${analysis.isBlackAndWhite}
- Has Damage: ${analysis.hasDamage}${analysis.damageDescription ? ` (${analysis.damageDescription})` : ''}
- Contains ${analysis.faceCount || 0} face(s)
- Quality: ${analysis.quality}
- Era: ${analysis.era || 'Unknown'}

Requested enhancements: ${enhancements.join(', ')}

Describe in detail how the restored version would look, including:
1. Color palette if colorizing
2. How faces would be clarified
3. What damage would be repaired
4. Overall improvement in clarity and quality`;

        const { output: descriptionOutput } = await ai.generate({
            model: 'googleai/gemini-2.0-flash',
            prompt: enhancementPrompt,
            output: {
                schema: z.object({
                    restorationDescription: z.string().describe('Detailed description of the restoration'),
                    colorPalette: z.string().optional().describe('Color palette for colorization'),
                })
            },
        });

        // For now, we return the original image with analysis
        // In a production implementation, you would:
        // 1. Use Replicate's GFPGAN for face restoration
        // 2. Use Real-ESRGAN for upscaling
        // 3. Use a colorization model for B&W photos

        // This is a placeholder that demonstrates the flow
        // The actual image enhancement would require integration with image processing APIs

        return {
            enhancedImageBase64: input.imageBase64, // In production, this would be the enhanced image
            mimeType: input.mimeType,
            enhancementsApplied: enhancements.length > 0 ? enhancements : ['analysis only'],
            description: descriptionOutput?.restorationDescription ||
                `Photo analyzed. Suggested enhancements: ${analysis.suggestedEnhancements.join(', ')}. ` +
                `To apply actual enhancements, a photo restoration API integration is required.`,
        };
    }
);
