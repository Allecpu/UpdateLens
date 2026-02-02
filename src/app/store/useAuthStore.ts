import { create } from 'zustand';
import type { UserInfo } from '../../models/Filters';
import { presetService } from '../../services/PresetService';

type AuthState = {
  // State
  isAuthenticated: boolean;
  isAuthConfigured: boolean;
  isLoading: boolean;
  currentUser: UserInfo | null;
  error: string | null;
  hasFetched: boolean;

  // Actions
  fetchCurrentUser: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isAuthConfigured: false,
  isLoading: false,
  currentUser: null,
  error: null,
  hasFetched: false,

  fetchCurrentUser: async () => {
    // Don't fetch if already loading or fetched
    if (get().isLoading || get().hasFetched) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await presetService.getCurrentUser();

      set({
        isAuthenticated: response.authenticated,
        isAuthConfigured: response.authConfigured,
        currentUser: response.user || null,
        isLoading: false,
        hasFetched: true
      });

      // Log bound shares if any
      if (response.boundShares && response.boundShares > 0) {
        console.log(`[Auth] Bound ${response.boundShares} pending share(s) to user`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch user';

      // Check if error indicates auth not configured (503) vs not authenticated (401)
      const isNotConfigured = message.includes('503') || message.includes('non configurata');

      set({
        isAuthenticated: false,
        isAuthConfigured: !isNotConfigured,
        currentUser: null,
        isLoading: false,
        hasFetched: true,
        error: isNotConfigured ? null : message // Don't show error if auth just isn't configured
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      isAuthenticated: false,
      isAuthConfigured: false,
      isLoading: false,
      currentUser: null,
      error: null,
      hasFetched: false
    });
  }
}));
