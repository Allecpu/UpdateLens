import type { Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';

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

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: UserIdentity;
    }
  }
}
