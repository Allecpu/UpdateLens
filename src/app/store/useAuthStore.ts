import { create } from 'zustand';
import type { UserInfo } from '../../models/Filters';

export type AccessDeniedReason = 'NOT_WHITELISTED' | 'DISABLED' | null;

type AuthState = {
  // State
  isAuthenticated: boolean;
  isAuthConfigured: boolean;
  isLoading: boolean;
  currentUser: UserInfo | null;
  error: string | null;
  hasFetched: boolean;
  accessDenied: boolean;
  accessDeniedReason: AccessDeniedReason;
  userEmail: string | null;

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
  accessDenied: false,
  accessDeniedReason: null,
  userEmail: null,

  fetchCurrentUser: async () => {
    // Don't fetch if already loading or fetched
    if (get().isLoading || get().hasFetched) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      // Handle 403 - access denied (not whitelisted or disabled)
      if (response.status === 403 && data.accessDenied) {
        set({
          isAuthenticated: data.authenticated ?? false,
          isAuthConfigured: data.authConfigured ?? true,
          currentUser: null,
          isLoading: false,
          hasFetched: true,
          accessDenied: true,
          accessDeniedReason: data.accessDeniedReason || 'NOT_WHITELISTED',
          userEmail: data.user?.email || null
        });
        return;
      }

      // Handle other errors
      if (!response.ok) {
        const isNotConfigured = response.status === 503;
        set({
          isAuthenticated: false,
          isAuthConfigured: !isNotConfigured,
          currentUser: null,
          isLoading: false,
          hasFetched: true,
          accessDenied: false,
          accessDeniedReason: null,
          userEmail: null,
          error: isNotConfigured ? null : (data.error || 'Errore durante il recupero utente')
        });
        return;
      }

      // Success - user is authenticated and whitelisted
      set({
        isAuthenticated: data.authenticated,
        isAuthConfigured: data.authConfigured,
        currentUser: data.user || null,
        isLoading: false,
        hasFetched: true,
        accessDenied: false,
        accessDeniedReason: null,
        userEmail: data.user?.email || null
      });

      // Log bound shares if any
      if (data.boundShares && data.boundShares > 0) {
        console.log(`[Auth] Bound ${data.boundShares} pending share(s) to user`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch user';

      set({
        isAuthenticated: false,
        isAuthConfigured: false,
        currentUser: null,
        isLoading: false,
        hasFetched: true,
        accessDenied: false,
        accessDeniedReason: null,
        userEmail: null,
        error: message
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
      hasFetched: false,
      accessDenied: false,
      accessDeniedReason: null,
      userEmail: null
    });
  }
}));
