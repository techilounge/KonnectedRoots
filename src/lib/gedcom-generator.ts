/**
 * GEDCOM 5.5.1 format generator for family tree data
 * GEDCOM is the industry standard for genealogy data exchange
 */

import type { Person } from '@/types';

export function generateGedcom(people: Person[], treeName: string): string {
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

        // Link to parent family
        const parentFamId = getFamilyId(person.parentId1, person.parentId2);
        if (parentFamId) {
            lines.push(`1 FAMC ${parentFamId}`);
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
        lines.push(`0 ${famId} FAM`);

        // Find parents
        const parent1 = people.find(p => p.id === id1);
        const parent2 = people.find(p => p.id === id2);

        // Assign HUSB/WIFE based on gender
        if (parent1) {
            const tag = parent1.gender === 'female' ? 'WIFE' : 'HUSB';
            lines.push(`1 ${tag} @I${parent1.id}@`);
        }
        if (parent2) {
            const tag = parent2.gender === 'female' ? 'WIFE' : 'HUSB';
            lines.push(`1 ${tag} @I${parent2.id}@`);
        }

        // Find children of this family
        const children = people.filter(p => {
            const parents = [p.parentId1, p.parentId2].filter(Boolean).sort();
            const familyParents = [id1, id2].filter(Boolean).sort();
            return parents.length > 0 && parents.join('-') === familyParents.join('-');
        });

        for (const child of children) {
            lines.push(`1 CHIL @I${child.id}@`);
        }
    }

    // Trailer
    lines.push('0 TRLR');

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
