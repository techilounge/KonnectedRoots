/**
 * Duplicate Detector - Finds potential duplicate entries in family trees
 * 
 * Uses fuzzy matching on names, birth dates, and relationships.
 * No AI required - pure algorithmic matching.
 */

import type { Person } from '@/types';

export interface DuplicateMatch {
    person1: Person;
    person2: Person;
    confidence: number; // 0-100
    reasons: string[];
}

export interface DuplicateDetectionResult {
    hasDuplicates: boolean;
    matches: DuplicateMatch[];
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,      // deletion
                dp[i][j - 1] + 1,      // insertion
                dp[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return dp[m][n];
}

/**
 * Calculate string similarity (0-1)
 */
function stringSimilarity(str1: string | undefined, str2: string | undefined): number {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    const maxLen = Math.max(s1.length, s2.length);
    const distance = levenshteinDistance(s1, s2);

    return 1 - (distance / maxLen);
}

/**
 * Get year from date string
 */
function getYear(dateStr: string | undefined): number | null {
    if (!dateStr) return null;
    const match = dateStr.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : null;
}

/**
 * Get full name
 */
function getFullName(person: Person): string {
    return `${person.firstName || ''} ${person.lastName || ''}`.trim().toLowerCase();
}

/**
 * Check if two people might be duplicates
 */
function comparePeople(person1: Person, person2: Person): DuplicateMatch | null {
    // Skip if same person
    if (person1.id === person2.id) return null;

    const reasons: string[] = [];
    let totalScore = 0;
    let maxPossibleScore = 0;

    // === Name comparison (40% weight) ===
    const name1 = getFullName(person1);
    const name2 = getFullName(person2);

    if (name1 && name2) {
        maxPossibleScore += 40;
        const nameSimilarity = stringSimilarity(name1, name2);
        const nameScore = nameSimilarity * 40;
        totalScore += nameScore;

        if (nameSimilarity > 0.8) {
            reasons.push(`Names are ${Math.round(nameSimilarity * 100)}% similar`);
        } else if (nameSimilarity > 0.6) {
            reasons.push(`Names have some similarity (${Math.round(nameSimilarity * 100)}%)`);
        }

        // Exact first name match bonus
        if (person1.firstName && person2.firstName &&
            person1.firstName.toLowerCase() === person2.firstName.toLowerCase()) {
            totalScore += 5;
            maxPossibleScore += 5;
        }

        // Exact last name match bonus
        if (person1.lastName && person2.lastName &&
            person1.lastName.toLowerCase() === person2.lastName.toLowerCase()) {
            totalScore += 5;
            maxPossibleScore += 5;
            if (nameSimilarity <= 0.8) {
                reasons.push('Same last name');
            }
        }
    }

    // === Birth year comparison (25% weight) ===
    const year1 = getYear(person1.birthDate);
    const year2 = getYear(person2.birthDate);

    if (year1 && year2) {
        maxPossibleScore += 25;
        const yearDiff = Math.abs(year1 - year2);

        if (yearDiff === 0) {
            totalScore += 25;
            reasons.push('Same birth year');
        } else if (yearDiff <= 1) {
            totalScore += 20;
            reasons.push('Birth years within 1 year');
        } else if (yearDiff <= 3) {
            totalScore += 15;
            reasons.push(`Birth years within ${yearDiff} years`);
        } else if (yearDiff <= 5) {
            totalScore += 8;
        }
    }

    // === Birth place comparison (15% weight) ===
    if (person1.placeOfBirth && person2.placeOfBirth) {
        maxPossibleScore += 15;
        const placeSimilarity = stringSimilarity(person1.placeOfBirth, person2.placeOfBirth);
        totalScore += placeSimilarity * 15;

        if (placeSimilarity > 0.7) {
            reasons.push('Similar birthplace');
        }
    }

    // === Parent matching (20% weight) ===
    const sharedParents: string[] = [];

    if (person1.parentId1 && (person1.parentId1 === person2.parentId1 || person1.parentId1 === person2.parentId2)) {
        sharedParents.push(person1.parentId1);
    }
    if (person1.parentId2 && (person1.parentId2 === person2.parentId1 || person1.parentId2 === person2.parentId2)) {
        sharedParents.push(person1.parentId2);
    }

    if (sharedParents.length > 0) {
        maxPossibleScore += 20;
        if (sharedParents.length === 2) {
            totalScore += 20;
            reasons.push('Same parents');
        } else {
            totalScore += 12;
            reasons.push('Share one parent');
        }
    }

    // === Gender match (bonus/penalty) ===
    if (person1.gender && person2.gender) {
        if (person1.gender !== person2.gender && person1.gender !== 'unknown' && person2.gender !== 'unknown') {
            // Different genders - reduce score significantly
            totalScore = totalScore * 0.3;
        }
    }

    // Calculate final confidence
    const confidence = maxPossibleScore > 0
        ? Math.round((totalScore / maxPossibleScore) * 100)
        : 0;

    // Only return if confidence is above threshold
    if (confidence >= 50 && reasons.length > 0) {
        return {
            person1,
            person2,
            confidence,
            reasons
        };
    }

    return null;
}

/**
 * Detect duplicates in the entire tree
 */
export function detectDuplicates(people: Person[]): DuplicateDetectionResult {
    const matches: DuplicateMatch[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
            const person1 = people[i];
            const person2 = people[j];

            // Create unique pair key to avoid duplicate checks
            const pairKey = [person1.id, person2.id].sort().join('|');
            if (processedPairs.has(pairKey)) continue;
            processedPairs.add(pairKey);

            const match = comparePeople(person1, person2);
            if (match) {
                matches.push(match);
            }
        }
    }

    // Sort by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);

    return {
        hasDuplicates: matches.length > 0,
        matches
    };
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 80) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
}

/**
 * Get confidence color for UI
 */
export function getConfidenceColor(confidence: number): string {
    if (confidence >= 80) return 'text-red-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-blue-600';
}
