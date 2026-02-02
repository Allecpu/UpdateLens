import { v4 as uuidv4 } from 'uuid';
import { canManageUsers, canAssignAdminRole, isAllowedDomain } from './auth.js';
/**
 * Convert database row to API response format.
 */
const rowToUser = (row) => ({
    userId: row.user_id,
    tenantId: row.tenant_id,
    objectId: row.object_id,
    email: row.email,
    name: row.name,
    role: row.role,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});
/**
 * Get user by tenant/object ID.
 */
export const getUserByIdentity = (db, identity) => {
    return db.prepare(`
    SELECT * FROM sharing_users
    WHERE tenant_id = ? AND object_id = ?
  `).get(identity.tid, identity.oid);
};
/**
 * Get user by email.
 */
export const getUserByEmail = (db, email) => {
    return db.prepare(`
    SELECT * FROM sharing_users
    WHERE LOWER(email) = LOWER(?)
  `).get(email);
};
/**
 * Get user by user_id.
 */
export const getUserById = (db, userId) => {
    return db.prepare(`
    SELECT * FROM sharing_users
    WHERE user_id = ?
  `).get(userId);
};
/**
 * Check if any admin exists in the system.
 */
export const hasAdminUser = (db) => {
    const result = db.prepare(`
    SELECT COUNT(*) as count FROM sharing_users
    WHERE role = 'admin' AND enabled = 1
  `).get();
    return result.count > 0;
};
/**
 * Auto-bootstrap: Create first admin if no admins exist.
 * Returns the created/found user row.
 */
export const ensureUserExists = (db, identity, bootstrapAsAdmin = false) => {
    const existing = getUserByIdentity(db, identity);
    if (existing) {
        return existing;
    }
    // Check if we should bootstrap as admin (first user when no admins exist)
    const shouldBeAdmin = bootstrapAsAdmin || !hasAdminUser(db);
    const role = shouldBeAdmin ? 'admin' : 'viewer';
    const now = new Date().toISOString();
    const userId = uuidv4();
    db.prepare(`
    INSERT INTO sharing_users (
      user_id, tenant_id, object_id, email, name, role, enabled,
      created_by_tenant_id, created_by_object_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, NULL, NULL, ?, ?)
  `).run(userId, identity.tid, identity.oid, identity.email, identity.name, role, now, now);
    if (shouldBeAdmin) {
        console.log(`[Users] Auto-bootstrapped admin user: ${identity.email}`);
    }
    return getUserByIdentity(db, identity);
};
/**
 * Get all users (for admin/manager view).
 */
export const getAllUsers = (db) => {
    const rows = db.prepare(`
    SELECT * FROM sharing_users
    ORDER BY
      CASE role
        WHEN 'admin' THEN 1
        WHEN 'sharing_manager' THEN 2
        ELSE 3
      END,
      email ASC
  `).all();
    return rows.map(rowToUser);
};
/**
 * Get users list with current user info.
 */
export const getUsersForIdentity = (db, identity) => {
    // Ensure current user exists (auto-bootstrap if needed)
    const currentUserRow = ensureUserExists(db, identity);
    const users = getAllUsers(db);
    return {
        users,
        currentUser: {
            tid: identity.tid,
            oid: identity.oid,
            email: identity.email,
            role: currentUserRow.role,
            canManageUsers: canManageUsers(currentUserRow.role)
        }
    };
};
/**
 * Add a new user.
 */
