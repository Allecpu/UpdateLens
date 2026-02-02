export type FilterState = {
  targetCustomerIds: string[];
  targetGroupIds: string[];
  targetCssOwners: string[];
  products: string[];
  sources: string[];
  statuses: string[];
  categories: string[];
  tags: string[];
  waves: string[];
  months: string[];
  availabilityTypes: string[];
  enabledFor: string[];
  geography: string[];
  language: string[];
  bcVersions: string[];
  periodNewDays: number;
  periodChangedDays: number;
  releaseInDays: number;
  minBcVersionMin: number | null;
  releaseDateFrom: string;
  releaseDateTo: string;
  sortOrder: 'newest' | 'oldest';
  query: string;
  horizonMonths: number;
  historyMonths: number;
};

export type FilterPreset = {
  id: string;
  name: string;
  description?: string;
  filters: FilterState;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

// Sharing types
export type VisibilityScope = 'private' | 'all_users' | 'specific_users';

export interface PresetOwner {
  email: string;
  name: string | null;
}

export interface FilterPresetWithSharing extends FilterPreset {
  visibilityScope: VisibilityScope;
  owner: PresetOwner;
  isOwner: boolean;
}

export interface ShareInfo {
  email: string;
  name: string | null;
  permission: string;
  createdAt: string;
}

export interface SharingInfo {
  visibilityScope: VisibilityScope;
  shares: ShareInfo[];
}

export interface UserInfo {
  tenantId: string;
  objectId: string;
  email: string;
  name: string;
}

export interface AuthMeResponse {
  authenticated: boolean;
  authConfigured: boolean;
  user?: UserInfo;
  boundShares?: number;
  error?: string;
}

export interface PresetsListResponse {
  myPresets: FilterPresetWithSharing[];
  sharedPresets: FilterPresetWithSharing[];
  total: number;
}

export interface OutgoingShare extends FilterPresetWithSharing {
  sharedWith: ShareInfo[];
}

export interface IncomingShare extends FilterPresetWithSharing {
  sharedBy: PresetOwner;
}

export interface MigrationResult {
  success: boolean;
  migrated: number;
  skipped: number;
  errors: string[];
}

// User management types
export type UserRole = 'admin' | 'sharing_manager' | 'viewer';

export interface SharingUser {
  userId: string;
  tenantId: string;
  objectId: string;
  email: string;
  name: string | null;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUserInfo {
  tid: string;
  oid: string;
  email: string;
  role: UserRole;
  canManageUsers: boolean;
}

export interface UsersListResponse {
  users: SharingUser[];
  currentUser: CurrentUserInfo;
}
