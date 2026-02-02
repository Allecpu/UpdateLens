import type { Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';
import { isUserWhitelisted, bindUserIdentity } from './users.js';

// Azure Easy Auth identity structure
export interface UserIdentity {
  tid: string;      // Tenant ID
  oid: string;      // Object ID (user)
  email: string;
  name: string;
}

// Claim structure from Azure AD
interface AzureClaim {
  typ: string;
  val: string;
}

interface AzureClientPrincipal {
  auth_typ: string;
  claims: AzureClaim[];
  name_typ: string;
  role_typ: string;
}

// Allowed email domain for sharing
const ALLOWED_DOMAIN = '@eos-solutions.it';

// User roles for RBAC
export type UserRole = 'admin' | 'sharing_manager' | 'viewer';

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  sharing_manager: 2,
  viewer: 1
};

/**
 * Check if a role has at least the given minimum role level.
 */
export const hasMinimumRole = (userRole: UserRole, minimumRole: UserRole): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
};

/**
 * Check if user can manage other users (admin or sharing_manager).
 */
export const canManageUsers = (role: UserRole): boolean => {
  return hasMinimumRole(role, 'sharing_manager');
};

/**
 * Check if user can assign admin role (only admins can).
 */
export const canAssignAdminRole = (role: UserRole): boolean => {
  return role === 'admin';
};

/**
 * Extract user identity from Azure Easy Auth headers.
 * Returns null if not authenticated or headers are missing.
 */
export const getIdentity = (req: Request): UserIdentity | null => {
  const principalHeader = req.headers['x-ms-client-principal'];

  if (!principalHeader || typeof principalHeader !== 'string') {
    return null;
  }

  try {
    const decoded = Buffer.from(principalHeader, 'base64').toString('utf-8');
    const principal = JSON.parse(decoded) as AzureClientPrincipal;

    const getClaim = (type: string): string | undefined => {
      const claim = principal.claims.find(c =>
        c.typ === type ||
        c.typ.endsWith(`/${type}`)
      );
      return claim?.val;
    };

    const tid = getClaim('tid') || getClaim('tenantid');
    const oid = getClaim('oid') || getClaim('objectidentifier');
    const email = getClaim('preferred_username') ||
                  getClaim('email') ||
                  getClaim('upn') ||
                  getClaim('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress');
    const name = getClaim('name') ||
                 getClaim('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name') ||
                 email?.split('@')[0] ||
                 'Unknown';

    if (!tid || !oid || !email) {
      console.warn('[Auth] Missing required claims: tid, oid, or email');
      return null;
    }

    return { tid, oid, email, name };
  } catch (error) {
    console.error('[Auth] Failed to parse X-MS-CLIENT-PRINCIPAL:', error);
    return null;
  }
};

/**
 * Check if an email address belongs to the allowed domain.
 */
export const isAllowedDomain = (email: string): boolean => {
  return email.toLowerCase().endsWith(ALLOWED_DOMAIN.toLowerCase());
};

/**
 * Middleware that requires authentication.
 * Returns 401 if user is not authenticated.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const identity = getIdentity(req);

  if (!identity) {
    res.status(401).json({ error: 'Autenticazione richiesta' });
    return;
  }

  // Attach identity to request for downstream use
  (req as Request & { user: UserIdentity }).user = identity;
  next();
};

/**
 * Optional auth middleware - attaches user if available but doesn't require it.
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const identity = getIdentity(req);
  if (identity) {
    (req as Request & { user?: UserIdentity }).user = identity;
  }
  next();
};

/**
 * Bind pending shares to a user when they first log in.
 * Updates shares that were created by email to include the user's tenant/object IDs.
 */
export const bindPendingShares = (db: Database.Database, identity: UserIdentity): number => {
  const normalizedEmail = identity.email.toLowerCase();

  const result = db.prepare(`
    UPDATE filter_preset_shares
    SET grantee_tenant_id = @tid,
        grantee_object_id = @oid
    WHERE LOWER(grantee_email) = @email
      AND (grantee_tenant_id IS NULL OR grantee_object_id IS NULL)
  `).run({
    tid: identity.tid,
    oid: identity.oid,
    email: normalizedEmail
  });

  if (result.changes > 0) {
    console.log(`[Auth] Bound ${result.changes} pending share(s) for user ${identity.email}`);
  }

  return result.changes;
};

/**
 * Middleware that requires the user to be whitelisted.
 * Returns 403 if user is not in the whitelist or is disabled.
 */
export const requireWhitelistedUser = (db: Database.Database) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identity = getIdentity(req);

    if (!identity) {
      res.status(401).json({ error: 'Autenticazione richiesta' });
      return;
    }

    // Try to bind identity if user exists by email only
    bindUserIdentity(db, identity);

    // Check whitelist
    const result = isUserWhitelisted(db, identity);

    if (!result.found) {
      res.status(403).json({
        error: 'Accesso non autorizzato',
        code: 'NOT_WHITELISTED',
        email: identity.email
      });
      return;
    }

    if (!result.enabled) {
      res.status(403).json({
        error: 'Account disabilitato',
        code: 'DISABLED',
        email: identity.email
      });
      return;
    }

    // Attach identity to request for downstream use
    (req as Request & { user: UserIdentity }).user = identity;
    next();
  };
};

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: UserIdentity;
    }
  }
}
