/**
 * Tree Validator - Data Validation for Family Trees
 * 
 * Validates family tree data for impossible/inconsistent entries.
 * No AI required - pure logic validation.
 */

import type { Person } from '@/types';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
    personId: string;
    personName: string;
    field: string;
    severity: ValidationSeverity;
    message: string;
    howToFix: string;
}

export interface ValidationResult {
    hasErrors: boolean;
    hasWarnings: boolean;
    issues: ValidationIssue[];
}

// Helper to parse dates safely
function parseDate(dateStr: string | undefined): Date | null {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
}

// Helper to get year from date string
function getYear(dateStr: string | undefined): number | null {
    if (!dateStr) return null;
    const match = dateStr.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : null;
}

// Helper to get person name
function getName(person: Person): string {
    return `${person.firstName || 'Unknown'} ${person.lastName || ''}`.trim();
}

// Helper to calculate age at date
function calculateAge(birthDate: string | undefined, atDate: string | undefined): number | null {
    const birth = getYear(birthDate);
    const at = getYear(atDate);
    if (birth === null || at === null) return null;
    return at - birth;
}

/**
 * Validate a single person against the tree
 */
export function validatePerson(person: Person, allPeople: Person[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const personName = getName(person);
    const personMap = new Map(allPeople.map(p => [p.id, p]));

    // Rule 0a: Missing or invalid gender
    if (!person.gender || person.gender === 'unknown' || person.gender === 'other') {
        issues.push({
            personId: person.id,
            personName,
            field: 'gender',
            severity: 'error',
            message: `Gender is "${person.gender || 'not set'}"`,
            howToFix: 'Edit this person and select either Male or Female as their gender'
        });
    }

    // Rule 0b: Missing or default first name
    if (!person.firstName || person.firstName.trim() === '' || person.firstName === 'New Person') {
        issues.push({
            personId: person.id,
            personName,
            field: 'firstName',
            severity: 'warning',
            message: 'Missing or default first name',
            howToFix: 'Edit this person and enter their first name'
        });
    }

    // Rule 1: Birth before death
    const birthDate = parseDate(person.birthDate);
    const deathDate = parseDate(person.deathDate);

    if (birthDate && deathDate && birthDate > deathDate) {
        issues.push({
            personId: person.id,
            personName,
            field: 'deathDate',
            severity: 'error',
            message: 'Death date is before birth date',
            howToFix: 'Correct the birth or death date'
        });
    }

    // Rule 2: Reasonable lifespan (< 120 years)
    if (birthDate && deathDate) {
        const ageAtDeath = calculateAge(person.birthDate, person.deathDate);
        if (ageAtDeath !== null && ageAtDeath > 120) {
            issues.push({
                personId: person.id,
                personName,
                field: 'deathDate',
                severity: 'warning',
                message: `Lived ${ageAtDeath} years (unusually long lifespan)`,
                howToFix: 'Verify birth and death dates are correct'
            });
        }
        if (ageAtDeath !== null && ageAtDeath < 0) {
            issues.push({
                personId: person.id,
                personName,
                field: 'birthDate',
                severity: 'error',
                message: 'Negative lifespan detected',
                howToFix: 'Death date must be after birth date'
            });
        }
    }

    // Rule 3: Future dates
    const today = new Date();
    if (birthDate && birthDate > today) {
        issues.push({
            personId: person.id,
            personName,
            field: 'birthDate',
            severity: 'error',
            message: 'Birth date is in the future',
            howToFix: 'Enter a valid past date'
        });
    }
    if (deathDate && deathDate > today) {
        issues.push({
            personId: person.id,
            personName,
            field: 'deathDate',
            severity: 'error',
            message: 'Death date is in the future',
            howToFix: 'Enter a valid past date or remove if person is alive'
        });
    }

    // Rule 4: Parent age check (parent must be at least 12 years older)
    const childBirthYear = getYear(person.birthDate);

    if (person.parentId1 && childBirthYear) {
        const parent1 = personMap.get(person.parentId1);
        if (parent1) {
            const parentBirthYear = getYear(parent1.birthDate);
            if (parentBirthYear !== null) {
                const ageDiff = childBirthYear - parentBirthYear;
                if (ageDiff < 12) {
                    issues.push({
                        personId: person.id,
                        personName,
                        field: 'parentId1',
                        severity: 'error',
                        message: `Parent "${getName(parent1)}" was only ${ageDiff} years old at birth`,
                        howToFix: 'Verify parent-child relationship and birth dates'
                    });
                }
            }
        }
    }

    if (person.parentId2 && childBirthYear) {
        const parent2 = personMap.get(person.parentId2);
        if (parent2) {
            const parentBirthYear = getYear(parent2.birthDate);
            if (parentBirthYear !== null) {
                const ageDiff = childBirthYear - parentBirthYear;
                if (ageDiff < 12) {
                    issues.push({
                        personId: person.id,
                        personName,
                        field: 'parentId2',
                        severity: 'error',
                        message: `Parent "${getName(parent2)}" was only ${ageDiff} years old at birth`,
                        howToFix: 'Verify parent-child relationship and birth dates'
                    });
                }
            }
        }
    }

    // Rule 5: Mother's death before child's birth (accounting for 9 months)
    if (person.parentId1 && childBirthYear) {
        const parent1 = personMap.get(person.parentId1);
        if (parent1 && parent1.gender === 'female' && parent1.deathDate) {
            const motherDeathYear = getYear(parent1.deathDate);
            if (motherDeathYear !== null && childBirthYear > motherDeathYear) {
                issues.push({
                    personId: person.id,
                    personName,
                    field: 'birthDate',
                    severity: 'error',
                    message: `Born after mother "${getName(parent1)}" died`,
                    howToFix: 'Check birth date or mother assignment'
                });
            }
        }
    }
    if (person.parentId2 && childBirthYear) {
        const parent2 = personMap.get(person.parentId2);
        if (parent2 && parent2.gender === 'female' && parent2.deathDate) {
            const motherDeathYear = getYear(parent2.deathDate);
            if (motherDeathYear !== null && childBirthYear > motherDeathYear) {
                issues.push({
                    personId: person.id,
                    personName,
                    field: 'birthDate',
                    severity: 'error',
                    message: `Born after mother "${getName(parent2)}" died`,
                    howToFix: 'Check birth date or mother assignment'
                });
            }
        }
    }

    // Rule 6: Orphaned spouse references
    const validIds = new Set(allPeople.map(p => p.id));
    if (person.spouseIds) {
        for (const spouseId of person.spouseIds) {
            if (!validIds.has(spouseId)) {
                issues.push({
                    personId: person.id,
                    personName,
                    field: 'spouseIds',
                    severity: 'error',
                    message: 'References a spouse that no longer exists',
                    howToFix: 'Remove the orphaned spouse reference'
                });
            }
        }
    }

    // Rule 7: Orphaned parent references
    if (person.parentId1 && !validIds.has(person.parentId1)) {
        issues.push({
            personId: person.id,
            personName,
            field: 'parentId1',
            severity: 'error',
            message: 'References a parent that no longer exists',
            howToFix: 'Remove or reassign the parent reference'
        });
    }
    if (person.parentId2 && !validIds.has(person.parentId2)) {
        issues.push({
            personId: person.id,
            personName,
            field: 'parentId2',
            severity: 'error',
            message: 'References a parent that no longer exists',
            howToFix: 'Remove or reassign the parent reference'
        });
    }

    // Rule 8: Self-reference checks
    if (person.spouseIds?.includes(person.id)) {
        issues.push({
            personId: person.id,
            personName,
            field: 'spouseIds',
            severity: 'error',
            message: 'Person is listed as their own spouse',
            howToFix: 'Remove self-reference from spouse list'
        });
    }
    if (person.parentId1 === person.id || person.parentId2 === person.id) {
        issues.push({
            personId: person.id,
            personName,
            field: 'parentId1',
            severity: 'error',
            message: 'Person is listed as their own parent',
            howToFix: 'Remove self-reference from parent fields'
        });
    }

    // Rule 9: Orphaned person (no connections to the tree)
    const hasParent = !!(person.parentId1 || person.parentId2);
    const hasSpouse = (person.spouseIds?.length ?? 0) > 0;
    const hasChildren = (person.childrenIds?.length ?? 0) > 0;

    // Also check if anyone else references this person as their parent
    const isReferencedAsParent = allPeople.some(p =>
        p.id !== person.id && (p.parentId1 === person.id || p.parentId2 === person.id)
    );

    if (!hasParent && !hasSpouse && !hasChildren && !isReferencedAsParent) {
        issues.push({
            personId: person.id,
            personName,
            field: 'relationships',
            severity: 'warning',
            message: 'This person has no connections to anyone in the tree',
            howToFix: 'Add parent, spouse, or child relationships to connect this person to the family tree'
        });
    }

    return issues;
}

/**
 * Validate entire family tree
 */
export function validateTree(people: Person[]): ValidationResult {
    const allIssues: ValidationIssue[] = [];

    for (const person of people) {
        const personIssues = validatePerson(person, people);
        allIssues.push(...personIssues);
    }

    // Deduplicate issues
    const uniqueIssues = allIssues.filter((issue, index, self) =>
        index === self.findIndex(i =>
            i.personId === issue.personId &&
            i.field === issue.field &&
            i.message === issue.message
        )
    );

    return {
        hasErrors: uniqueIssues.some(i => i.severity === 'error'),
        hasWarnings: uniqueIssues.some(i => i.severity === 'warning'),
        issues: uniqueIssues
    };
}
