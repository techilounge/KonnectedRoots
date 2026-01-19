'use server';

/**
 * Comprehensive relationship calculator using common ancestor approach
 * Handles: siblings, parents, grandparents, great-grandparents, uncles/aunts,
 * great-uncles/aunts, cousins, cousins once/twice removed, and all by-marriage variants
 */

type PersonInfo = {
    id: string;
    firstName: string;
    lastName?: string;
    gender: 'male' | 'female' | 'other' | 'unknown' | null;
    parentId1?: string | null;
    parentId2?: string | null;
    spouseIds?: string[];
    childrenIds?: string[];
};

export type FindRelationshipInput = {
    person1: PersonInfo;
    person2: PersonInfo;
    allPeople: PersonInfo[];
};

export type FindRelationshipOutput = {
    relationship: string;
    explanation: string;
    pathDescription?: string;
};

export async function findRelationship(input: FindRelationshipInput): Promise<FindRelationshipOutput> {
    const { person1, person2, allPeople } = input;
    const peopleMap = new Map(allPeople.map(p => [p.id, p]));

    const p1Name = `${person1.firstName} ${person1.lastName || ''}`.trim();
    const p2Name = `${person2.firstName} ${person2.lastName || ''}`.trim();

    // Same person check
    if (person1.id === person2.id) {
        return { relationship: "Same Person", explanation: "These are the same person." };
    }

    // Get all ancestors of a person with their generation level
    const getAncestors = (person: PersonInfo): Map<string, number> => {
        const ancestors = new Map<string, number>();
        const queue: { id: string; gen: number }[] = [];

        if (person.parentId1) queue.push({ id: person.parentId1, gen: 1 });
        if (person.parentId2) queue.push({ id: person.parentId2, gen: 1 });

        while (queue.length > 0) {
            const { id, gen } = queue.shift()!;
            if (ancestors.has(id)) continue;
            ancestors.set(id, gen);

            const p = peopleMap.get(id);
            if (p) {
                if (p.parentId1) queue.push({ id: p.parentId1, gen: gen + 1 });
                if (p.parentId2) queue.push({ id: p.parentId2, gen: gen + 1 });
            }
        }
        return ancestors;
    };

    // Check if spouse
    const areSpouses = (a: PersonInfo, b: PersonInfo): boolean => {
        return (a.spouseIds || []).includes(b.id) || (b.spouseIds || []).includes(a.id);
    };

    // Spouse check
    if (areSpouses(person1, person2)) {
        return { relationship: "Spouse", explanation: `${p1Name} and ${p2Name} are married.` };
    }

    // Get ancestors for both
    const ancestors1 = getAncestors(person1);
    const ancestors2 = getAncestors(person2);

    // Check if person2 is ancestor of person1
    if (ancestors1.has(person2.id)) {
        const gen = ancestors1.get(person2.id)!;
        return getAncestorRelationship(person2, gen, p1Name, p2Name);
    }

    // Check if person1 is ancestor of person2
    if (ancestors2.has(person1.id)) {
        const gen = ancestors2.get(person1.id)!;
        return getDescendantRelationship(person2, gen, p1Name, p2Name);
    }

    // Find common ancestor
    let commonAncestor: string | null = null;
    let gen1 = 0;
    let gen2 = 0;

    for (const [ancestorId, g1] of ancestors1) {
        if (ancestors2.has(ancestorId)) {
            const g2 = ancestors2.get(ancestorId)!;
            // Pick the closest common ancestor
            if (!commonAncestor || (g1 + g2) < (gen1 + gen2)) {
                commonAncestor = ancestorId;
                gen1 = g1;
                gen2 = g2;
            }
        }
    }

    if (commonAncestor) {
        const ancestor = peopleMap.get(commonAncestor);
        const ancestorName = ancestor ? `${ancestor.firstName} ${ancestor.lastName || ''}`.trim() : 'common ancestor';
        return getCousinRelationship(gen1, gen2, p1Name, p2Name, ancestorName, person2.gender || 'unknown');
    }

    // Check for in-law relationships through spouses
    const spouses1 = (person1.spouseIds || []).map(id => peopleMap.get(id)).filter(Boolean) as PersonInfo[];
    for (const spouse of spouses1) {
        const spouseAncestors = getAncestors(spouse);

        // Check if person2 is ancestor of spouse (parent-in-law, grandparent-in-law, etc.)
        if (spouseAncestors.has(person2.id)) {
            const gen = spouseAncestors.get(person2.id)!;
            return getInLawAncestorRelationship(person2, gen, p1Name, p2Name, spouse.firstName);
        }

        // Check if person2 is a descendant of spouse (child-in-law situation or nephew/niece by marriage)
        // First check if spouse is ancestor of person2
        const person2Ancestors = getAncestors(person2);
        if (person2Ancestors.has(spouse.id)) {
            const gen = person2Ancestors.get(spouse.id)!;
            // Person2 is descendant of spouse - this makes them related by marriage
            return getStepOrMarriageDescendant(person2, gen, p1Name, p2Name, spouse.firstName);
        }

        // Check if they share an ancestor through spouse (sibling-in-law, cousin-in-law, etc.)
        for (const [ancestorId, g1] of spouseAncestors) {
            if (ancestors2.has(ancestorId)) {
                const g2 = ancestors2.get(ancestorId)!;
                // person1's spouse is g1 gens from ancestor, person2 is g2 gens from ancestor
                return getInLawCousinRelationship(g1, g2, p1Name, p2Name, person2.gender || 'unknown', spouse.firstName);
            }
        }
    }

    return {
        relationship: "Not Directly Related",
        explanation: `Could not determine a direct family relationship between ${p1Name} and ${p2Name}. They may be distantly related or not related.`
    };
}

