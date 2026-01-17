/**
 * GEDCOM 5.5.1 format parser for importing family tree data
 * Parses GEDCOM files and extracts individuals and family relationships
 */

import type { Person } from '@/types';

export interface ParsedIndividual {
    id: string;          // GEDCOM INDI @I1@ -> "I1"
    gedcomId: string;    // Full @I1@
    firstName: string;
    middleName?: string;
    lastName?: string;
    maidenName?: string;
    nickname?: string;
    gender: 'male' | 'female' | 'other' | 'unknown';
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
    occupation?: string;
    education?: string;
    religion?: string;
    biography?: string;
    isDeceased: boolean;
}

export interface ParsedFamily {
    id: string;           // FAM @F1@ -> "F1"
    gedcomId: string;     // Full @F1@
    husbandId?: string;   // GEDCOM ID of husband
    wifeId?: string;      // GEDCOM ID of wife
    childrenIds: string[]; // GEDCOM IDs of children
}

export interface GedcomParseResult {
    individuals: ParsedIndividual[];
    families: ParsedFamily[];
    header: {
        source?: string;
        date?: string;
        charset?: string;
    };
    errors: string[];
}

/**
 * Parse a GEDCOM file content string
 */
export function parseGedcom(content: string): GedcomParseResult {
    const lines = content.split(/\r?\n/);
    const result: GedcomParseResult = {
        individuals: [],
        families: [],
        header: {},
        errors: [],
    };

    let currentLevel = -1;
    let currentRecord: 'INDI' | 'FAM' | 'HEAD' | null = null;
    let currentIndividual: Partial<ParsedIndividual> | null = null;
    let currentFamily: Partial<ParsedFamily> | null = null;
    let currentSubtag = '';

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum].trim();
        if (!line) continue;

        // Parse line: "0 @I1@ INDI" or "1 NAME John /Smith/"
        const match = line.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?(.+)$/);
        if (!match) {
            result.errors.push(`Line ${lineNum + 1}: Could not parse: ${line}`);
            continue;
        }

        const level = parseInt(match[1], 10);
        const xref = match[2] || null; // @I1@ or null
        const rest = match[3];

        // Level 0 starts a new record
        if (level === 0) {
            // Save previous record
            if (currentIndividual && currentIndividual.id) {
                result.individuals.push(finalizeIndividual(currentIndividual));
            }
            if (currentFamily && currentFamily.id) {
                result.families.push(finalizeFamily(currentFamily));
            }

            currentIndividual = null;
            currentFamily = null;
            currentSubtag = '';

            if (rest === 'INDI' && xref) {
                currentRecord = 'INDI';
                currentIndividual = {
                    id: extractId(xref),
                    gedcomId: xref,
                    firstName: '',
                    gender: 'unknown',
                    isDeceased: false,
                };
            } else if (rest === 'FAM' && xref) {
                currentRecord = 'FAM';
                currentFamily = {
                    id: extractId(xref),
                    gedcomId: xref,
                    childrenIds: [],
                };
            } else if (rest === 'HEAD') {
                currentRecord = 'HEAD';
            } else if (rest === 'TRLR') {
                currentRecord = null;
            } else {
                currentRecord = null;
            }
            continue;
        }

        // Process based on current record type
        if (currentRecord === 'INDI' && currentIndividual) {
            parseIndividualLine(level, rest, currentIndividual, currentSubtag);
            if (level === 1) {
                currentSubtag = rest.split(' ')[0];
            }
        } else if (currentRecord === 'FAM' && currentFamily) {
            parseFamilyLine(level, rest, currentFamily);
        } else if (currentRecord === 'HEAD') {
            parseHeaderLine(level, rest, result.header);
        }
    }

    // Save last record
    if (currentIndividual && currentIndividual.id) {
        result.individuals.push(finalizeIndividual(currentIndividual));
    }
    if (currentFamily && currentFamily.id) {
        result.families.push(finalizeFamily(currentFamily));
    }

    return result;
}

function extractId(xref: string): string {
    return xref.replace(/@/g, '');
}

