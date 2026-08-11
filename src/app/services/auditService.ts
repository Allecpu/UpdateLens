/**
 * Audit trail service
 * Tracks all changes to activities with who, when, what details
 */

import { v4 as uuidv4 } from 'uuid';

export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'export' | 'filter' | 'group';

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName?: string;
  action: AuditAction;
  resourceType: string; // 'activity', 'view', 'column', etc
  resourceId: string;
  resourceName?: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  details?: Record<string, any>;
  ipAddress?: string;
}

export interface AuditFilter {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: AuditAction;
  resourceType?: string;
  resourceId?: string;
}

class AuditService {
  private entries: AuditEntry[] = [];
  private maxEntries = 10000; // Limite entries in memoria

  /**
   * Log an audit entry
   */
  logEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): string {
    const id = uuidv4();
    const auditEntry: AuditEntry = {
      ...entry,
      id,
      timestamp: new Date().toISOString()
    };

    this.entries.push(auditEntry);

    // Mantieni solo ultimi N entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Persisti a localStorage
    this.persistToStorage();

    return id;
  }

  /**
   * Log activity creation
   */
  logActivityCreate(activityId: string, activityName: string, userId: string, data: Record<string, any>) {
    return this.logEntry({
      userId,
      action: 'create',
      resourceType: 'activity',
      resourceId: activityId,
      resourceName: activityName,
      details: data
    });
  }

  /**
   * Log activity update
   */
  logActivityUpdate(
    activityId: string,
    activityName: string,
    userId: string,
    changes: Array<{ field: string; oldValue: any; newValue: any }>
  ) {
    return this.logEntry({
      userId,
      action: 'update',
      resourceType: 'activity',
      resourceId: activityId,
      resourceName: activityName,
      changes
    });
  }

  /**
   * Log activity deletion
   */
  logActivityDelete(activityId: string, activityName: string, userId: string) {
    return this.logEntry({
      userId,
      action: 'delete',
      resourceType: 'activity',
      resourceId: activityId,
      resourceName: activityName
    });
  }

  /**
   * Log view/access
   */
  logView(activityId: string, userId: string) {
    return this.logEntry({
      userId,
      action: 'view',
      resourceType: 'activity',
      resourceId: activityId
    });
  }

  /**
   * Log export
   */
  logExport(format: 'csv' | 'excel' | 'pdf', recordCount: number, userId: string, filters?: Record<string, any>) {
    return this.logEntry({
      userId,
      action: 'export',
      resourceType: 'export',
      resourceId: `export-${format}`,
      resourceName: `Export to ${format.toUpperCase()}`,
      details: {
        format,
        recordCount,
        filters
      }
    });
  }

  /**
   * Query audit entries
   */
  query(filter: AuditFilter): AuditEntry[] {
    return this.entries.filter((entry) => {
      if (filter.startDate && new Date(entry.timestamp) < filter.startDate) {
        return false;
      }
      if (filter.endDate && new Date(entry.timestamp) > filter.endDate) {
        return false;
      }
      if (filter.userId && entry.userId !== filter.userId) {
        return false;
      }
      if (filter.action && entry.action !== filter.action) {
        return false;
      }
      if (filter.resourceType && entry.resourceType !== filter.resourceType) {
        return false;
      }
      if (filter.resourceId && entry.resourceId !== filter.resourceId) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get audit history for a specific resource
   */
  getResourceHistory(resourceId: string, resourceType: string = 'activity'): AuditEntry[] {
    return this.entries
      .filter((e) => e.resourceId === resourceId && e.resourceType === resourceType)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get all entries
   */
  getAll(): AuditEntry[] {
    return [...this.entries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get entries by date range
   */
  getByDateRange(startDate: Date, endDate: Date): AuditEntry[] {
    return this.entries.filter(
      (e) =>
        new Date(e.timestamp) >= startDate &&
        new Date(e.timestamp) <= endDate
    );
  }

  /**
   * Clear old entries
   */
  clearOlderThan(days: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const beforeCount = this.entries.length;
    this.entries = this.entries.filter(
      (e) => new Date(e.timestamp) > cutoffDate
    );

    this.persistToStorage();
    return beforeCount - this.entries.length;
  }

  /**
   * Export audit log to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  /**
   * Load from storage
   */
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('css-audit-log');
      if (stored) {
        this.entries = JSON.parse(stored);
      }
    } catch (err) {
      console.error('Failed to load audit log from storage:', err);
    }
  }

  /**
   * Persist to storage
   */
  private persistToStorage() {
    try {
      localStorage.setItem('css-audit-log', JSON.stringify(this.entries));
    } catch (err) {
      console.error('Failed to persist audit log to storage:', err);
    }
  }

  /**
   * Initialize - load from storage
   */
  init() {
    this.loadFromStorage();
  }
}

// Singleton instance
export const auditService = new AuditService();

// Auto-init on import
auditService.init();
