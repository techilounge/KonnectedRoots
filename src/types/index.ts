
export interface Person {
  id: string;
  name: string;
  birthDate?: string;
  deathDate?: string;
  profilePictureUrl?: string;
  gender?: 'male' | 'female' | 'neutral' | 'other';
  origin?: string; // For AI name suggestion
  historicalPeriod?: string; // For AI name suggestion
  notes?: string;
  // For tree structure, simple parent/child/spouse IDs
  parentId1?: string;
  parentId2?: string;
  spouseIds?: string[];
  childrenIds?: string[];
  // For canvas positioning (example)
  x?: number;
  y?: number;
}

export interface FamilyTree {
  id: string;
  name: string;
  memberCount: number;
  lastUpdated: string; // ISO date string
  // members?: Person[]; // Optionally store members directly or fetch separately
}

export interface NameSuggestion {
  name: string;
  reason: string;
}
