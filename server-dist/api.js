import express from 'express';
import { createDb } from "./db.js";
import { buildRefreshZip } from "./refreshZip.js";
import { buildReleaseZip } from "./releaseZip.js";
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getIdentity, isAllowedDomain, bindPendingShares, canManageUsers, requireWhitelistedUser } from './auth.js';
import * as presets from './presets.js';
import * as users from './users.js';
const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const buildCacheKey = (query) => {
    return Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join('&');
};
const runSingleRefresh = async (source) => {
    const startTime = Date.now();
    try {
        // Run the npm script for this source
        await execAsync(`npm run refresh:${source}`, { cwd: repoRoot });
        const duration = Date.now() - startTime;
        const timestamp = new Date().toISOString();
        // Read latest.json to verify the snapshot was created
        const latestPath = path.resolve(repoRoot, 'public', 'data', 'latest.json');
        const latestRaw = await readFile(latestPath, 'utf-8');
        const latest = JSON.parse(latestRaw);
        const filename = latest[source];
        if (!filename) {
            return {
                source,
                status: 'missing',
                itemCount: null,
                duration,
                timestamp,
                error: 'File snapshot non trovato nel manifest'
            };
        }
        // Read the snapshot to count items
        const snapshotPath = path.resolve(repoRoot, 'public', 'data', filename);
        const snapshotRaw = await readFile(snapshotPath, 'utf-8');
        const snapshot = JSON.parse(snapshotRaw);
        return {
            source,
            status: 'ok',
            itemCount: snapshot.items.length,
            duration,
            timestamp
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
        return {
            source,
            status: 'failed',
            itemCount: null,
            duration,
            timestamp: new Date().toISOString(),
            error: errorMessage
        };
    }
};
export const createApi = () => {
    const db = createDb();
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    // Serve static frontend files
    const distPath = path.resolve(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok' });
    });
    // GitHub Proxy for Web Mode
    app.all('/api/github/*', async (req, res) => {
        const envToken = process.env.GITHUB_ISSUES_TOKEN;
        const owner = process.env.GITHUB_OWNER || 'Allecpu';
        const repo = process.env.GITHUB_REPO || 'UpdateLens';
        const inboundAuth = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
        const normalizeAuth = (value) => {
            if (!value)
                return '';
            return value.startsWith('Bearer ') ? value : `Bearer ${value}`;
        };
        const primaryAuth = inboundAuth ? normalizeAuth(inboundAuth) : normalizeAuth(envToken);
        const fallbackAuth = inboundAuth && envToken ? normalizeAuth(envToken) : '';
        const token = primaryAuth;
        if (!token && req.path !== '/api/github/health') {
            return res.status(503).json({
                error: 'GitHub token non configurato sul server. Usa la modalità locale o configura GITHUB_ISSUES_TOKEN.'
            });
        }
        if (req.path === '/api/github/health') {
            return res.json({ ok: !!envToken, mode: 'web' });
        }
        const githubPath = req.params[0];
        const queryIndex = req.originalUrl.indexOf('?');
        const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
        const url = `https://api.github.com/repos/${owner}/${repo}/${githubPath}${query}`;
        try {
            const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined;
            const makeHeaders = (auth) => {
                const headers = {
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                };
                if (auth) {
                    headers['Authorization'] = auth;
                }
                return headers;
            };
            let response = await fetch(url, {
                method: req.method,
                headers: makeHeaders(token),
                body,
            });
            if ((response.status === 401 || response.status === 403) && fallbackAuth) {
                response = await fetch(url, {
                    method: req.method,
                    headers: makeHeaders(fallbackAuth),
                    body,
                });
            }
            const data = await response.json().catch(() => ({}));
            res.status(response.status).json(data);
        }
        catch (error) {
            res.status(500).json({ error: 'Errore durante il proxy GitHub: ' + (error instanceof Error ? error.message : String(error)) });
        }
    });
    app.get('/api/releaseplans', (req, res) => {
        const { app: appName, product, status, wave, tag, lang = 'en-US', updatedSince, limit, offset, sort = 'newest' } = req.query;
        const effectiveLimit = Math.min(Number(limit || DEFAULT_LIMIT), MAX_LIMIT);
        const effectiveOffset = Number(offset || 0);
        const filters = ['language = @lang'];
        const params = {
            lang,
            limit: effectiveLimit,
            offset: effectiveOffset
        };
        if (appName) {
            filters.push('app_name = @app');
            params.app = appName;
        }
        if (product) {
            filters.push('product_name = @product');
            params.product = product;
        }
        if (status) {
            filters.push('status = @status');
            params.status = status;
        }
        if (wave) {
            filters.push('wave = @wave');
            params.wave = wave;
        }
        if (updatedSince) {
            filters.push('last_updated_date >= @updatedSince');
            params.updatedSince = updatedSince;
        }
        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const orderClause = sort === 'oldest' ? 'ORDER BY availability_date ASC' : 'ORDER BY availability_date DESC';
        const baseQuery = `
      SELECT * FROM release_plan_items
      ${whereClause}
      ${orderClause}
      LIMIT @limit OFFSET @offset
    `;
        const items = db.prepare(baseQuery).all(params);
        const countQuery = `
      SELECT COUNT(*) as total FROM release_plan_items
      ${whereClause}
    `;
        const total = db.prepare(countQuery).get(params);
        const cacheKey = buildCacheKey(req.query);
        const snapshot = db
            .prepare(`SELECT hash FROM release_plan_snapshots WHERE language = ? ORDER BY snapshot_id DESC LIMIT 1`)
            .get(lang);
        const etag = snapshot?.hash ? `${snapshot.hash}:${cacheKey}` : cacheKey;
        if (etag && req.headers['if-none-match'] === etag) {
            res.status(304).end();
            return;
        }
        res.setHeader('ETag', etag);
        res.json({ items, total: total?.total ?? 0 });
    });
    app.get('/api/releaseplans/meta', (req, res) => {
        const lang = req.query.lang ?? 'en-US';
        const selectDistinct = (column) => db
            .prepare(`SELECT DISTINCT ${column} as value FROM release_plan_items WHERE language = ? ORDER BY ${column}`)
            .all(lang);
        res.json({
            apps: selectDistinct('app_name'),
            products: selectDistinct('product_name'),
            statuses: selectDistinct('status'),
            waves: selectDistinct('wave')
        });
    });
    app.get('/api/releaseplans/:planId', (req, res) => {
        const { planId } = req.params;
        const lang = req.query.lang ?? 'en-US';
        const item = db
            .prepare(`SELECT * FROM release_plan_items WHERE source_plan_id = ? AND language = ?`)
            .get(planId, lang);
        if (!item) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.json(item);
    });
    app.get('/api/releaseplans/changes', (req, res) => {
        const since = req.query.since ?? '';
        if (!since) {
            res.status(400).json({ error: 'Missing since parameter' });
            return;
        }
        const rows = db
            .prepare(`SELECT h.*, i.source_plan_id, i.feature_name, i.product_name
         FROM release_plan_history h
         JOIN release_plan_items i ON i.id = h.item_id
         WHERE h.changed_at >= ?
         ORDER BY h.changed_at DESC`)
            .all(since);
        res.json({ items: rows });
    });
    app.post('/api/refresh-zip', async (req, res) => {
        // Refresh is disabled on Azure - data is updated via scheduled GitHub Actions
        if (process.env.DB_PATH === '/home/data') {
            return res.status(501).json({
                error: 'Refresh non disponibile su Azure. I dati vengono aggiornati automaticamente ogni mese via GitHub Actions.'
            });
        }
        try {
            const sourcesRaw = (req.body?.sources ?? []);
            const sources = sourcesRaw
                .map((value) => value.toLowerCase())
                .filter((value) => value === 'microsoft' || value === 'eos');
            const result = await buildRefreshZip(sources);
            const filename = `UpdateLens_refresh_${result.manifest.generatedAt.replace(/[:.]/g, '-')}.zip`;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('X-UpdateLens-Refresh-At', result.manifest.generatedAt);
            res.setHeader('X-UpdateLens-Items-Microsoft', String(result.manifest.items.microsoft));
            res.setHeader('X-UpdateLens-Items-EOS', String(result.manifest.items.eos));
            res.setHeader('X-UpdateLens-Result', 'success');
            res.setHeader('Access-Control-Expose-Headers', 'X-UpdateLens-Refresh-At, X-UpdateLens-Items-Microsoft, X-UpdateLens-Items-EOS, X-UpdateLens-Result, Content-Disposition');
            res.send(result.zipBuffer);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante refresh ZIP.';
            res.status(500).json({ error: message });
        }
    });
    app.post('/api/release-zip', async (_req, res) => {
        try {
            const result = await buildReleaseZip();
            const filename = `UpdateLens_release_${result.generatedAt.replace(/[:.]/g, '-')}.zip`;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('X-UpdateLens-Release-At', result.generatedAt);
            res.setHeader('X-UpdateLens-Result', 'success');
            res.setHeader('Access-Control-Expose-Headers', 'X-UpdateLens-Release-At, X-UpdateLens-Result, Content-Disposition');
            res.send(result.zipBuffer);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante build release ZIP.';
            res.status(500).json({ error: message });
        }
    });
    app.post('/api/sources/update-all', async (_req, res) => {
        // On Azure, call Azure Functions for refresh
        if (process.env.DB_PATH === '/home/data') {
            const functionUrl = process.env.AZURE_FUNCTION_URL;
            const functionKey = process.env.AZURE_FUNCTION_KEY;
            if (!functionUrl || !functionKey) {
                return res.status(500).json({
                    error: 'Azure Functions non configurata: manca AZURE_FUNCTION_URL o AZURE_FUNCTION_KEY'
                });
            }
            try {
                const baseUrl = functionUrl.replace(/\/$/, '');
                const url = `${baseUrl}/api/refreshAll?code=${encodeURIComponent(functionKey)}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const text = await response.text();
                const data = (() => {
                    try {
                        return JSON.parse(text);
                    }
                    catch {
                        return text;
                    }
                })();
                if (!response.ok) {
                    return res.status(response.status).json({
                        error: `Errore Azure Functions: ${response.status}`,
                        details: data
                    });
                }
                return res.status(202).json({
                    ok: true,
                    message: 'Refresh avviato via Azure Functions',
                    details: data
                });
            }
            catch (error) {
                return res.status(500).json({
                    error: 'Errore durante la chiamata ad Azure Functions: ' + (error instanceof Error ? error.message : String(error))
                });
            }
        }
        // Local execution (development)
        try {
            const sources = ['microsoft', 'eos', 'fabric'];
            // Run all refreshes in parallel with Promise.allSettled for resilience
            const settledResults = await Promise.allSettled(sources.map(source => runSingleRefresh(source)));
            // Extract results from settled promises
            const results = settledResults.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                }
                else {
                    // Handle rejected promises (shouldn't happen as runSingleRefresh catches errors)
                    return {
                        source: sources[index],
                        status: 'failed',
                        itemCount: null,
                        duration: 0,
                        timestamp: new Date().toISOString(),
                        error: result.reason instanceof Error ? result.reason.message : 'Promise rejected'
                    };
                }
            });
            const summary = {
                total: results.length,
                successful: results.filter(r => r.status === 'ok').length,
                failed: results.filter(r => r.status === 'failed' || r.status === 'missing').length
            };
            const response = {
                completedAt: new Date().toISOString(),
                results,
                summary
            };
            res.json(response);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante update-all.';
            res.status(500).json({ error: message });
        }
    });
    // GitHub API Proxy
    const GITHUB_TOKEN = process.env.GITHUB_ISSUES_TOKEN || process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.GITHUB_OWNER || 'Allecpu';
    const GITHUB_REPO = process.env.GITHUB_REPO || 'UpdateLens';
    app.get('/api/github/issues', async (req, res) => {
        try {
            if (!GITHUB_TOKEN) {
                return res.status(500).json({ error: 'GITHUB_TOKEN non configurato sul server.' });
            }
            const state = req.query.state || 'open';
            const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?state=${state}&per_page=100`, {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            const data = await response.json();
            res.status(response.status).json(data);
        }
        catch (error) {
            res.status(500).json({ error: 'Errore durante la comunicazione con GitHub.' });
        }
    });
    app.post('/api/github/issues', async (req, res) => {
        try {
            if (!GITHUB_TOKEN) {
                return res.status(500).json({ error: 'GITHUB_TOKEN non configurato sul server.' });
            }
            const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req.body)
            });
            const data = await response.json();
            res.status(response.status).json(data);
        }
        catch (error) {
            res.status(500).json({ error: 'Errore durante la creazione della issue.' });
        }
    });
    app.patch('/api/github/issues/:number', async (req, res) => {
        try {
            if (!GITHUB_TOKEN) {
                return res.status(500).json({ error: 'GITHUB_TOKEN non configurato sul server.' });
            }
            const { number } = req.params;
            const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${number}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req.body)
            });
            const data = await response.json();
            res.status(response.status).json(data);
        }
        catch (error) {
            res.status(500).json({ error: 'Errore durante l\'aggiornamento della issue.' });
        }
    });
    app.get('/api/github/labels', async (_req, res) => {
        try {
            if (!GITHUB_TOKEN) {
                return res.status(500).json({ error: 'GITHUB_TOKEN non configurato sul server.' });
            }
            const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/labels`, {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            const data = await response.json();
            res.status(response.status).json(data);
        }
        catch (error) {
            res.status(500).json({ error: 'Errore durante il caricamento delle label.' });
        }
    });
    app.get('/api/github/issues/:number/comments', async (req, res) => {
        try {
            if (!GITHUB_TOKEN) {
                return res.status(500).json({ error: 'GITHUB_TOKEN non configurato sul server.' });
            }
            const { number } = req.params;
            const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${number}/comments`, {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            const data = await response.json();
            res.status(response.status).json(data);
        }
        catch (error) {
            res.status(500).json({ error: 'Errore durante il caricamento dei commenti.' });
        }
    });
    app.post('/api/github/upload', express.json({ limit: '10mb' }), async (req, res) => {
        try {
            if (!GITHUB_TOKEN) {
                return res.status(500).json({ error: 'GITHUB_TOKEN non configurato sul server.' });
            }
            const { filename, content, message } = req.body;
            if (!filename || !content) {
                return res.status(400).json({ error: 'Nome file e contenuto (base64) richiesti.' });
            }
            const path = `public/uploads/${Date.now()}_${filename}`;
            const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message || `Upload image: ${filename}`,
                    content: content // must be base64
                })
            });
            const data = await response.json();
            if (response.ok) {
                // Return the raw URL for markdown insertion
                const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${path}`;
                res.status(201).json({ url: rawUrl, path: data.content.path });
            }
            else {
                res.status(response.status).json(data);
            }
        }
        catch (error) {
            res.status(500).json({ error: 'Errore durante l\'upload dell\'immagine.' });
        }
    });
    // ============================================
    // Auth & Preset API Endpoints
    // ============================================
    // Check if Easy Auth is configured
    const isEasyAuthConfigured = () => {
        // Easy Auth is only available on Azure App Service
        return process.env.DB_PATH === '/home/data';
    };
    // Auth: Get current user info (includes whitelist check)
    app.get('/api/auth/me', (req, res) => {
        if (!isEasyAuthConfigured()) {
            return res.status(503).json({
                error: 'Autenticazione non configurata. Easy Auth disponibile solo su Azure.',
                authConfigured: false
            });
        }
        const identity = getIdentity(req);
        if (!identity) {
            return res.status(401).json({
                error: 'Non autenticato',
                authConfigured: true
            });
        }
        // Try to bind identity if user exists by email only
        users.bindUserIdentity(db, identity);
        // Check whitelist status
        const whitelistCheck = users.isUserWhitelisted(db, identity);
        // Bind any pending shares for this user
        const boundShares = bindPendingShares(db, identity);
        // If not whitelisted or disabled, return access denied info
        if (!whitelistCheck.found) {
            return res.status(403).json({
                authenticated: true,
                authConfigured: true,
                accessDenied: true,
                accessDeniedReason: 'NOT_WHITELISTED',
                user: {
                    email: identity.email,
                    name: identity.name
                }
            });
        }
        if (!whitelistCheck.enabled) {
            return res.status(403).json({
                authenticated: true,
                authConfigured: true,
                accessDenied: true,
                accessDeniedReason: 'DISABLED',
                user: {
                    email: identity.email,
                    name: identity.name
                }
            });
        }
        res.json({
            authenticated: true,
            authConfigured: true,
            accessDenied: false,
            user: {
                tenantId: identity.tid,
                objectId: identity.oid,
                email: identity.email,
                name: identity.name
            },
            boundShares
        });
    });
    // Middleware to check whitelist for protected endpoints
    const whitelistMiddleware = requireWhitelistedUser(db);
    // Presets: List presets (own + optionally shared)
    app.get('/api/presets', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const includeShared = req.query.includeShared === 'true';
            const presetsResponse = presets.getPresetsForUser(db, identity, includeShared);
            // Separate own and shared presets
            const myPresets = presetsResponse.filter(p => p.isOwner);
            const sharedPresets = presetsResponse.filter(p => !p.isOwner);
            res.json({
                myPresets,
                sharedPresets: includeShared ? sharedPresets : [],
                total: presetsResponse.length
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante il recupero dei preset';
            res.status(500).json({ error: message });
        }
    });
    // Presets: Create new preset
    app.post('/api/presets', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const { name, description, filters, isDefault, visibilityScope } = req.body;
            if (!name || typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({ error: 'Nome preset richiesto' });
            }
            if (!filters) {
                return res.status(400).json({ error: 'Filtri richiesti' });
            }
            const preset = presets.createPreset(db, identity, {
                name: name.trim(),
                description: description?.trim(),
                filters,
                isDefault: !!isDefault,
                visibilityScope: visibilityScope || 'private'
            });
            res.status(201).json(preset);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante la creazione del preset';
            // Check for unique constraint violation
            if (message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Esiste già un preset con questo nome' });
            }
            res.status(500).json({ error: message });
        }
    });
    // Presets: Get single preset
    app.get('/api/presets/:id', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const { id } = req.params;
            const preset = presets.getPresetById(db, id);
            if (!preset) {
                return res.status(404).json({ error: 'Preset non trovato' });
            }
            if (!presets.canAccessPreset(db, identity, preset)) {
                return res.status(403).json({ error: 'Non autorizzato ad accedere a questo preset' });
            }
            const response = {
                id: preset.preset_id,
                name: preset.name,
                description: preset.description,
                filters: JSON.parse(preset.filters_json),
                isDefault: preset.is_default === 1,
                visibilityScope: preset.visibility_scope,
                createdAt: preset.created_at,
                updatedAt: preset.updated_at,
                owner: {
                    email: preset.owner_email,
                    name: preset.owner_name
                },
                isOwner: preset.owner_tenant_id === identity.tid && preset.owner_object_id === identity.oid
            };
            res.json(response);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante il recupero del preset';
            res.status(500).json({ error: message });
        }
    });
    // Presets: Update preset
    app.put('/api/presets/:id', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const { id } = req.params;
            const preset = presets.getPresetById(db, id);
            if (!preset) {
                return res.status(404).json({ error: 'Preset non trovato' });
            }
            if (!presets.canModifyPreset(identity, preset)) {
                return res.status(403).json({ error: 'Non autorizzato a modificare questo preset' });
            }
            const { name, description, filters, isDefault } = req.body;
            const updated = presets.updatePreset(db, identity, id, {
                name: name?.trim(),
                description: description?.trim(),
                filters,
                isDefault
            });
            res.json(updated);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante l\'aggiornamento del preset';
            if (message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Esiste già un preset con questo nome' });
            }
            res.status(500).json({ error: message });
        }
    });
    // Presets: Delete preset
    app.delete('/api/presets/:id', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const { id } = req.params;
            const preset = presets.getPresetById(db, id);
            if (!preset) {
                return res.status(404).json({ error: 'Preset non trovato' });
            }
            if (!presets.canModifyPreset(identity, preset)) {
                return res.status(403).json({ error: 'Non autorizzato a eliminare questo preset' });
            }
            presets.deletePreset(db, id);
            res.status(204).send();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante l\'eliminazione del preset';
            res.status(500).json({ error: message });
        }
    });
    // Presets: Duplicate preset
    app.post('/api/presets/:id/duplicate', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const { id } = req.params;
            const { newName } = req.body;
            if (!newName || typeof newName !== 'string' || !newName.trim()) {
                return res.status(400).json({ error: 'Nuovo nome richiesto' });
            }
            const preset = presets.getPresetById(db, id);
            if (!preset) {
                return res.status(404).json({ error: 'Preset non trovato' });
            }
            if (!presets.canAccessPreset(db, identity, preset)) {
                return res.status(403).json({ error: 'Non autorizzato ad accedere a questo preset' });
            }
            const duplicated = presets.duplicatePreset(db, identity, id, newName.trim());
            res.status(201).json(duplicated);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante la duplicazione del preset';
            if (message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Esiste già un preset con questo nome' });
            }
            res.status(500).json({ error: message });
        }
    });
    // Sharing: Get sharing info for a preset
    app.get('/api/presets/:id/sharing', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const { id } = req.params;
            const preset = presets.getPresetById(db, id);
            if (!preset) {
                return res.status(404).json({ error: 'Preset non trovato' });
            }
            if (!presets.canModifyPreset(identity, preset)) {
                return res.status(403).json({ error: 'Solo il proprietario può vedere le impostazioni di condivisione' });
            }
            const sharingInfo = presets.getSharingInfo(db, id);
            res.json(sharingInfo);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante il recupero delle informazioni di condivisione';
            res.status(500).json({ error: message });
        }
    });
    // Sharing: Update sharing settings for a preset
    app.put('/api/presets/:id/sharing', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const { id } = req.params;
            const { visibilityScope, granteeEmails } = req.body;
            if (!visibilityScope || !['private', 'all_users', 'specific_users'].includes(visibilityScope)) {
                return res.status(400).json({ error: 'Scope di visibilità non valido' });
            }
            const preset = presets.getPresetById(db, id);
            if (!preset) {
                return res.status(404).json({ error: 'Preset non trovato' });
            }
            if (!presets.canModifyPreset(identity, preset)) {
                return res.status(403).json({ error: 'Solo il proprietario può modificare le impostazioni di condivisione' });
            }
            // Validate emails if specific_users
            if (visibilityScope === 'specific_users') {
                if (!Array.isArray(granteeEmails) || granteeEmails.length === 0) {
                    return res.status(400).json({ error: 'Almeno un destinatario richiesto per condivisione specifica' });
                }
                // Validate all emails
                for (const email of granteeEmails) {
                    if (typeof email !== 'string' || !email.includes('@')) {
                        return res.status(400).json({ error: `Email non valida: ${email}` });
                    }
                    if (!isAllowedDomain(email)) {
                        return res.status(400).json({ error: `Solo email @eos-solutions.it sono consentite: ${email}` });
                    }
                }
            }
            presets.updateSharing(db, identity, id, {
                visibilityScope,
                granteeEmails: granteeEmails || []
            });
            const updatedSharingInfo = presets.getSharingInfo(db, id);
            res.json(updatedSharingInfo);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante l\'aggiornamento delle impostazioni di condivisione';
            res.status(500).json({ error: message });
        }
    });
    // Shares: Get presets I've shared with others (outgoing)
    app.get('/api/shares/outgoing', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const outgoing = presets.getOutgoingShares(db, identity);
            res.json({ shares: outgoing });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante il recupero delle condivisioni in uscita';
            res.status(500).json({ error: message });
        }
    });
    // ============================================
    // User Management API Endpoints
    // ============================================
    // Users: Get all users + current user info
    app.get('/api/shares/users', (req, res) => {
        if (!isEasyAuthConfigured()) {
            return res.status(503).json({ error: 'Autenticazione non configurata' });
        }
        const identity = getIdentity(req);
        if (!identity) {
            return res.status(401).json({ error: 'Non autenticato' });
        }
        try {
            const response = users.getUsersForIdentity(db, identity);
            // Only return users list if current user can manage users
            if (!response.currentUser.canManageUsers) {
                return res.json({
                    users: [],
                    currentUser: response.currentUser
                });
            }
            res.json(response);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante il recupero degli utenti';
            res.status(500).json({ error: message });
        }
    });
    // Users: Add a new user (requires whitelist - only existing users can add new users)
    app.post('/api/shares/users', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const currentUser = users.ensureUserExists(db, identity);
            if (!canManageUsers(currentUser.role)) {
                return res.status(403).json({ error: 'Non autorizzato a gestire gli utenti' });
            }
            const { email, name, role } = req.body;
            if (!email || typeof email !== 'string' || !email.includes('@')) {
                return res.status(400).json({ error: 'Email valida richiesta' });
            }
            if (!role || !['admin', 'sharing_manager', 'viewer'].includes(role)) {
                return res.status(400).json({ error: 'Ruolo non valido. Valori ammessi: admin, sharing_manager, viewer' });
            }
            const newUser = users.addUser(db, identity, currentUser.role, {
                email: email.trim(),
                name: name?.trim(),
                role
            });
            res.status(201).json(newUser);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante l\'aggiunta dell\'utente';
            if (message.includes('già esistente')) {
                return res.status(409).json({ error: message });
            }
            res.status(400).json({ error: message });
        }
    });
    // Users: Update a user (role, enabled) - requires whitelist
    app.patch('/api/shares/users/:id', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const { id } = req.params;
            const currentUser = users.ensureUserExists(db, identity);
            if (!canManageUsers(currentUser.role)) {
                return res.status(403).json({ error: 'Non autorizzato a gestire gli utenti' });
            }
            const { role, enabled } = req.body;
            if (role !== undefined && !['admin', 'sharing_manager', 'viewer'].includes(role)) {
                return res.status(400).json({ error: 'Ruolo non valido. Valori ammessi: admin, sharing_manager, viewer' });
            }
            if (enabled !== undefined && typeof enabled !== 'boolean') {
                return res.status(400).json({ error: 'enabled deve essere un booleano' });
            }
            const updatedUser = users.updateUser(db, identity, currentUser.role, id, {
                role,
                enabled
            });
            res.json(updatedUser);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante l\'aggiornamento dell\'utente';
            if (message.includes('non trovato')) {
                return res.status(404).json({ error: message });
            }
            res.status(400).json({ error: message });
        }
    });
    // ============================================
    // End User Management API Endpoints
    // ============================================
    // Shares: Get presets shared with me (incoming)
    app.get('/api/shares/incoming', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const incoming = presets.getIncomingShares(db, identity);
            res.json({ shares: incoming });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante il recupero delle condivisioni in entrata';
            res.status(500).json({ error: message });
        }
    });
    // Migration: Migrate presets from localStorage
    app.post('/api/presets/migrate', whitelistMiddleware, (req, res) => {
        const identity = req.user;
        try {
            const { presets: localPresets } = req.body;
            if (!Array.isArray(localPresets)) {
                return res.status(400).json({ error: 'Array di preset richiesto' });
            }
            const result = presets.migratePresetsFromLocalStorage(db, identity, localPresets);
            res.json({
                success: true,
                migrated: result.migrated,
                skipped: result.skipped,
                errors: result.errors
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante la migrazione dei preset';
            res.status(500).json({ error: message });
        }
    });
    // ============================================
    // End Auth & Preset API Endpoints
    // ============================================
    // SPA fallback - serve index.html for non-API routes
    app.get('*', (req, res) => {
        // Don't serve index.html for API routes
        if (req.path.startsWith('/api/') || req.path === '/health') {
            return res.status(404).json({ error: 'Not found' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
    return app;
};