function parseIndividualLine(
    level: number,
    rest: string,
    indi: Partial<ParsedIndividual>,
    currentSubtag: string
): void {
    const [tag, ...valueParts] = rest.split(' ');
    const value = valueParts.join(' ').trim();

    if (level === 1) {
        switch (tag) {
            case 'NAME':
                // Parse "FirstName MiddleName /LastName/"
                const nameMatch = value.match(/^(.+?)(?:\s+\/([^/]*)\/)?$/);
                if (nameMatch) {
                    const givenNames = nameMatch[1]?.trim() || '';
                    const surname = nameMatch[2]?.trim() || '';
                    const nameParts = givenNames.split(' ');
                    indi.firstName = nameParts[0] || '';
                    if (nameParts.length > 1) {
                        indi.middleName = nameParts.slice(1).join(' ');
                    }
                    indi.lastName = surname;
                }
                break;
            case 'SEX':
                if (value === 'M') indi.gender = 'male';
                else if (value === 'F') indi.gender = 'female';
                else indi.gender = 'other';
                break;
            case 'BIRT':
                // Will be followed by DATE/PLAC at level 2
                break;
            case 'DEAT':
                indi.isDeceased = true;
                break;
            case 'OCCU':
                indi.occupation = value;
                break;
            case 'EDUC':
                indi.education = value;
                break;
            case 'RELI':
                indi.religion = value;
                break;
            case 'NOTE':
                indi.biography = value;
                break;
        }
    } else if (level === 2) {
        switch (tag) {
            case 'GIVN':
                indi.firstName = value;
                break;
            case 'SURN':
                indi.lastName = value;
                break;
            case 'NICK':
                indi.nickname = value;
                break;
            case '_MARNM':
                indi.maidenName = value;
                break;
            case 'DATE':
                if (currentSubtag === 'BIRT') {
                    indi.birthDate = normalizeDate(value);
                } else if (currentSubtag === 'DEAT') {
                    indi.deathDate = normalizeDate(value);
                    indi.isDeceased = true;
                }
                break;
            case 'PLAC':
                if (currentSubtag === 'BIRT') {
                    indi.birthPlace = value;
                } else if (currentSubtag === 'DEAT') {
                    indi.deathPlace = value;
                }
                break;
            case 'CONT':
            case 'CONC':
                // Continuation of note
                if (currentSubtag === 'NOTE') {
                    indi.biography = (indi.biography || '') + (tag === 'CONT' ? '\n' : '') + value;
                }
                break;
        }
    }
}

function parseFamilyLine(
    level: number,
    rest: string,
    fam: Partial<ParsedFamily>
): void {
    const [tag, ...valueParts] = rest.split(' ');
    const value = valueParts.join(' ').trim();

    if (level === 1) {
        switch (tag) {
            case 'HUSB':
                fam.husbandId = extractId(value);
                break;
            case 'WIFE':
                fam.wifeId = extractId(value);
                break;
            case 'CHIL':
                if (!fam.childrenIds) fam.childrenIds = [];
                fam.childrenIds.push(extractId(value));
                break;
        }
    }
}

function parseHeaderLine(
    level: number,
    rest: string,
    header: GedcomParseResult['header']
): void {
    const [tag, ...valueParts] = rest.split(' ');
    const value = valueParts.join(' ').trim();

    if (level === 1) {
        switch (tag) {
            case 'SOUR':
                header.source = value;
                break;
            case 'DATE':
                header.date = value;
                break;
            case 'CHAR':
                header.charset = value;
                break;
        }
    }
}

function normalizeDate(gedcomDate: string): string {
    // GEDCOM dates can be like "1 JAN 1990" or "JAN 1990" or "1990"
    // Try to normalize to YYYY-MM-DD or just return as-is
    const months: Record<string, string> = {
        JAN: '01', FEB: '02', MAR: '03', APR: '04',
        MAY: '05', JUN: '06', JUL: '07', AUG: '08',
        SEP: '09', OCT: '10', NOV: '11', DEC: '12',
    };

    const parts = gedcomDate.toUpperCase().split(' ').filter(Boolean);

    if (parts.length === 3) {
        // "1 JAN 1990"
        const day = parts[0].padStart(2, '0');
        const month = months[parts[1]] || '01';
        const year = parts[2];
        return `${year}-${month}-${day}`;
    } else if (parts.length === 2) {
        // "JAN 1990"
        const month = months[parts[0]] || '01';
        const year = parts[1];
        return `${year}-${month}`;
    } else if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
        // "1990"
        return parts[0];
    }

    return gedcomDate; // Return as-is if can't parse
}

