/**
 * Generate a unique preset ID
 */
const generatePresetId = () => {
    return crypto.randomUUID();
};
/**
 * Generate a unique share ID
 */
const generateShareId = () => {
    return crypto.randomUUID();
};
/**
 * Transform database row to API response
 */
const rowToResponse = (row, user) => {
    return {
        id: row.preset_id,
        name: row.name,
        description: row.description,
        filters: JSON.parse(row.filters_json),
        isDefault: row.is_default === 1,
        visibilityScope: row.visibility_scope,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        owner: {
            email: row.owner_email,
            name: row.owner_name
        },
        isOwner: row.owner_tenant_id === user.tid && row.owner_object_id === user.oid
    };
};
/**
 * Check if a user can access a preset (read)
 */
export const canAccessPreset = (db, user, preset) => {
    // Owner always has access
    if (preset.owner_tenant_id === user.tid && preset.owner_object_id === user.oid) {
        return true;
    }
    // Private presets are only for owners
    if (preset.visibility_scope === 'private') {
        return false;
    }
    // Shared with all users (same domain implied by Easy Auth)
    if (preset.visibility_scope === 'all_users') {
        return true;
    }
    // Check specific shares
    if (preset.visibility_scope === 'specific_users') {
        const share = db.prepare(`
      SELECT 1 FROM filter_preset_shares
      WHERE preset_id = @presetId
        AND (
          (grantee_tenant_id = @tid AND grantee_object_id = @oid)
          OR LOWER(grantee_email) = LOWER(@email)
        )
      LIMIT 1
    `).get({
            presetId: preset.preset_id,
            tid: user.tid,
            oid: user.oid,
            email: user.email
        });
        return !!share;
    }
    return false;
};
/**
 * Check if a user can modify a preset (update/delete)
 */
export const canModifyPreset = (user, preset) => {
    return preset.owner_tenant_id === user.tid && preset.owner_object_id === user.oid;
};
/**
 * Get all presets accessible by a user
 */
export const getPresetsForUser = (db, user, includeShared = false) => {
    // Get user's own presets
    const ownPresets = db.prepare(`
    SELECT * FROM filter_presets
    WHERE owner_tenant_id = @tid AND owner_object_id = @oid
    ORDER BY is_default DESC, name ASC
  `).all({ tid: user.tid, oid: user.oid });
    if (!includeShared) {
        return ownPresets.map(row => rowToResponse(row, user));
    }
    // Also get shared presets
    const sharedPresets = db.prepare(`
    SELECT DISTINCT p.* FROM filter_presets p
    LEFT JOIN filter_preset_shares s ON p.preset_id = s.preset_id
    WHERE (p.owner_tenant_id != @tid OR p.owner_object_id != @oid)
      AND (
        p.visibility_scope = 'all_users'
        OR (
          p.visibility_scope = 'specific_users'
          AND (
            (s.grantee_tenant_id = @tid AND s.grantee_object_id = @oid)
            OR LOWER(s.grantee_email) = LOWER(@email)
          )
        )
      )
    ORDER BY p.name ASC
  `).all({ tid: user.tid, oid: user.oid, email: user.email });
    const allPresets = [...ownPresets, ...sharedPresets];
    return allPresets.map(row => rowToResponse(row, user));
};
/**
 * Get a single preset by ID
 */
export const getPresetById = (db, presetId) => {
    return db.prepare(`
    SELECT * FROM filter_presets WHERE preset_id = @presetId
  `).get({ presetId });
};
/**
 * Create a new preset
 */
