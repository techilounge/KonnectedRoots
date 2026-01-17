/**
 * Utility functions for generating SEO-friendly URL slugs
 */

import { db } from '@/lib/firebase/clients';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Convert a string to a URL-safe slug
 * Examples:
 *   "Doe Family Tree" -> "doe-family-tree"
 *   "The Smith's Legacy" -> "the-smiths-legacy"
 *   "My   Awesome   Tree" -> "my-awesome-tree"
 */
export function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .trim()
        // Replace apostrophes and special chars with nothing
        .replace(/[''`]/g, '')
        // Replace spaces and underscores with hyphens
        .replace(/[\s_]+/g, '-')
        // Remove any character that's not alphanumeric or hyphen
        .replace(/[^a-z0-9-]/g, '')
        // Remove multiple consecutive hyphens
        .replace(/-+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-|-$/g, '')
        // Limit length
        .slice(0, 50);
}

/**
 * Check if a slug already exists for trees owned by this user
 * We filter by ownerId to comply with Firestore security rules
 */
export async function slugExistsForUser(slug: string, ownerId: string): Promise<boolean> {
    const treesRef = collection(db, 'trees');
    const q = query(
        treesRef,
        where('ownerId', '==', ownerId),
        where('slug', '==', slug)
    );
    try {
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        // If query fails (e.g., missing index), assume slug is available
        console.warn('Slug check failed, assuming available:', error);
        return false;
    }
}

/**
 * Generate a unique slug by appending a number suffix if needed
 * Examples:
 *   "doe-family" -> "doe-family" (if unique for this user)
 *   "doe-family" -> "doe-family-2" (if "doe-family" exists for this user)
 */
export async function ensureUniqueSlugForUser(baseSlug: string, ownerId: string): Promise<string> {
    // If base slug is empty, generate a random one
    if (!baseSlug) {
        baseSlug = `tree-${Date.now().toString(36)}`;
    }

    // Check if base slug is available for this user
    if (!(await slugExistsForUser(baseSlug, ownerId))) {
        return baseSlug;
    }

    // Try with numeric suffixes
    let suffix = 2;
    while (suffix <= 100) {
        const candidateSlug = `${baseSlug}-${suffix}`;
        if (!(await slugExistsForUser(candidateSlug, ownerId))) {
            return candidateSlug;
        }
        suffix++;
    }

    // Fallback: append timestamp
    return `${baseSlug}-${Date.now().toString(36)}`;
}

/**
 * Generate a unique slug from a tree title for a specific user
 * This is the main function to use when creating a new tree
 */
export async function generateUniqueSlug(title: string, ownerId: string): Promise<string> {
    const baseSlug = generateSlug(title);
    return ensureUniqueSlugForUser(baseSlug, ownerId);
}