function finalizeIndividual(indi: Partial<ParsedIndividual>): ParsedIndividual {
    return {
        id: indi.id || '',
        gedcomId: indi.gedcomId || '',
        firstName: indi.firstName || 'Unknown',
        middleName: indi.middleName,
        lastName: indi.lastName,
        maidenName: indi.maidenName,
        nickname: indi.nickname,
        gender: indi.gender || 'unknown',
        birthDate: indi.birthDate,
        birthPlace: indi.birthPlace,
        deathDate: indi.deathDate,
        deathPlace: indi.deathPlace,
        occupation: indi.occupation,
        education: indi.education,
        religion: indi.religion,
        biography: indi.biography,
        isDeceased: indi.isDeceased || false,
    };
}

function finalizeFamily(fam: Partial<ParsedFamily>): ParsedFamily {
    return {
        id: fam.id || '',
        gedcomId: fam.gedcomId || '',
        husbandId: fam.husbandId,
        wifeId: fam.wifeId,
        childrenIds: fam.childrenIds || [],
    };
}

/**
 * Convert parsed GEDCOM data to Person objects ready for Firestore
 */
export function convertToPeople(
    parseResult: GedcomParseResult,
    ownerId: string,
    treeId: string
): Omit<Person, 'createdAt' | 'updatedAt'>[] {
    const { individuals, families } = parseResult;

    // Build a map of GEDCOM ID to Person
    const idMap = new Map<string, string>(); // gedcomId -> new firestore-style id

    // Helper to remove undefined properties (Firestore doesn't accept undefined)
    const removeUndefined = <T extends Record<string, unknown>>(obj: T): T => {
        const result = {} as T;
        for (const key in obj) {
            if (obj[key] !== undefined) {
                result[key] = obj[key];
            }
        }
        return result;
    };

    // First pass: create base person objects
    const people: Omit<Person, 'createdAt' | 'updatedAt'>[] = individuals.map((indi) => {
        // Generate a unique ID for Firestore
        const newId = `imported_${indi.id}_${Date.now()}`;
        idMap.set(indi.id, newId);

        // Build person object, filtering out undefined values
        const person = removeUndefined({
            id: newId,
            ownerId,
            treeId,
            firstName: indi.firstName,
            middleName: indi.middleName,
            lastName: indi.lastName,
            maidenName: indi.maidenName,
            nickname: indi.nickname,
            gender: indi.gender,
            birthDate: indi.birthDate,
            placeOfBirth: indi.birthPlace,
            deathDate: indi.deathDate,
            placeOfDeath: indi.deathPlace,
            livingStatus: indi.isDeceased ? 'deceased' as const : 'living' as const,
            occupation: indi.occupation,
            education: indi.education,
            religion: indi.religion,
            biography: indi.biography,
            parentId1: undefined,
            parentId2: undefined,
            spouseIds: [] as string[],
            childrenIds: [] as string[],
        });

        return person;
    });

    // Second pass: apply relationships from FAM records
    for (const fam of families) {
        const husbandNewId = fam.husbandId ? idMap.get(fam.husbandId) : undefined;
        const wifeNewId = fam.wifeId ? idMap.get(fam.wifeId) : undefined;

        // Set spouse relationships
        if (husbandNewId && wifeNewId) {
            const husband = people.find(p => p.id === husbandNewId);
            const wife = people.find(p => p.id === wifeNewId);
            if (husband && wife) {
                husband.spouseIds = [...(husband.spouseIds || []), wifeNewId];
                wife.spouseIds = [...(wife.spouseIds || []), husbandNewId];
            }
        }

        // Set parent-child relationships
        for (const childGedcomId of fam.childrenIds) {
            const childNewId = idMap.get(childGedcomId);
            if (childNewId) {
                const child = people.find(p => p.id === childNewId);
                if (child) {
                    if (!child.parentId1) {
                        child.parentId1 = husbandNewId || wifeNewId;
                    } else if (!child.parentId2) {
                        child.parentId2 = wifeNewId || husbandNewId;
                    }
                }

                // Add to parents' childrenIds
                if (husbandNewId) {
                    const husband = people.find(p => p.id === husbandNewId);
                    if (husband) {
                        husband.childrenIds = [...(husband.childrenIds || []), childNewId];
                    }
                }
                if (wifeNewId) {
                    const wife = people.find(p => p.id === wifeNewId);
                    if (wife) {
                        wife.childrenIds = [...(wife.childrenIds || []), childNewId];
                    }
                }
            }
        }
    }

    return people;
}
