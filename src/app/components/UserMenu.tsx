import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';

/**
 * UserMenu component - displays authenticated user info in the header.
 * Shows avatar with initials, display name, and a dropdown with full user details.
 */
const UserMenu = () => {
  const { isAuthenticated, isAuthConfigured, isLoading, currentUser, fetchCurrentUser } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch user on mount
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // Generate initials from name or email
  const getInitials = (name: string, email: string): string => {
    if (name && name !== 'Unknown') {
      const parts = name.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0]?.substring(0, 2).toUpperCase() || '?';
    }
    // Fallback to email
    const emailName = email.split('@')[0];
    return emailName?.substring(0, 2).toUpperCase() || '?';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
        <span className="hidden text-sm sm:inline">Caricamento...</span>
      </div>
    );
  }

  // Auth not configured (local development)
  if (!isAuthConfigured) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground" title="Autenticazione non configurata (ambiente locale)">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
          </svg>
        </div>
        <span className="hidden text-sm sm:inline">Locale</span>
      </div>
    );
  }

  // Not authenticated (should not happen in production with Easy Auth)
  if (!isAuthenticated || !currentUser) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground" title="Utente non autenticato">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive text-xs font-medium">
          !
        </div>
        <span className="hidden text-sm sm:inline">Non autenticato</span>
      </div>
    );
  }

  const initials = getInitials(currentUser.name, currentUser.email);

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Menu utente"
      >
        {/* Avatar with initials */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
          {initials}
        </div>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-card shadow-lg">
          {/* User header */}
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {currentUser.name !== 'Unknown' ? currentUser.name : 'Utente'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {currentUser.email}
                </p>
              </div>
            </div>
          </div>

          {/* User details */}
          <div className="px-4 py-3 space-y-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
              <p className="text-sm text-foreground truncate" title={currentUser.email}>
                {currentUser.email}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tenant ID</p>
              <p className="text-sm text-foreground font-mono text-xs truncate" title={currentUser.tenantId}>
                {currentUser.tenantId}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Object ID</p>
              <p className="text-sm text-foreground font-mono text-xs truncate" title={currentUser.objectId}>
                {currentUser.objectId}
              </p>
            </div>
          </div>

          {/* Logout action (Easy Auth logout) */}
          <div className="border-t border-border px-4 py-3">
            <a
              href="/.auth/logout"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Esci
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
