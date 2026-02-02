import { useState } from 'react';
import type { SharingUser, UserRole, CurrentUserInfo } from '../../../models/Filters';

interface UsersTableProps {
  users: SharingUser[];
  currentUser: CurrentUserInfo;
  onUpdateUser: (userId: string, data: { role?: UserRole; enabled?: boolean }) => Promise<void>;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  sharing_manager: 'Manager',
  viewer: 'Viewer'
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Accesso completo',
  sharing_manager: 'Gestione utenti',
  viewer: 'Solo visualizzazione'
};

const UsersTable = ({ users, currentUser, onUpdateUser }: UsersTableProps) => {
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const handleRoleChange = async (user: SharingUser, newRole: UserRole) => {
    if (newRole === user.role) return;

    setUpdatingUserId(user.userId);
    try {
      await onUpdateUser(user.userId, { role: newRole });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleToggleEnabled = async (user: SharingUser) => {
    setUpdatingUserId(user.userId);
    try {
      await onUpdateUser(user.userId, { enabled: !user.enabled });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const isCurrentUser = (user: SharingUser) =>
    user.tenantId === currentUser.tid && user.objectId === currentUser.oid;

  const canModifyUser = (user: SharingUser): boolean => {
    // Cannot modify yourself
    if (isCurrentUser(user)) return false;

    // Non-admins cannot modify admins
    if (user.role === 'admin' && currentUser.role !== 'admin') return false;

    return true;
  };

  const canAssignRole = (targetRole: UserRole): boolean => {
    // Only admins can assign admin role
    if (targetRole === 'admin' && currentUser.role !== 'admin') return false;
    return true;
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <svg className="mx-auto h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <p>Nessun utente configurato.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Utente</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Ruolo</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Stato</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Azioni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => {
            const isSelf = isCurrentUser(user);
            const canModify = canModifyUser(user);
            const isUpdating = updatingUserId === user.userId;

            return (
              <tr key={user.userId} className={`${!user.enabled ? 'opacity-50' : ''}`}>
                {/* User info */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {(user.name || user.email)[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {user.name || user.email.split('@')[0]}
                        {isSelf && (
                          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                            Tu
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </td>

                {/* Role */}
                <td className="py-3 px-4">
                  {canModify && !isUpdating ? (
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                      className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {(['viewer', 'sharing_manager', 'admin'] as UserRole[]).map((r) => (
                        <option key={r} value={r} disabled={!canAssignRole(r)}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : user.role === 'sharing_manager'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {ROLE_DESCRIPTIONS[user.role]}
                      </div>
                    </div>
                  )}
                </td>

                {/* Status */}
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                    user.enabled
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {user.enabled ? 'Attivo' : 'Disabilitato'}
                  </span>
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-right">
                  {isUpdating ? (
                    <span className="inline-flex items-center text-sm text-muted-foreground">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                      Aggiornamento...
                    </span>
                  ) : canModify ? (
                    <button
                      onClick={() => handleToggleEnabled(user)}
                      className={`text-sm px-3 py-1 rounded transition-colors ${
                        user.enabled
                          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                      }`}
                    >
                      {user.enabled ? 'Disabilita' : 'Abilita'}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {isSelf ? 'Non modificabile' : 'Solo admin'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default UsersTable;
