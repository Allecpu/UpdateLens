/**
 * Audit trail UI component
 * Displays history of changes with filters and search
 */

import { useState } from 'react';
import { useAuditLog } from '../hooks/useAuditLog';
import type { AuditAction } from '../services/auditService';

const ACTION_ICONS: Record<AuditAction, string> = {
  create: '✨',
  update: '✏️',
  delete: '🗑️',
  view: '👁️',
  export: '📥',
  filter: '🔍',
  group: '📊'
};

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Creato',
  update: 'Modificato',
  delete: 'Eliminato',
  view: 'Visualizzato',
  export: 'Esportato',
  filter: 'Filtrato',
  group: 'Raggruppato'
};

interface AuditTrailProps {
  compact?: boolean;
  maxEntries?: number;
}

export function AuditTrail({ compact = false, maxEntries = 50 }: AuditTrailProps) {
  const { entries } = useAuditLog();
  const [selectedAction, setSelectedAction] = useState<AuditAction | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  // Apply local filters
  const filtered = entries
    .filter((e) => !selectedAction || e.action === selectedAction)
    .filter((e) => !selectedUser || e.userId === selectedUser)
    .filter((e) =>
      !searchText ||
      (e.resourceName?.toLowerCase().includes(searchText.toLowerCase()) ?? false) ||
      (e.resourceId?.toLowerCase().includes(searchText.toLowerCase()) ?? false)
    )
    .slice(0, maxEntries);

  const uniqueUsers = Array.from(new Set(entries.map((e) => e.userId)));
  const uniqueActions = Array.from(new Set(entries.map((e) => e.action)));

  if (compact) {
    return (
      <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
        <h4 className="mb-2 text-sm font-medium">Attività Recente</h4>
        <div className="space-y-1">
          {filtered.slice(0, 5).map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span>{ACTION_ICONS[entry.action]}</span>
              <span className="flex-1 truncate">
                {ACTION_LABELS[entry.action]} {entry.resourceName}
              </span>
              <time className="text-xs text-muted-foreground">
                {new Date(entry.timestamp).toLocaleTimeString('it-IT', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </time>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-4 space-y-3">
        <h3 className="text-lg font-bold">📋 Audit Trail</h3>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Cerca per nome risorsa o ID..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="ul-input h-8 flex-1 px-2 text-xs"
          />

          <select
            value={selectedAction || ''}
            onChange={(e) => setSelectedAction((e.target.value as AuditAction) || null)}
            className="ul-input h-8 px-2 text-xs"
          >
            <option value="">Tutte le azioni</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>
                {ACTION_ICONS[action as AuditAction]} {ACTION_LABELS[action as AuditAction]}
              </option>
            ))}
          </select>

          <select
            value={selectedUser || ''}
            onChange={(e) => setSelectedUser(e.target.value || null)}
            className="ul-input h-8 px-2 text-xs"
          >
            <option value="">Tutti gli utenti</option>
            {uniqueUsers.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>

          {(selectedAction || selectedUser || searchText) && (
            <button
              type="button"
              className="ul-button ul-button-ghost h-8 px-3 text-xs"
              onClick={() => {
                setSelectedAction(null);
                setSelectedUser(null);
                setSearchText('');
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Entries Table */}
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="border-b px-3 py-2 text-left font-medium text-xs">Azione</th>
              <th className="border-b px-3 py-2 text-left font-medium text-xs">Risorsa</th>
              <th className="border-b px-3 py-2 text-left font-medium text-xs">Utente</th>
              <th className="border-b px-3 py-2 text-left font-medium text-xs">Timestamp</th>
              <th className="border-b px-3 py-2 text-left font-medium text-xs">Dettagli</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.length > 0 ? (
              filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-100">
                      {ACTION_ICONS[entry.action]} {ACTION_LABELS[entry.action]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div>
                      <div className="font-medium">{entry.resourceName || entry.resourceId}</div>
                      <div className="text-xs text-muted-foreground">{entry.resourceType}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm">{entry.userName || entry.userId}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString('it-IT')}
                  </td>
                  <td className="px-3 py-2">
                    {entry.changes && entry.changes.length > 0 && (
                      <details className="cursor-pointer">
                        <summary className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          {entry.changes.length} cambiamenti
                        </summary>
                        <div className="mt-2 space-y-1 bg-muted/20 p-2 text-xs">
                          {entry.changes.map((change, idx) => (
                            <div key={idx} className="space-y-0.5">
                              <strong>{change.field}:</strong>
                              <div className="ml-2 text-muted-foreground">
                                <span className="line-through">{String(change.oldValue)}</span>
                                {' → '}
                                <span className="font-medium">{String(change.newValue)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                  Nessuna entry trovata
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Mostra {filtered.length} di {entries.length} entries
      </div>
    </div>
  );
}