function getAncestorRelationship(ancestor: PersonInfo, generations: number, p1Name: string, p2Name: string): FindRelationshipOutput {
    const isFemale = ancestor.gender === 'female';

    if (generations === 1) {
        return {
            relationship: isFemale ? "Mother" : "Father",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'mother' : 'father'}.`
        };
    } else if (generations === 2) {
        return {
            relationship: isFemale ? "Grandmother" : "Grandfather",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'grandmother' : 'grandfather'}.`
        };
    } else {
        const greats = generations - 2;
        const prefix = greats === 1 ? "Great-" : `${greats}x Great-`;
        return {
            relationship: prefix + (isFemale ? "Grandmother" : "Grandfather"),
            explanation: `${p2Name} is ${p1Name}'s ${prefix.toLowerCase()}${isFemale ? 'grandmother' : 'grandfather'} (${generations} generations up).`
        };
    }
}

function getDescendantRelationship(descendant: PersonInfo, generations: number, p1Name: string, p2Name: string): FindRelationshipOutput {
    const isFemale = descendant.gender === 'female';

    if (generations === 1) {
        return {
            relationship: isFemale ? "Daughter" : "Son",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'daughter' : 'son'}.`
        };
    } else if (generations === 2) {
        return {
            relationship: isFemale ? "Granddaughter" : "Grandson",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'granddaughter' : 'grandson'}.`
        };
    } else {
        const greats = generations - 2;
        const prefix = greats === 1 ? "Great-" : `${greats}x Great-`;
        return {
            relationship: prefix + (isFemale ? "Granddaughter" : "Grandson"),
            explanation: `${p2Name} is ${p1Name}'s ${prefix.toLowerCase()}${isFemale ? 'granddaughter' : 'grandson'} (${generations} generations down).`
        };
    }
}

function getStepOrMarriageDescendant(descendant: PersonInfo, generations: number, p1Name: string, p2Name: string, spouseName: string): FindRelationshipOutput {
    const isFemale = descendant.gender === 'female';

    if (generations === 1) {
        return {
            relationship: isFemale ? "Step-Daughter" : "Step-Son",
            explanation: `${p2Name} is ${p1Name}'s step-${isFemale ? 'daughter' : 'son'} (child of spouse ${spouseName}).`
        };
    } else if (generations === 2) {
        return {
            relationship: isFemale ? "Step-Granddaughter" : "Step-Grandson",
            explanation: `${p2Name} is ${p1Name}'s step-${isFemale ? 'granddaughter' : 'grandson'} (grandchild of spouse ${spouseName}).`
        };
    } else if (generations === 3) {
        return {
            relationship: isFemale ? "Step-Great-Granddaughter" : "Step-Great-Grandson",
            explanation: `${p2Name} is ${p1Name}'s step-great-${isFemale ? 'granddaughter' : 'grandson'} (great-grandchild of spouse ${spouseName}).`
        };
    } else {
        const greats = generations - 2;
        const prefix = greats === 1 ? "Step-Great-" : `Step-${greats}x Great-`;
        return {
            relationship: prefix + (isFemale ? "Granddaughter" : "Grandson"),
            explanation: `${p2Name} is ${p1Name}'s step-${isFemale ? 'granddaughter' : 'grandson'} (${generations} generations through spouse ${spouseName}).`
        };
    }
}

