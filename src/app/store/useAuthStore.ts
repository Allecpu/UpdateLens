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

    const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
    const localAuthProbeEnabled = env?.VITE_LOCAL_AUTH_PROBE === 'true';
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Easy Auth does not run on localhost by default: avoid noisy 503 calls in dev.
    if (isLocalhost && !localAuthProbeEnabled) {
      set({
        isAuthenticated: false,
        isAuthConfigured: false,
        currentUser: null,
        isLoading: false,
        hasFetched: true,
        accessDenied: false,
        accessDeniedReason: null,
        userEmail: null,
        error: null
      });
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
      });
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json().catch(() => null) : null;
      const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;

      // Handle 403 - access denied (not whitelisted or disabled)
      if (response.status === 403 && payload?.accessDenied) {
        set({
          isAuthenticated: (payload.authenticated as boolean | undefined) ?? false,
          isAuthConfigured: (payload.authConfigured as boolean | undefined) ?? true,
          currentUser: null,
          isLoading: false,
          hasFetched: true,
          accessDenied: true,
          accessDeniedReason: (payload.accessDeniedReason as AccessDeniedReason | undefined) || 'NOT_WHITELISTED',
          userEmail: (payload.user as { email?: string } | undefined)?.email || null
        });
        return;
      }

      // Auth is configured but user is not logged in yet
      if (response.status === 401) {
        set({
          isAuthenticated: false,
          isAuthConfigured: true,
          currentUser: null,
          isLoading: false,
          hasFetched: true,
          accessDenied: false,
          accessDeniedReason: null,
          userEmail: null,
          error: null
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
          error:
            isNotConfigured
              ? null
              : (payload && typeof payload.error === 'string'
                ? payload.error
                : 'Errore durante il recupero utente')
        });
        return;
      }

      // Success - user is authenticated and whitelisted
      set({
        isAuthenticated: Boolean(payload?.authenticated),
        isAuthConfigured: Boolean(payload?.authConfigured),
        currentUser: payload ? (payload.user as UserInfo | null) : null,
        isLoading: false,
        hasFetched: true,
        accessDenied: false,
        accessDeniedReason: null,
        userEmail: payload ? ((payload.user as { email?: string } | undefined)?.email || null) : null
      });

      // Log bound shares if any
      if (payload && typeof payload.boundShares === 'number' && payload.boundShares > 0) {
        console.log(`[Auth] Bound ${payload.boundShares} pending share(s) to user`);
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
