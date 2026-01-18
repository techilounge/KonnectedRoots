/**
 * GEDCOM 5.5.1 format generator for family tree data
 * GEDCOM is the industry standard for genealogy data exchange
 */

import type { Person } from '@/types';

export function generateGedcom(people: Person[], treeName: string): string {
    // Debug logging for export
    console.log('=== GEDCOM EXPORT START ===');
    console.log(`[Export] Tree: ${treeName}, People count: ${people.length}`);

    // Log each person's relationships
    people.forEach((p, i) => {
        console.log(`[Export] Person ${i + 1}: ${p.firstName} ${p.lastName} (ID: ${p.id})`);
        console.log(`  - parentId1: ${p.parentId1 || 'none'}`);
        console.log(`  - parentId2: ${p.parentId2 || 'none'}`);
        console.log(`  - spouseIds: ${(p.spouseIds || []).join(', ') || 'none'}`);
        console.log(`  - childrenIds: ${(p.childrenIds || []).join(', ') || 'none'}`);
        console.log(`  - position: x=${p.x}, y=${p.y}`);
    });

    const lines: string[] = [];
    const today = new Date().toISOString().split('T')[0].replace(/-/g, ' ');

    // Header
    lines.push('0 HEAD');
    lines.push('1 SOUR KonnectedRoots');
    lines.push('2 VERS 1.0');
    lines.push('2 NAME KonnectedRoots Family Tree Builder');
    lines.push('1 DATE ' + today);
    lines.push('1 GEDC');
    lines.push('2 VERS 5.5.1');
    lines.push('2 FORM LINEAGE-LINKED');
    lines.push('1 CHAR UTF-8');
    lines.push('1 FILE ' + treeName + '.ged');

    // Map for family IDs
    const familyMap = new Map<string, string>(); // "parent1Id-parent2Id" -> FAM_ID
    let familyCounter = 1;

    // Helper to get or create family ID
    const getFamilyId = (parent1?: string | null, parent2?: string | null): string | null => {
        if (!parent1 && !parent2) return null;
        const key = [parent1 || '', parent2 || ''].sort().join('-');
        if (!familyMap.has(key)) {
            familyMap.set(key, `@F${familyCounter++}@`);
        }
        return familyMap.get(key)!;
    };

    // Create INDI records for each person
    for (const person of people) {
        lines.push(`0 @I${person.id}@ INDI`);

        // Name
        const fullName = [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ');
        lines.push(`1 NAME ${person.firstName || 'Unknown'} /${person.lastName || ''}/`);
        if (person.firstName) lines.push(`2 GIVN ${person.firstName}`);
        if (person.lastName) lines.push(`2 SURN ${person.lastName}`);
        if (person.nickname) lines.push(`2 NICK ${person.nickname}`);
        if (person.maidenName) lines.push(`2 _MARNM ${person.maidenName}`);

        // Gender
        if (person.gender === 'male') lines.push('1 SEX M');
        else if (person.gender === 'female') lines.push('1 SEX F');
        else lines.push('1 SEX U');

        // Birth
        if (person.birthDate || person.placeOfBirth) {
            lines.push('1 BIRT');
            if (person.birthDate) lines.push(`2 DATE ${person.birthDate}`);
            if (person.placeOfBirth) lines.push(`2 PLAC ${person.placeOfBirth}`);
        }

        // Death
        if (person.livingStatus === 'deceased' || person.deathDate || person.placeOfDeath) {
            lines.push('1 DEAT' + (person.livingStatus === 'deceased' ? ' Y' : ''));
            if (person.deathDate) lines.push(`2 DATE ${person.deathDate}`);
            if (person.placeOfDeath) lines.push(`2 PLAC ${person.placeOfDeath}`);
        }

        // Occupation
        if (person.occupation) lines.push(`1 OCCU ${person.occupation}`);

        // Education
        if (person.education) lines.push(`1 EDUC ${person.education}`);

        // Religion
        if (person.religion) lines.push(`1 RELI ${person.religion}`);

        // Notes/Biography
        if (person.biography) {
            lines.push('1 NOTE');
            // Split long notes into continuation lines
            const bioLines = person.biography.match(/.{1,80}/g) || [];
            bioLines.forEach((line, idx) => {
                if (idx === 0) lines.push(`2 CONT ${line}`);
                else lines.push(`2 CONT ${line}`);
            });
        }

        // Custom KonnectedRoots tags for position preservation (custom tags start with _)
        if (person.x !== undefined && person.x !== null) {
            lines.push(`1 _XPOS ${Math.round(person.x)}`);
        }
        if (person.y !== undefined && person.y !== null) {
            lines.push(`1 _YPOS ${Math.round(person.y)}`);
        }
        // Custom KonnectedRoots photo tag
        const photoUrl = person.photoURL || person.profilePictureUrl;
        if (photoUrl) {
            lines.push(`1 _PHOTO ${photoUrl}`);
        }

        // Link to parent family (with validation to prevent corrupt data)
        const parentFamId = getFamilyId(person.parentId1, person.parentId2);
        if (parentFamId) {
            // Get potential parents
            const parent1 = people.find(p => p.id === person.parentId1);
            const parent2 = people.find(p => p.id === person.parentId2);

            // Helper to extract year from date string (e.g., "1974", "12 JAN 1990")
            const getYear = (dateStr?: string): number | null => {
                if (!dateStr) return null;
                const match = dateStr.match(/\d{4}/);
                return match ? parseInt(match[0], 10) : null;
            };

            const personYear = getYear(person.birthDate);
            const p1Year = getYear(parent1?.birthDate);
            const p2Year = getYear(parent2?.birthDate);

            // Validate: parents should be older than children (allow for unknown dates)
            const p1Valid = !p1Year || !personYear || p1Year < personYear;
            const p2Valid = !p2Year || !personYear || p2Year < personYear;

            if (p1Valid && p2Valid) {
                lines.push(`1 FAMC ${parentFamId}`);
            } else {
                console.warn(`[GEDCOM Export] Skipping invalid parent link for ${person.firstName} ${person.lastName}: parent born after child`);
            }
        }

        // Link to spouse families
        for (const spouseId of (person.spouseIds || [])) {
            const spouseFamId = getFamilyId(person.id, spouseId);
            if (spouseFamId) {
                lines.push(`1 FAMS ${spouseFamId}`);
            }
        }
    }

    // Create FAM records for families
    for (const [key, famId] of familyMap) {
        const [id1, id2] = key.split('-');
        console.log(`[Export] Building FAM ${famId}: key="${key}", id1="${id1}", id2="${id2}"`);

        lines.push(`0 ${famId} FAM`);

        // Find parents
        const parent1 = people.find(p => p.id === id1);
        const parent2 = people.find(p => p.id === id2);
        console.log(`[Export] FAM ${famId}: parent1=${parent1?.firstName || 'NOT FOUND'} (${id1}), parent2=${parent2?.firstName || 'NOT FOUND'} (${id2})`);

        // Assign HUSB/WIFE based on gender
        // Determine the roles based on available gender info
        let parent1Tag: 'HUSB' | 'WIFE' | null = null;
        let parent2Tag: 'HUSB' | 'WIFE' | null = null;

        if (parent1 && parent2) {
            // Both parents exist - determine roles
            if (parent1.gender === 'male') {
                parent1Tag = 'HUSB';
                parent2Tag = 'WIFE';
            } else if (parent1.gender === 'female') {
                parent1Tag = 'WIFE';
                parent2Tag = 'HUSB';
            } else if (parent2.gender === 'male') {
                parent2Tag = 'HUSB';
                parent1Tag = 'WIFE';
            } else if (parent2.gender === 'female') {
                parent2Tag = 'WIFE';
                parent1Tag = 'HUSB';
            } else {
                // Both unknown - default assignment
                parent1Tag = 'HUSB';
                parent2Tag = 'WIFE';
            }
        } else if (parent1) {
            parent1Tag = parent1.gender === 'female' ? 'WIFE' : 'HUSB';
        } else if (parent2) {
            parent2Tag = parent2.gender === 'female' ? 'WIFE' : 'HUSB';
        }

        if (parent1 && parent1Tag) {
            console.log(`[Export] FAM ${famId}: Writing ${parent1Tag} for ${parent1.firstName} (gender=${parent1.gender})`);
            lines.push(`1 ${parent1Tag} @I${parent1.id}@`);
        }
        if (parent2 && parent2Tag) {
            console.log(`[Export] FAM ${famId}: Writing ${parent2Tag} for ${parent2.firstName} (gender=${parent2.gender})`);
            lines.push(`1 ${parent2Tag} @I${parent2.id}@`);
        }

        // Find children of this family
        const children = people.filter(p => {
            const parents = [p.parentId1, p.parentId2].filter(Boolean).sort();
            const familyParents = [id1, id2].filter(Boolean).sort();
            return parents.length > 0 && parents.join('-') === familyParents.join('-');
        });

        console.log(`[Export] Family ${famId}: children=${children.map(c => c.firstName).join(', ') || 'none'}`);

        for (const child of children) {
            lines.push(`1 CHIL @I${child.id}@`);
        }
    }

    // Trailer
    lines.push('0 TRLR');

    console.log(`[Export] Generated ${familyMap.size} families`);
    console.log('=== GEDCOM EXPORT END ===');

    return lines.join('\n');
}

export function downloadGedcom(people: Person[], treeName: string): void {
    const gedcomContent = generateGedcom(people, treeName);
    const blob = new Blob([gedcomContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${treeName.replace(/[^a-zA-Z0-9]/g, '_')}.ged`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Pre-export validation types
export interface ExportIssue {
    severity: 'error' | 'warning';
    personId: string;
    personName: string;
    issue: string;
    howToFix: string;
}

export interface ExportValidationResult {
    hasErrors: boolean;
    hasWarnings: boolean;
    issues: ExportIssue[];
}

/**
 * Validate tree data before GEDCOM export
 * Checks for potential issues that could cause problems on import
 */
export function validateTreeForExport(people: Person[]): ExportValidationResult {
    const issues: ExportIssue[] = [];
    const personMap = new Map(people.map(p => [p.id, p]));

    // Helper to get person name
    const getName = (p: Person) => `${p.firstName || 'Unknown'} ${p.lastName || ''}`.trim();

    // Helper to parse year from date string
    const getYear = (dateStr?: string): number | null => {
        if (!dateStr) return null;
        const match = dateStr.match(/\d{4}/);
        return match ? parseInt(match[0], 10) : null;
    };

    for (const person of people) {
        const personName = getName(person);

        // Check 1: Invalid or missing gender
        if (!person.gender || person.gender === 'unknown' || person.gender === 'other') {
            issues.push({
                severity: 'error',
                personId: person.id,
                personName,
                issue: `Gender is "${person.gender || 'not set'}"`,
                howToFix: 'Edit this person and select either Male or Female as their gender.'
            });
        }

        // Check 2: Missing first name
        if (!person.firstName || person.firstName.trim() === '' || person.firstName === 'New Person') {
            issues.push({
                severity: 'warning',
                personId: person.id,
                personName,
                issue: 'Missing or default first name',
                howToFix: 'Edit this person and enter their first name.'
            });
        }

        // Check 3: Parent is younger than child
        const personYear = getYear(person.birthDate);
        if (personYear) {
            if (person.parentId1) {
                const parent1 = personMap.get(person.parentId1);
                if (parent1) {
                    const parent1Year = getYear(parent1.birthDate);
                    if (parent1Year && parent1Year >= personYear) {
                        issues.push({
                            severity: 'error',
                            personId: person.id,
                            personName,
                            issue: `Parent "${getName(parent1)}" (born ${parent1Year}) is not older than child (born ${personYear})`,
                            howToFix: 'Check and correct the birth dates for this person and their parent, or remove the incorrect parent relationship.'
                        });
                    }
                }
            }
            if (person.parentId2) {
                const parent2 = personMap.get(person.parentId2);
                if (parent2) {
                    const parent2Year = getYear(parent2.birthDate);
                    if (parent2Year && parent2Year >= personYear) {
                        issues.push({
                            severity: 'error',
                            personId: person.id,
                            personName,
                            issue: `Parent "${getName(parent2)}" (born ${parent2Year}) is not older than child (born ${personYear})`,
                            howToFix: 'Check and correct the birth dates for this person and their parent, or remove the incorrect parent relationship.'
                        });
                    }
                }
            }
        }

        // Check 4: Cyclic parent-child relationship (A is parent of B, and B is parent of A)
        if (person.parentId1) {
            const parent1 = personMap.get(person.parentId1);
            if (parent1 && (parent1.parentId1 === person.id || parent1.parentId2 === person.id)) {
                issues.push({
                    severity: 'error',
                    personId: person.id,
                    personName,
                    issue: `Circular relationship: "${personName}" is both a parent and child of "${getName(parent1)}"`,
                    howToFix: 'Edit relationships for one of these people and remove the incorrect parent-child link.'
                });
            }
        }

        // Check 5: Orphaned relationship references (pointing to non-existent people)
        if (person.parentId1 && !personMap.has(person.parentId1)) {
            issues.push({
                severity: 'warning',
                personId: person.id,
                personName,
                issue: 'References a parent that no longer exists in the tree',
                howToFix: 'Edit this person and update or remove the parent relationship.'
            });
        }
        if (person.parentId2 && !personMap.has(person.parentId2)) {
            issues.push({
                severity: 'warning',
                personId: person.id,
                personName,
                issue: 'References a parent that no longer exists in the tree',
                howToFix: 'Edit this person and update or remove the parent relationship.'
            });
        }
        for (const spouseId of person.spouseIds || []) {
            if (!personMap.has(spouseId)) {
                issues.push({
                    severity: 'warning',
                    personId: person.id,
                    personName,
                    issue: 'References a spouse that no longer exists in the tree',
                    howToFix: 'Edit this person and update or remove the spouse relationship.'
                });
            }
        }
    }

    // Deduplicate issues (same person + same issue type)
    const uniqueIssues = issues.filter((issue, index, self) =>
        index === self.findIndex(i => i.personId === issue.personId && i.issue === issue.issue)
    );

    return {
        hasErrors: uniqueIssues.some(i => i.severity === 'error'),
        hasWarnings: uniqueIssues.some(i => i.severity === 'warning'),
        issues: uniqueIssues
    };
}

/**
 * Get orphaned reference fixes for a tree
 * Returns a map of personId -> updates needed to fix orphaned references
 */
export interface OrphanedReferenceFix {
    personId: string;
    personName: string;
    updates: {
        spouseIds?: string[];
        parentId1?: null;
        parentId2?: null;
        childrenIds?: string[];
    };
    description: string;
}

export function getOrphanedReferenceFixes(people: Person[]): OrphanedReferenceFix[] {
    const fixes: OrphanedReferenceFix[] = [];
    const personIds = new Set(people.map(p => p.id));

    const getName = (p: Person) => `${p.firstName || 'Unknown'} ${p.lastName || ''}`.trim();

    for (const person of people) {
        const updates: OrphanedReferenceFix['updates'] = {};
        const descriptions: string[] = [];

        // Check for orphaned spouseIds
        const validSpouseIds = (person.spouseIds || []).filter(id => personIds.has(id));
        if (validSpouseIds.length !== (person.spouseIds || []).length) {
            updates.spouseIds = validSpouseIds;
            const orphanedCount = (person.spouseIds || []).length - validSpouseIds.length;
            descriptions.push(`Removed ${orphanedCount} orphaned spouse reference(s)`);
        }

        // Check for orphaned parentId1
        if (person.parentId1 && !personIds.has(person.parentId1)) {
            updates.parentId1 = null;
            descriptions.push('Removed orphaned parent1 reference');
        }

        // Check for orphaned parentId2
        if (person.parentId2 && !personIds.has(person.parentId2)) {
            updates.parentId2 = null;
            descriptions.push('Removed orphaned parent2 reference');
        }

        // Check for orphaned childrenIds
        const validChildrenIds = (person.childrenIds || []).filter(id => personIds.has(id));
        if (validChildrenIds.length !== (person.childrenIds || []).length) {
            updates.childrenIds = validChildrenIds;
            const orphanedCount = (person.childrenIds || []).length - validChildrenIds.length;
            descriptions.push(`Removed ${orphanedCount} orphaned children reference(s)`);
        }

        if (Object.keys(updates).length > 0) {
            fixes.push({
                personId: person.id,
                personName: getName(person),
                updates,
                description: descriptions.join('; ')
            });
        }
    }

    return fixes;
}

