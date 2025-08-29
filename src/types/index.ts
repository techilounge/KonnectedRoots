
export type Relationship = 'parent' | 'child' | 'spouse';

// Added RelationshipType for clarity in the new implementation
export type RelationshipType = 'spouse' | 'parent' | 'child';


export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  plan: "free" | "pro" | "team";
  entitlements: {
    maxTrees: number;
    maxPeoplePerTree: number;
    aiCreditsMonthly: number;
    exports: { pdf: boolean; png: boolean; gedcom: boolean };
  };
  createdAt: any; // serverTimestamp
  updatedAt: any; // serverTimestamp
}

export interface FamilyTree {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  visibility: "private" | "link" | "public";
  collaborators: { [uid: string]: "viewer" | "editor" | "manager" };
  memberCount: number;
  lastUpdated: any; // serverTimestamp
  createdAt: any; // serverTimestamp
}

export interface Person {
  id: string;
  ownerId: string; // To associate person with a user
  treeId: string; // To associate person with a tree
  firstName: string;
  middleName?: string;
  lastName?: string;
  nickname?: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deathDate?: string;
  living?: boolean;
  placeOfBirth?: string;
  placeOfDeath?: string;
  photoURL?: string; // Stored in Cloud Storage
  x?: number;
  y?: number;
  createdAt: any; // serverTimestamp
  updatedAt: any; // serverTimestamp
  
  // These fields are from the old model and can be deprecated
  // Kept for reference during transition
  namePrefix?: string;
  maidenName?: string;
  nameSuffix?: string;
  parentId1?: string;
  parentId2?: string;
  spouseIds?: string[];
  childrenIds?: string[];
  livingStatus?: 'living' | 'deceased' | 'unknown';
  privacySetting?: 'public' | 'private' | 'invite-only';
  occupation?: string;
  education?: string;
  religion?: string;
  biography?: string;
  profilePictureUrl?: string;
  sourceCitationsNotes?: string;
  externalId?: string;
  origin?: string;
  historicalPeriod?: string;
}

export type { SuggestNameInput, SuggestNameOutput } from '@/ai/flows/suggest-name';
export type { GenerateBiographyInput, GenerateBiographyOutput } from '@/ai/flows/generate-biography-flow';


export interface NameSuggestion {
  name: string;
  reason: string;
}
