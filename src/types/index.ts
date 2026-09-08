
export type Relationship = 'parent' | 'child' | 'spouse';

// Added RelationshipType for clarity in the new implementation
export type RelationshipType = 'spouse' | 'parent' | 'child';


export type PlatformRole = 'user' | 'admin' | 'super_admin';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  plan: "free" | "pro" | "team" | "family";
  role?: PlatformRole;
  isPlatformAdmin?: boolean;
  disabled?: boolean;
  entitlements: {
    maxTrees: number;
    maxPeoplePerTree: number;
    aiCreditsMonthly: number;
    exports: { pdf: boolean; png: boolean; gedcom: boolean };
  };
  usage?: {
    monthKey: string;
    exportsUsed: number;
    aiActionsUsed: number;
    aiActionsAllowance: number;
    storageUsedBytes: number;
  };
  emailPreferences?: {
    marketing: boolean;       // Activity digest, tips
    transactional: boolean;   // Always true (payments, security)
    treeActivity: boolean;    // Invitation accepted, tree changes
    reminders: boolean;       // Inactivity, plan expiring
  };
  billing?: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    status?: string;
    plan?: string;
    currentPeriodEnd?: any;
    cancelAtPeriodEnd?: boolean;
  };
  lastActivityAt?: any;       // serverTimestamp - for inactivity tracking
  welcomeEmailSent?: boolean;
  createdAt: any; // serverTimestamp
  updatedAt: any; // serverTimestamp
}

export interface FamilyTree {
  id: string;
  ownerId: string;
  title: string;
  slug: string; // SEO-friendly URL slug (e.g., "doe-family")
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
  gender: 'male' | 'female' | 'other' | 'unknown' | null;
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

// Layout History - for saving and restoring tree layouts
export interface LayoutSnapshot {
  id: string;
  treeId: string;
  createdAt: any; // Timestamp
  createdBy: string; // userId
  reason: 'auto' | 'manual' | 'pre_delete' | 'pre_merge' | 'pre_import';
  label?: string; // User-provided name for manual saves
  viewOffset: { x: number; y: number };
  zoomLevel: number;
  positions: {
    [personId: string]: { x: number; y: number };
  };
}

// -----------------------------------------------------------------------------
// Platform Admin Portal Types
// -----------------------------------------------------------------------------

export interface AdminActivityItem {
  id: string;
  type: 'signup' | 'upgrade' | 'downgrade' | 'tree_created' | 'gedcom_imported' | 'support_inquiry' | 'admin_action';
  title: string;
  description: string;
  timestamp: any;
  userEmail?: string;
  userName?: string;
  metadata?: Record<string, any>;
}

export interface AdminDashboardStats {
  aiModelSummary: string;
  aiSuccessRate: number | null;
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  familyUsers: number;
  totalTrees: number;
  totalPeople: number;
  totalAiActionsUsed: number;
  estimatedMRR: number;
  userGrowthSeries: { date: string; users: number; newUsers: number }[];
  planDistribution: { name: string; value: number; color: string }[];
  aiActionsSeries: { name: string; count: number; costEstimate: number }[];
  treeCreationSeries: { date: string; count: number }[];
  recentActivity: AdminActivityItem[];
  systemStatus: {
    status: 'operational' | 'degraded' | 'maintenance';
    latencyMs: number;
    lastChecked: string;
  };
}

export interface AdminUserItem {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  plan: 'free' | 'pro' | 'team' | 'family';
  role: PlatformRole;
  isPlatformAdmin?: boolean;
  disabled?: boolean;
  createdAt: any;
  lastActivityAt?: any;
  treesCount?: number;
  aiActionsUsed?: number;
  aiActionsAllowance?: number;
  exportsUsed?: number;
  stripeCustomerId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: any;
}

export interface AdminTreeItem {
  id: string;
  title: string;
  slug: string;
  ownerId: string;
  ownerEmail?: string;
  ownerName?: string;
  memberCount: number;
  visibility: 'private' | 'link' | 'public';
  collaboratorCount: number;
  collaborators?: Record<string, string>;
  createdAt: any;
  lastUpdated: any;
}

export interface SystemConfiguration {
  maintenanceMode: {
    enabled: boolean;
    message: string;
    allowedIps?: string[];
  };
  featureFlags: {
    aiFeatures: boolean;
    documentOcr: boolean;
    photoEnhancement: boolean;
    gedcomImports: boolean;
    newRegistrations: 'open' | 'invite-only' | 'paused';
  };
  planLimits: {
    free: { maxTrees: number; maxPeoplePerTree: number; aiCreditsMonthly: number; maxExportsPerMonth: number };
    pro: { maxTrees: number; maxPeoplePerTree: number; aiCreditsMonthly: number; maxExportsPerMonth: number };
    family: { maxTrees: number; maxPeoplePerTree: number; aiCreditsMonthly: number; maxSeats: number };
  };
  broadcastBanner?: {
    enabled: boolean;
    type: 'info' | 'warning' | 'success' | 'promo';
    message: string;
    linkUrl?: string;
    linkText?: string;
    dismissible?: boolean;
  };
  updatedAt?: any;
  updatedBy?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: any;
  adminUid: string;
  adminEmail: string;
  adminName?: string;
  action: string;
  category: 'user_management' | 'subscription' | 'tree_moderation' | 'configuration' | 'security';
  targetId?: string;
  targetType?: string;
  details: string;
  metadata?: Record<string, any>;
}

export interface ContactMessageItem {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'in_review' | 'resolved' | 'spam';
  createdAt: any;
  notes?: string;
}


