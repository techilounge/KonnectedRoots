import 'server-only';

/**
 * @fileOverview AI-powered photo enhancement for old/damaged family photos.
 * Uses configured image analysis and editing models for AI-powered photo restoration,
 * including colorization, face restoration, and damage repair.
 */

import { generate, structured } from '@/lib/ai/gateway';
import { z } from 'zod';
import sharp from 'sharp';

const EnhancePhotoInputSchema = z.object({
    imageBase64: z.string().describe('Base64 encoded image data'),
    mimeType: z.string().describe('Image MIME type'),
    options: z.object({
        upscale: z.boolean().optional().describe('Increase resolution'),
        restoreFaces: z.boolean().optional().describe('Restore and enhance faces'),
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

    return structured('photoAnalysis', prompt, PhotoAnalysisSchema, '{"isBlackAndWhite":true,"hasDamage":false,"damageDescription":"string","hasFaces":true,"faceCount":1,"quality":"low|medium|high","suggestedEnhancements":[],"era":"string"}', { base64: imageBase64, mimeType });
}

export async function enhancePhoto(input: EnhancePhotoInput): Promise<EnhancePhotoOutput> {
    return enhancePhotoFlow(input);
}

async function enhancePhotoFlow(raw: EnhancePhotoInput): Promise<EnhancePhotoOutput> {
        const input = EnhancePhotoInputSchema.parse(raw);
        // First, analyze the photo to understand what enhancements are needed
        const analysis = await analyzePhoto(input.imageBase64, input.mimeType);

        if (!analysis) {
            throw new Error('Failed to analyze the photo');
        }

        // Build enhancement instructions based on analysis and user options
        const userOptions = input.options || {};
        const enhancementInstructions: string[] = [];
        const enhancementsApplied: string[] = [];

        // Always enhance clarity
        enhancementInstructions.push('Enhance the overall clarity and sharpness of the photo.');
        enhancementsApplied.push('Clarity enhancement');

        // Colorization
        if (userOptions.colorize && analysis.isBlackAndWhite) {
            enhancementInstructions.push('Colorize this black and white photo with historically accurate, natural-looking colors. Use period-appropriate clothing colors, realistic skin tones, and natural environmental colors.');
            enhancementsApplied.push('AI colorization');
        }

        // Face restoration
        if (userOptions.restoreFaces && analysis.hasFaces) {
            enhancementInstructions.push(`Restore and enhance the ${analysis.faceCount || ''} face(s) in this photo. Make facial features clearer, more defined, and natural-looking while maintaining the original appearance.`);
            enhancementsApplied.push('Face restoration');
        }

        // Noise reduction
        if (userOptions.removeNoise || analysis.quality === 'low') {
            enhancementInstructions.push('Remove grain, noise, and artifacts from the photo while preserving important details.');
            enhancementsApplied.push('Noise reduction');
        }

        // Damage repair
        if (analysis.hasDamage) {
            enhancementInstructions.push(`Repair visible damage including: ${analysis.damageDescription || 'scratches, tears, and fading'}. Fill in damaged areas naturally.`);
            enhancementsApplied.push('Damage repair');
        }

        // Resolution enhancement
        if (userOptions.upscale) {
            enhancementInstructions.push('Increase the resolution and detail of the photo.');
            enhancementsApplied.push('Resolution enhancement');
        }

        // Build the full restoration prompt
        const restorationPrompt = `You are an expert photo restoration specialist. Please restore and enhance this ${analysis.era || 'vintage'} photograph.

Photo Analysis:
- Type: ${analysis.isBlackAndWhite ? 'Black & White' : 'Color'}
- Quality: ${analysis.quality}
- Faces: ${analysis.hasFaces ? `${analysis.faceCount || 'some'} face(s) present` : 'No faces'}
- Damage: ${analysis.hasDamage ? analysis.damageDescription : 'No significant damage'}
- Era: ${analysis.era || 'Unknown'}

Restoration Instructions:
${enhancementInstructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

IMPORTANT: 
- Maintain the authentic character and historical feel of the photo
- Do not add elements that weren't in the original
- Make the restoration look natural, not artificial
- Preserve the original composition and framing

Generate a restored version of this photo.`;

        const result = await generate('enhancePhoto', { prompt: restorationPrompt, image: { base64: input.imageBase64, mimeType: input.mimeType }, maxOutputTokens: 4096, imageOutput: true });
        if (!result.image) throw new Error('No restored image returned.');
        const rawBase64 = result.image.base64;

        // Compress and convert to WebP using Sharp.js
        const rawBuffer = Buffer.from(rawBase64, 'base64');
        const compressedBuffer = await sharp(rawBuffer)
            .webp({ quality: 80, effort: 6 })  // Good balance of quality vs size
            .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })  // Cap max dimensions
            .toBuffer();

        const compressedBase64 = compressedBuffer.toString('base64');
        const outputMimeType = 'image/webp';

        console.log(`Image compressed: ${rawBuffer.length} -> ${compressedBuffer.length} bytes (${Math.round(compressedBuffer.length / rawBuffer.length * 100)}%)`);

        // Build description
        const descriptionParts = [
            `Restored ${analysis.era || 'vintage'} photo`,
            analysis.isBlackAndWhite && userOptions.colorize ? 'colorized' : null,
            analysis.hasFaces ? `${analysis.faceCount || ''} face(s) enhanced` : null,
            analysis.hasDamage ? 'damage repaired' : null,
        ].filter(Boolean);

        const description = `${descriptionParts.join(', ')}. AI-powered restoration complete. Compressed to WebP.`;

        return {
            enhancedImageBase64: compressedBase64,
            mimeType: outputMimeType,
            enhancementsApplied: [...enhancementsApplied, 'WebP compression'],
            description,
        };
    }
