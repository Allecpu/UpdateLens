import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for persisting section expand/collapse states to localStorage.
 * Provides independent storage for different contexts (Dashboard vs GlobalFilters).
 */
export function usePersistedSectionStates<T extends Record<string, boolean>>(
  storageKey: string,
  defaultStates: T
): [T, (next: T | ((prev: T) => T)) => void] {
  // Initialize state from localStorage or use defaults
  const [states, setStatesInternal] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<T>;
        // Merge with defaults to handle new sections that weren't previously saved
        return { ...defaultStates, ...parsed };
      }
    } catch {
      // If parsing fails, use defaults
    }
    return defaultStates;
  });

  // Persist to localStorage whenever states change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(states));
    } catch {
      // Silently fail if localStorage is not available
    }
  }, [storageKey, states]);

  // Wrapper for setState that handles both direct values and updater functions
  const setStates = useCallback((next: T | ((prev: T) => T)) => {
    setStatesInternal((prev) => {
      const nextValue = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
      return nextValue;
    });
  }, []);

  return [states, setStates];
}

// Storage keys for different contexts
export const STORAGE_KEYS = {
  DASHBOARD_BASE: 'ul-dashboard-base-sections',
  DASHBOARD_ADVANCED: 'ul-dashboard-advanced-sections',
  GLOBAL_FILTERS_BASE: 'ul-global-filters-base-sections',
  GLOBAL_FILTERS_ADVANCED: 'ul-global-filters-advanced-sections',
  GLOBAL_FILTERS_MAIN: 'ul-global-filters-main-sections'
} as const;
