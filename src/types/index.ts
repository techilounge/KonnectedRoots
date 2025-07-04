
export type Relationship = 'parent' | 'child' | 'spouse';

export interface Person {
  id: string;
  // Name Details
  namePrefix?: string;
  firstName: string; // Changed from 'name'
  middleName?: string;
  lastName?: string;
  maidenName?: string;
  nameSuffix?: string;
  nickname?: string;

  // Basic Demographics
  gender: 'male' | 'female'; // Strictly 'male' or 'female'

  // Vital Dates & Places
  birthDate?: string;
  placeOfBirth?: string;
  deathDate?: string;
  placeOfDeath?: string;

  // Family Connections (IDs for linking, managed by canvas/other UI)
  parentId1?: string;
  parentId2?: string;
  spouseIds?: string[];
  childrenIds?: string[];

  // Status & Visibility
  livingStatus?: 'living' | 'deceased' | 'unknown';
  privacySetting?: 'public' | 'private' | 'invite-only';

  // Biographical Details
  occupation?: string;
  education?: string;
  religion?: string;
  biography?: string; // Was 'notes', now for life summary

  // Media & References
  profilePictureUrl?: string;
  sourceCitationsNotes?: string; // For additional photos/docs links and source citations

  // Identifiers
  externalId?: string;
  // konnectedRootsId is 'id'

  // For AI name suggestion (can be pre-filled from context)
  origin?: string;
  historicalPeriod?: string;

  // For canvas positioning (example)
  x?: number;
  y?: number;
}

export interface FamilyTree {
  id: string;
  name: string;
  memberCount: number;
  lastUpdated: string; // ISO date string
}

export type { SuggestNameInput, SuggestNameOutput } from '@/ai/flows/suggest-name';
export type { GenerateBiographyInput, GenerateBiographyOutput } from '@/ai/flows/generate-biography-flow';


export interface NameSuggestion {
  name: string;
  reason: string;
}