export const createPreset = (db, user, input) => {
    const now = new Date().toISOString();
    const presetId = generatePresetId();
    // If setting as default, unset other defaults for this user
    if (input.isDefault) {
        db.prepare(`
      UPDATE filter_presets
      SET is_default = 0, updated_at = @now
      WHERE owner_tenant_id = @tid AND owner_object_id = @oid AND is_default = 1
    `).run({ tid: user.tid, oid: user.oid, now });
    }
    db.prepare(`
    INSERT INTO filter_presets (
      preset_id, owner_tenant_id, owner_object_id, owner_email, owner_name,
      name, description, filters_json, is_default, visibility_scope,
      schema_version, created_at, updated_at
    ) VALUES (
      @presetId, @tid, @oid, @email, @name,
      @presetName, @description, @filtersJson, @isDefault, @visibilityScope,
      1, @now, @now
    )
  `).run({
        presetId,
        tid: user.tid,
        oid: user.oid,
        email: user.email,
        name: user.name,
        presetName: input.name,
        description: input.description || null,
        filtersJson: JSON.stringify(input.filters),
        isDefault: input.isDefault ? 1 : 0,
        visibilityScope: input.visibilityScope || 'private',
        now
    });
    const row = getPresetById(db, presetId);
    return rowToResponse(row, user);
};
/**
 * Update an existing preset
 */
export const updatePreset = (db, user, presetId, input) => {
    const now = new Date().toISOString();
    const updates = ['updated_at = @now'];
    const params = { presetId, now };
    if (input.name !== undefined) {
        updates.push('name = @name');
        params.name = input.name;
    }
    if (input.description !== undefined) {
        updates.push('description = @description');
        params.description = input.description || null;
    }
    if (input.filters !== undefined) {
        updates.push('filters_json = @filtersJson');
        params.filtersJson = JSON.stringify(input.filters);
    }
    if (input.isDefault !== undefined) {
        // If setting as default, unset other defaults first
        if (input.isDefault) {
            db.prepare(`
        UPDATE filter_presets
        SET is_default = 0, updated_at = @now
        WHERE owner_tenant_id = @tid AND owner_object_id = @oid AND is_default = 1 AND preset_id != @presetId
      `).run({ tid: user.tid, oid: user.oid, now, presetId });
        }
        updates.push('is_default = @isDefault');
        params.isDefault = input.isDefault ? 1 : 0;
    }
    db.prepare(`
    UPDATE filter_presets
    SET ${updates.join(', ')}
    WHERE preset_id = @presetId
  `).run(params);
    const row = getPresetById(db, presetId);
    return rowToResponse(row, user);
};
/**
 * Delete a preset
 */
export const deletePreset = (db, presetId) => {
    // Shares are deleted automatically via ON DELETE CASCADE
    db.prepare(`DELETE FROM filter_presets WHERE preset_id = @presetId`).run({ presetId });
};
/**
 * Duplicate a preset (creates a private copy for the user)
 */
export const duplicatePreset = (db, user, presetId, newName) => {
    const original = getPresetById(db, presetId);
    if (!original) {
        throw new Error('Preset not found');
    }
    return createPreset(db, user, {
        name: newName,
        description: original.description || undefined,
        filters: JSON.parse(original.filters_json),
        isDefault: false,
        visibilityScope: 'private'
    });
};
/**
 * Get sharing info for a preset
 */
export const getSharingInfo = (db, presetId) => {
    const preset = getPresetById(db, presetId);
    if (!preset) {
        throw new Error('Preset not found');
    }
    const shares = db.prepare(`
    SELECT grantee_email, permission, created_at
    FROM filter_preset_shares
    WHERE preset_id = @presetId
    ORDER BY created_at ASC
  `).all({ presetId });
    return {
        visibilityScope: preset.visibility_scope,
        shares: shares.map(s => ({
            email: s.grantee_email,
            name: null, // We don't store names for grantees
            permission: s.permission,
            createdAt: s.created_at
        }))
    };
};
/**
 * Update sharing settings for a preset
 */
export const updateSharing = (db, user, presetId, input) => {
    const now = new Date().toISOString();
    // Update visibility scope
    db.prepare(`
    UPDATE filter_presets
    SET visibility_scope = @scope, updated_at = @now
    WHERE preset_id = @presetId
  `).run({ presetId, scope: input.visibilityScope, now });
    // Remove all existing shares (will be re-created if specific_users)
    db.prepare(`DELETE FROM filter_preset_shares WHERE preset_id = @presetId`).run({ presetId });
    // Add specific shares if needed
    if (input.visibilityScope === 'specific_users' && input.granteeEmails?.length) {
        const insertShare = db.prepare(`
      INSERT INTO filter_preset_shares (
        share_id, preset_id, grantee_email, permission,
        created_by_tenant_id, created_by_object_id, created_at
      ) VALUES (
        @shareId, @presetId, @email, 'view',
        @creatorTid, @creatorOid, @now
      )
    `);
        const uniqueEmails = [...new Set(input.granteeEmails.map(e => e.toLowerCase()))];
        for (const email of uniqueEmails) {
            insertShare.run({
                shareId: generateShareId(),
                presetId,
                email,
                creatorTid: user.tid,
                creatorOid: user.oid,
                now
            });
        }
    }
};
/**
 * Get outgoing shares (presets I've shared with others)
 */
