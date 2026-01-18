'use server';

/**
 * @fileOverview Sharp.js-based image enhancement service
 * Provides real pixel-level modifications for old photos
 */

import sharp from 'sharp';

export interface EnhancementOptions {
    sharpen?: boolean;
    enhanceContrast?: boolean;
    adjustBrightness?: number; // -1 to 1, 0 is neutral
    reduceNoise?: boolean;
    upscale?: number; // 1.5, 2, etc.
    normalizeColors?: boolean;
}

export interface EnhancementResult {
    enhancedImageBase64: string;
    mimeType: string;
    enhancementsApplied: string[];
    originalSize: { width: number; height: number };
    newSize: { width: number; height: number };
}

/**
 * Enhance an image using Sharp.js
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - Image MIME type
 * @param options - Enhancement options
 */
export async function enhanceImageWithSharp(
    imageBase64: string,
    mimeType: string,
    options: EnhancementOptions
): Promise<EnhancementResult> {
    const enhancementsApplied: string[] = [];

    // Convert base64 to buffer
    const inputBuffer = Buffer.from(imageBase64, 'base64');

    // Get original metadata
    const metadata = await sharp(inputBuffer).metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    // Start the Sharp pipeline
    let pipeline = sharp(inputBuffer);

    // Apply upscaling first if requested (before other transformations)
    let newWidth = originalWidth;
    let newHeight = originalHeight;

    if (options.upscale && options.upscale > 1) {
        newWidth = Math.round(originalWidth * options.upscale);
        newHeight = Math.round(originalHeight * options.upscale);
        pipeline = pipeline.resize(newWidth, newHeight, {
            kernel: sharp.kernel.lanczos3, // High-quality upscaling
            fit: 'fill'
        });
        enhancementsApplied.push(`Upscaled ${options.upscale}x`);
    }

    // Noise reduction (median filter for gentle smoothing)
    if (options.reduceNoise) {
        pipeline = pipeline.median(3); // 3x3 median filter
        enhancementsApplied.push('Noise reduction');
    }

    // Sharpen (unsharp mask)
    if (options.sharpen) {
        pipeline = pipeline.sharpen({
            sigma: 1.2,      // Gaussian blur sigma
            m1: 1.0,         // Flat areas sharpening
            m2: 2.0,         // Jagged areas sharpening
            x1: 2.0,         // Threshold for flat
            y2: 10.0,        // Max sharpening
            y3: 10.0         // Max darkening
        });
        enhancementsApplied.push('Sharpening');
    }

    // Color normalization (histogram stretching)
    if (options.normalizeColors) {
        pipeline = pipeline.normalize();
        enhancementsApplied.push('Color normalization');
    }

    // Contrast and brightness adjustments
    if (options.enhanceContrast || (options.adjustBrightness !== undefined && options.adjustBrightness !== 0)) {
        const contrastMultiplier = options.enhanceContrast ? 1.15 : 1.0;
        const brightnessOffset = options.adjustBrightness ? options.adjustBrightness * 30 : 0;

        // Use modulate for brightness and linear for contrast
        if (options.adjustBrightness) {
            // Brightness is adjusted as a percentage (100 = no change)
            const brightnessFactor = 1 + (options.adjustBrightness * 0.3);
            pipeline = pipeline.modulate({
                brightness: brightnessFactor
            });
            enhancementsApplied.push('Brightness adjustment');
        }

        if (options.enhanceContrast) {
            // Increase contrast using linear transformation
            pipeline = pipeline.linear(contrastMultiplier, -(128 * contrastMultiplier) + 128);
            enhancementsApplied.push('Contrast enhancement');
        }
    }

    // Convert to output format
    let outputBuffer: Buffer;
    let outputMimeType = mimeType;

    // Use JPEG for output (good balance of quality and size)
    if (mimeType === 'image/png') {
        outputBuffer = await pipeline.png({ quality: 90 }).toBuffer();
        outputMimeType = 'image/png';
    } else {
        outputBuffer = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
        outputMimeType = 'image/jpeg';
    }

    // Convert back to base64
    const enhancedBase64 = outputBuffer.toString('base64');

    return {
        enhancedImageBase64: enhancedBase64,
        mimeType: outputMimeType,
        enhancementsApplied,
        originalSize: { width: originalWidth, height: originalHeight },
        newSize: { width: newWidth, height: newHeight }
    };
}

/**
 * Auto-enhance an image based on AI analysis recommendations
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - Image MIME type
 * @param analysis - AI analysis results
 */
export async function autoEnhanceImage(
    imageBase64: string,
    mimeType: string,
    analysis: {
        quality: 'low' | 'medium' | 'high';
        isBlackAndWhite: boolean;
        hasDamage: boolean;
    }
): Promise<EnhancementResult> {
    // Determine enhancement options based on analysis
    const options: EnhancementOptions = {
        sharpen: analysis.quality === 'low' || analysis.quality === 'medium',
        enhanceContrast: analysis.quality === 'low',
        reduceNoise: analysis.quality === 'low',
        normalizeColors: true, // Always normalize for old photos
        upscale: analysis.quality === 'low' ? 1.5 : undefined, // Upscale low quality images
    };

    return enhanceImageWithSharp(imageBase64, mimeType, options);
}