function getCousinRelationship(gen1: number, gen2: number, p1Name: string, p2Name: string, ancestorName: string, p2Gender: string): FindRelationshipOutput {
    const isFemale = p2Gender === 'female';

    // Siblings (both 1 gen from common ancestor/parent)
    if (gen1 === 1 && gen2 === 1) {
        return {
            relationship: isFemale ? "Sister" : "Brother",
            explanation: `${p1Name} and ${p2Name} are siblings (share parent ${ancestorName}).`
        };
    }

    // Uncle/Aunt - Nephew/Niece (1 and 2 generations)
    if (gen1 === 2 && gen2 === 1) {
        // Person2 is 1 gen from ancestor, person1 is 2 gen → person2 is uncle/aunt
        return {
            relationship: isFemale ? "Aunt" : "Uncle",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'aunt' : 'uncle'}. They share ancestor ${ancestorName}.`
        };
    }
    if (gen1 === 1 && gen2 === 2) {
        // Person1 is 1 gen, person2 is 2 gen → person2 is nephew/niece
        return {
            relationship: isFemale ? "Niece" : "Nephew",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'niece' : 'nephew'}. They share ancestor ${ancestorName}.`
        };
    }

    // Great Uncle/Aunt - Grand Nephew/Niece
    if (gen1 === 3 && gen2 === 1) {
        return {
            relationship: isFemale ? "Great-Aunt" : "Great-Uncle",
            explanation: `${p2Name} is ${p1Name}'s great-${isFemale ? 'aunt' : 'uncle'}. They share ancestor ${ancestorName}.`
        };
    }
    if (gen1 === 1 && gen2 === 3) {
        return {
            relationship: isFemale ? "Grand-Niece" : "Grand-Nephew",
            explanation: `${p2Name} is ${p1Name}'s grand-${isFemale ? 'niece' : 'nephew'}. They share ancestor ${ancestorName}.`
        };
    }

    // Generalized great-uncle/aunt and grand-nephew/niece
    if (gen2 === 1 && gen1 > 2) {
        const greats = gen1 - 2;
        const prefix = greats === 1 ? "Great-" : `${greats}x Great-`;
        return {
            relationship: prefix + (isFemale ? "Aunt" : "Uncle"),
            explanation: `${p2Name} is ${p1Name}'s ${prefix.toLowerCase()}${isFemale ? 'aunt' : 'uncle'}.`
        };
    }
    if (gen1 === 1 && gen2 > 2) {
        const greats = gen2 - 2;
        const prefix = greats === 1 ? "Grand-" : `${greats}x Grand-`;
        return {
            relationship: prefix + (isFemale ? "Niece" : "Nephew"),
            explanation: `${p2Name} is ${p1Name}'s ${prefix.toLowerCase()}${isFemale ? 'niece' : 'nephew'}.`
        };
    }

    // Cousins
    const minGen = Math.min(gen1, gen2);
    const removed = Math.abs(gen1 - gen2);

    const cousinNumber = minGen - 1;
    const cousinOrdinal = getOrdinal(cousinNumber);

    if (removed === 0) {
        return {
            relationship: `${cousinOrdinal} Cousin`,
            explanation: `${p1Name} and ${p2Name} are ${cousinOrdinal.toLowerCase()} cousins. They share ancestor ${ancestorName}.`
        };
    } else {
        const removedText = removed === 1 ? "Once Removed" : removed === 2 ? "Twice Removed" : `${removed}x Removed`;
        return {
            relationship: `${cousinOrdinal} Cousin ${removedText}`,
            explanation: `${p1Name} and ${p2Name} are ${cousinOrdinal.toLowerCase()} cousins ${removedText.toLowerCase()}. They share ancestor ${ancestorName}.`
        };
    }
}