export const getOutgoingShares = (db, user) => {
    const presets = db.prepare(`
    SELECT * FROM filter_presets
    WHERE owner_tenant_id = @tid AND owner_object_id = @oid
      AND visibility_scope != 'private'
    ORDER BY name ASC
  `).all({ tid: user.tid, oid: user.oid });
    return presets.map(preset => {
        const shares = db.prepare(`
      SELECT grantee_email, permission, created_at
      FROM filter_preset_shares
      WHERE preset_id = @presetId
    `).all({ presetId: preset.preset_id });
        return {
            ...rowToResponse(preset, user),
            sharedWith: shares.map(s => ({
                email: s.grantee_email,
                name: null,
                permission: s.permission,
                createdAt: s.created_at
            }))
        };
    });
};
/**
 * Get incoming shares (presets shared with me)
 */
export const getIncomingShares = (db, user) => {
    const presets = db.prepare(`
    SELECT DISTINCT p.* FROM filter_presets p
    LEFT JOIN filter_preset_shares s ON p.preset_id = s.preset_id
    WHERE (p.owner_tenant_id != @tid OR p.owner_object_id != @oid)
      AND (
        p.visibility_scope = 'all_users'
        OR (
          p.visibility_scope = 'specific_users'
          AND (
            (s.grantee_tenant_id = @tid AND s.grantee_object_id = @oid)
            OR LOWER(s.grantee_email) = LOWER(@email)
          )
        )
      )
    ORDER BY p.name ASC
  `).all({ tid: user.tid, oid: user.oid, email: user.email });
    return presets.map(preset => ({
        ...rowToResponse(preset, user),
        sharedBy: {
            email: preset.owner_email,
            name: preset.owner_name
        }
    }));
};
export const migratePresetsFromLocalStorage = (db, user, presets) => {
    let migrated = 0;
    let skipped = 0;
    const errors = [];
    for (const preset of presets) {
        try {
            // Check if preset with same name already exists for this user
            const existing = db.prepare(`
        SELECT 1 FROM filter_presets
        WHERE owner_tenant_id = @tid AND owner_object_id = @oid AND name = @name
      `).get({ tid: user.tid, oid: user.oid, name: preset.name });
            if (existing) {
                skipped++;
                continue;
            }
            // If this preset is default, unset any existing defaults
            if (preset.isDefault) {
                db.prepare(`
          UPDATE filter_presets
          SET is_default = 0
          WHERE owner_tenant_id = @tid AND owner_object_id = @oid AND is_default = 1
        `).run({ tid: user.tid, oid: user.oid });
            }
            db.prepare(`
        INSERT INTO filter_presets (
          preset_id, owner_tenant_id, owner_object_id, owner_email, owner_name,
          name, description, filters_json, is_default, visibility_scope,
          schema_version, created_at, updated_at
        ) VALUES (
          @presetId, @tid, @oid, @email, @ownerName,
          @name, @description, @filtersJson, @isDefault, 'private',
          1, @createdAt, @updatedAt
        )
      `).run({
                presetId: generatePresetId(),
                tid: user.tid,
                oid: user.oid,
                email: user.email,
                ownerName: user.name,
                name: preset.name,
                description: preset.description || null,
                filtersJson: JSON.stringify(preset.filters),
                isDefault: preset.isDefault ? 1 : 0,
                createdAt: preset.createdAt,
                updatedAt: preset.updatedAt
            });
            migrated++;
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to migrate preset "${preset.name}": ${msg}`);
        }
    }
    return { migrated, skipped, errors };
};