export const addUser = (db, creator, creatorRole, data) => {
    // Validate creator permissions
    if (!canManageUsers(creatorRole)) {
        throw new Error('Non autorizzato a gestire gli utenti');
    }
    // Validate email domain
    if (!isAllowedDomain(data.email)) {
        throw new Error('Solo email @eos-solutions.it sono consentite');
    }
    // Check if email already exists
    const existing = getUserByEmail(db, data.email);
    if (existing) {
        throw new Error('Utente con questa email già esistente');
    }
    // Only admins can assign admin role
    if (data.role === 'admin' && !canAssignAdminRole(creatorRole)) {
        throw new Error('Solo gli admin possono assegnare il ruolo admin');
    }
    const now = new Date().toISOString();
    const userId = uuidv4();
    db.prepare(`
    INSERT INTO sharing_users (
      user_id, tenant_id, object_id, email, name, role, enabled,
      created_by_tenant_id, created_by_object_id, created_at, updated_at
    ) VALUES (?, '', '', ?, ?, ?, 1, ?, ?, ?, ?)
  `).run(userId, data.email.toLowerCase(), data.name || null, data.role, creator.tid, creator.oid, now, now);
    console.log(`[Users] User added by ${creator.email}: ${data.email} (role: ${data.role})`);
    return rowToUser(getUserById(db, userId));
};
/**
 * Update a user (role, enabled status).
 */
export const updateUser = (db, updater, updaterRole, userId, data) => {
    // Validate updater permissions
    if (!canManageUsers(updaterRole)) {
        throw new Error('Non autorizzato a gestire gli utenti');
    }
    const targetUser = getUserById(db, userId);
    if (!targetUser) {
        throw new Error('Utente non trovato');
    }
    // Prevent self-demotion from admin (lockout prevention)
    if (targetUser.tenant_id === updater.tid && targetUser.object_id === updater.oid) {
        if (data.role && data.role !== 'admin' && targetUser.role === 'admin') {
            throw new Error('Non puoi rimuovere il tuo ruolo admin');
        }
        if (data.enabled === false) {
            throw new Error('Non puoi disabilitare te stesso');
        }
    }
    // Only admins can assign/change admin role
    if (data.role === 'admin' && !canAssignAdminRole(updaterRole)) {
        throw new Error('Solo gli admin possono assegnare il ruolo admin');
    }
    // Non-admins cannot modify admins
    if (targetUser.role === 'admin' && !canAssignAdminRole(updaterRole)) {
        throw new Error('Solo gli admin possono modificare altri admin');
    }
    const updates = [];
    const params = [];
    if (data.role !== undefined) {
        updates.push('role = ?');
        params.push(data.role);
    }
    if (data.enabled !== undefined) {
        updates.push('enabled = ?');
        params.push(data.enabled ? 1 : 0);
    }
    if (updates.length === 0) {
        return rowToUser(targetUser);
    }
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(userId);
    db.prepare(`
    UPDATE sharing_users
    SET ${updates.join(', ')}
    WHERE user_id = ?
  `).run(...params);
    console.log(`[Users] User updated by ${updater.email}: ${targetUser.email} (changes: ${JSON.stringify(data)})`);
    return rowToUser(getUserById(db, userId));
};
/**
 * Check if a user is in the whitelist.
 * Searches by (tenant_id, object_id) first, then by email (case-insensitive).
 */
export const isUserWhitelisted = (db, identity) => {
    // First, try to find by tenant_id and object_id
    let user = getUserByIdentity(db, identity);
    // If not found, try by email
    if (!user) {
        user = getUserByEmail(db, identity.email);
    }
    if (!user) {
        return { found: false, enabled: false };
    }
    return {
        found: true,
        enabled: user.enabled === 1,
        user
    };
};
/**
 * Bind user identity to an existing email-only user record.
 * Called when a user logs in and their email matches a pre-added user.
 */
export const bindUserIdentity = (db, identity) => {
    // Check if user already exists with full identity
    const existing = getUserByIdentity(db, identity);
    if (existing) {
        return existing;
    }
    // Check if there's an email-only record
    const emailUser = getUserByEmail(db, identity.email);
    if (emailUser && !emailUser.tenant_id) {
        // Bind identity to existing record
        db.prepare(`
      UPDATE sharing_users
      SET tenant_id = ?, object_id = ?, name = COALESCE(name, ?), updated_at = ?
      WHERE user_id = ?
    `).run(identity.tid, identity.oid, identity.name, new Date().toISOString(), emailUser.user_id);
        console.log(`[Users] Bound identity for: ${identity.email}`);
        return getUserById(db, emailUser.user_id);
    }
    return null;
};