function getInLawAncestorRelationship(ancestor: PersonInfo, generations: number, p1Name: string, p2Name: string, spouseName: string): FindRelationshipOutput {
    const isFemale = ancestor.gender === 'female';

    if (generations === 1) {
        return {
            relationship: isFemale ? "Mother-in-Law" : "Father-in-Law",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'mother' : 'father'}-in-law (parent of spouse ${spouseName}).`
        };
    } else if (generations === 2) {
        return {
            relationship: isFemale ? "Grandmother-in-Law" : "Grandfather-in-Law",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'grandmother' : 'grandfather'}-in-law (grandparent of spouse ${spouseName}).`
        };
    } else {
        return {
            relationship: (isFemale ? "Grandmother" : "Grandfather") + "-in-Law",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'grandmother' : 'grandfather'}-in-law (${generations} generations up from spouse ${spouseName}).`
        };
    }
}

function getInLawCousinRelationship(gen1: number, gen2: number, p1Name: string, p2Name: string, p2Gender: string, spouseName: string): FindRelationshipOutput {
    const isFemale = p2Gender === 'female';

    // Sibling-in-law (spouse's sibling)
    if (gen1 === 1 && gen2 === 1) {
        return {
            relationship: isFemale ? "Sister-in-Law" : "Brother-in-Law",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'sister' : 'brother'}-in-law (sibling of spouse ${spouseName}).`
        };
    }

    // Nephew/Niece by marriage (child of spouse's sibling)
    if (gen1 === 1 && gen2 === 2) {
        return {
            relationship: (isFemale ? "Niece" : "Nephew") + " (by Marriage)",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'niece' : 'nephew'} by marriage (child of spouse ${spouseName}'s sibling).`
        };
    }
    // Uncle/Aunt by marriage (spouse's parent's sibling)
    if (gen1 === 2 && gen2 === 1) {
        return {
            relationship: (isFemale ? "Aunt" : "Uncle") + " (by Marriage)",
            explanation: `${p2Name} is ${p1Name}'s ${isFemale ? 'aunt' : 'uncle'} by marriage (through spouse ${spouseName}).`
        };
    }

    // Grand-nephew/niece by marriage (grandchild of spouse's sibling)
    if (gen1 === 1 && gen2 === 3) {
        return {
            relationship: (isFemale ? "Grand-Niece" : "Grand-Nephew") + " (by Marriage)",
            explanation: `${p2Name} is ${p1Name}'s grand-${isFemale ? 'niece' : 'nephew'} by marriage (grandchild of spouse ${spouseName}'s sibling).`
        };
    }
    if (gen1 === 3 && gen2 === 1) {
        return {
            relationship: (isFemale ? "Great-Aunt" : "Great-Uncle") + " (by Marriage)",
            explanation: `${p2Name} is ${p1Name}'s great-${isFemale ? 'aunt' : 'uncle'} by marriage (through spouse ${spouseName}).`
        };
    }

    // Great-grand-nephew/niece by marriage (great-grandchild of spouse's sibling)
    if (gen1 === 1 && gen2 === 4) {
        return {
            relationship: (isFemale ? "Great-Grand-Niece" : "Great-Grand-Nephew") + " (by Marriage)",
            explanation: `${p2Name} is ${p1Name}'s great-grand-${isFemale ? 'niece' : 'nephew'} by marriage.`
        };
    }

    // Generalized nephew/niece by marriage for deeper generations
    if (gen1 === 1 && gen2 > 2) {
        const depth = gen2 - 2;
        const prefix = depth === 1 ? "Grand-" : depth === 2 ? "Great-Grand-" : `${depth}x Grand-`;
        return {
            relationship: prefix + (isFemale ? "Niece" : "Nephew") + " (by Marriage)",
            explanation: `${p2Name} is ${p1Name}'s ${prefix.toLowerCase()}${isFemale ? 'niece' : 'nephew'} by marriage (${gen2} generations from spouse ${spouseName}'s sibling).`
        };
    }

    // Generalized uncle/aunt by marriage for deeper generations
    if (gen2 === 1 && gen1 > 2) {
        const depth = gen1 - 2;
        const prefix = depth === 1 ? "Great-" : `${depth}x Great-`;
        return {
            relationship: prefix + (isFemale ? "Aunt" : "Uncle") + " (by Marriage)",
            explanation: `${p2Name} is ${p1Name}'s ${prefix.toLowerCase()}${isFemale ? 'aunt' : 'uncle'} by marriage.`
        };
    }

    // Cousins by marriage (both gen >= 2)
    if (gen1 >= 2 && gen2 >= 2) {
        const minGen = Math.min(gen1, gen2);
        const removed = Math.abs(gen1 - gen2);
        const cousinNumber = minGen - 1;
        const cousinOrdinal = getOrdinal(cousinNumber);

        if (removed === 0) {
            return {
                relationship: `${cousinOrdinal} Cousin (by Marriage)`,
                explanation: `${p2Name} is ${p1Name}'s ${cousinOrdinal.toLowerCase()} cousin by marriage (through spouse ${spouseName}).`
            };
        } else {
            const removedText = removed === 1 ? "Once Removed" : removed === 2 ? "Twice Removed" : `${removed}x Removed`;
            return {
                relationship: `${cousinOrdinal} Cousin ${removedText} (by Marriage)`,
                explanation: `${p2Name} is ${p1Name}'s ${cousinOrdinal.toLowerCase()} cousin ${removedText.toLowerCase()} by marriage.`
            };
        }
    }

    return {
        relationship: "Extended Family (by Marriage)",
        explanation: `${p2Name} is related to ${p1Name} by marriage through spouse ${spouseName}.`
    };
}

function getOrdinal(n: number): string {
    if (n === 1) return "First";
    if (n === 2) return "Second";
    if (n === 3) return "Third";
    if (n === 4) return "Fourth";
    if (n === 5) return "Fifth";
    if (n === 6) return "Sixth";
    if (n === 7) return "Seventh";
    if (n === 8) return "Eighth";
    return `${n}th`;
}
