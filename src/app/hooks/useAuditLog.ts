/**
 * Hook for managing audit log state and operations
 */

import { useState, useCallback, useEffect } from 'react';
import { auditService, type AuditEntry, type AuditFilter, type AuditAction } from '../services/auditService';

export interface UseAuditLogReturn {
  entries: AuditEntry[];
  filteredEntries: AuditEntry[];
  filter: AuditFilter;
  setFilter: (filter: AuditFilter) => void;
  stats: {
    totalEntries: number;
    byAction: Record<AuditAction, number>;
    byUser: Record<string, number>;
  };
  getResourceHistory: (resourceId: string) => AuditEntry[];
  clearOldEntries: (days: number) => void;
  exportLog: () => string;
}

export function useAuditLog(): UseAuditLogReturn {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilterState] = useState<AuditFilter>({});

  // Load initial entries
  useEffect(() => {
    const allEntries = auditService.getAll();
    setEntries(allEntries);
  }, []);

  // Apply filter
  const filteredEntries = auditService.query(filter);

  // Update filter
  const setFilter = useCallback((newFilter: AuditFilter) => {
    setFilterState(newFilter);
  }, []);

  // Calculate stats
  const stats = {
    totalEntries: entries.length,
    byAction: entries.reduce(
      (acc, entry) => ({
        ...acc,
        [entry.action]: (acc[entry.action as AuditAction] || 0) + 1
      }),
      {} as Record<AuditAction, number>
    ),
    byUser: entries.reduce(
      (acc, entry) => ({
        ...acc,
        [entry.userId]: (acc[entry.userId] || 0) + 1
      }),
      {} as Record<string, number>
    )
  };

  // Get resource history
  const getResourceHistory = useCallback((resourceId: string) => {
    return auditService.getResourceHistory(resourceId);
  }, []);

  // Clear old entries
  const clearOldEntries = useCallback((days: number) => {
    auditService.clearOlderThan(days);
    const allEntries = auditService.getAll();
    setEntries(allEntries);
  }, []);

  // Export log
  const exportLog = useCallback(() => {
    return auditService.exportToJSON();
  }, []);

  return {
    entries,
    filteredEntries,
    filter,
    setFilter,
    stats,
    getResourceHistory,
    clearOldEntries,
    exportLog
  };
}
