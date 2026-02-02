import type {
  FilterState,
  FilterPreset,
  FilterPresetWithSharing,
  VisibilityScope,
  SharingInfo,
  AuthMeResponse,
  PresetsListResponse,
  OutgoingShare,
  IncomingShare,
  MigrationResult,
  UserInfo,
  SharingUser,
  UserRole,
  UsersListResponse
} from '../models/Filters';

interface CreatePresetRequest {
  name: string;
  description?: string;
  filters: FilterState;
  isDefault?: boolean;
  visibilityScope?: VisibilityScope;
}

interface UpdatePresetRequest {
  name?: string;
  description?: string;
  filters?: FilterState;
  isDefault?: boolean;
}

interface UpdateSharingRequest {
  visibilityScope: VisibilityScope;
  granteeEmails?: string[];
}

/**
 * Service for preset API operations.
 * Handles communication with the backend preset endpoints.
 */
export class PresetService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ============================================
  // Auth
  // ============================================

  /**
   * Get current user info from Azure Easy Auth
   */
  async getCurrentUser(): Promise<AuthMeResponse> {
    return this.fetch<AuthMeResponse>('/api/auth/me');
  }

  /**
   * Check if authentication is available
   */
  async checkAuthStatus(): Promise<{ authenticated: boolean; authConfigured: boolean; user?: UserInfo }> {
    try {
      const response = await this.getCurrentUser();
      return {
        authenticated: response.authenticated,
        authConfigured: response.authConfigured,
        user: response.user
      };
    } catch (error) {
      // 503 means auth not configured, 401 means not authenticated
      return {
        authenticated: false,
        authConfigured: false
      };
    }
  }

  // ============================================
  // Preset CRUD
  // ============================================

  /**
   * Get all presets accessible by the current user
   */
  async getPresets(includeShared: boolean = false): Promise<PresetsListResponse> {
    return this.fetch<PresetsListResponse>(`/api/presets?includeShared=${includeShared}`);
  }

  /**
   * Get a single preset by ID
   */
  async getPreset(id: string): Promise<FilterPresetWithSharing> {
    return this.fetch<FilterPresetWithSharing>(`/api/presets/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new preset
   */
  async createPreset(data: CreatePresetRequest): Promise<FilterPresetWithSharing> {
    return this.fetch<FilterPresetWithSharing>('/api/presets', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Update an existing preset
   */
  async updatePreset(id: string, data: UpdatePresetRequest): Promise<FilterPresetWithSharing> {
    return this.fetch<FilterPresetWithSharing>(`/api/presets/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete a preset
   */
  async deletePreset(id: string): Promise<void> {
    await this.fetch<void>(`/api/presets/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  /**
   * Duplicate a preset
   */
  async duplicatePreset(id: string, newName: string): Promise<FilterPresetWithSharing> {
    return this.fetch<FilterPresetWithSharing>(`/api/presets/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ newName })
    });
  }

  // ============================================
  // Sharing
  // ============================================

  /**
   * Get sharing info for a preset
   */
  async getSharing(id: string): Promise<SharingInfo> {
    return this.fetch<SharingInfo>(`/api/presets/${encodeURIComponent(id)}/sharing`);
  }

  /**
   * Update sharing settings for a preset
   */
  async updateSharing(id: string, data: UpdateSharingRequest): Promise<SharingInfo> {
    return this.fetch<SharingInfo>(`/api/presets/${encodeURIComponent(id)}/sharing`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Get presets I've shared with others
   */
  async getOutgoingShares(): Promise<{ shares: OutgoingShare[] }> {
    return this.fetch<{ shares: OutgoingShare[] }>('/api/shares/outgoing');
  }

  /**
   * Get presets shared with me
   */
  async getIncomingShares(): Promise<{ shares: IncomingShare[] }> {
    return this.fetch<{ shares: IncomingShare[] }>('/api/shares/incoming');
  }

  // ============================================
  // Migration
  // ============================================

  /**
   * Migrate presets from localStorage to backend
   */
  async migrateFromLocalStorage(presets: FilterPreset[]): Promise<MigrationResult> {
    return this.fetch<MigrationResult>('/api/presets/migrate', {
      method: 'POST',
      body: JSON.stringify({ presets })
    });
  }

  // ============================================
  // User Management
  // ============================================

  /**
   * Get all users and current user info
   */
  async getUsers(): Promise<UsersListResponse> {
    return this.fetch<UsersListResponse>('/api/shares/users');
  }

  /**
   * Add a new user
   */
  async addUser(data: { email: string; name?: string; role: UserRole }): Promise<SharingUser> {
    return this.fetch<SharingUser>('/api/shares/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Update a user (role, enabled status)
   */
  async updateUser(userId: string, data: { role?: UserRole; enabled?: boolean }): Promise<SharingUser> {
    return this.fetch<SharingUser>(`/api/shares/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
}

// Export a singleton instance
export const presetService = new PresetService();
