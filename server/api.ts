import express from 'express';
import { createDb } from "./db.js";
import { buildRefreshZip, type RefreshSource } from "./refreshZip.js";
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getIdentity, requireAuth, optionalAuth, isAllowedDomain, bindPendingShares, canManageUsers, requireWhitelistedUser, type UserIdentity } from './auth.js';
import * as presets from './presets.js';
import * as users from './users.js';
import type { WhitelistCheckResult } from './users.js';
import { handleChatQuery } from './chat/ChatController.js';
import * as css from './css.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

type SourceUpdateResult = {
  source: 'microsoft' | 'eos' | 'fabric' | 'm365roadmap';
  status: 'ok' | 'failed' | 'missing';
  itemCount: number | null;
  duration: number;
  error?: string;
  timestamp: string;
};

type UpdateAllResponse = {
  completedAt: string;
  results: SourceUpdateResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CHAT_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS ?? 60_000));
const CHAT_RATE_LIMIT_MAX_REQUESTS = Math.max(1, Number(process.env.CHAT_RATE_LIMIT_MAX_REQUESTS ?? 30));
const CHAT_RATE_LIMIT_BURST_WINDOW_MS = Math.max(1000, Number(process.env.CHAT_RATE_LIMIT_BURST_WINDOW_MS ?? 10_000));
const CHAT_RATE_LIMIT_BURST_MAX_REQUESTS = Math.max(1, Number(process.env.CHAT_RATE_LIMIT_BURST_MAX_REQUESTS ?? 8));
const CHAT_RATE_LIMIT_MAX_KEYS = Math.max(100, Number(process.env.CHAT_RATE_LIMIT_MAX_KEYS ?? 10_000));

type RateWindowBucket = {
  startedAt: number;
  count: number;
};

const chatRateLimitWindows = new Map<string, RateWindowBucket>();
const chatRateLimitBurstWindows = new Map<string, RateWindowBucket>();

const normalizeClientIp = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const withoutPort = trimmed.replace(/:\d+$/, '');
  return withoutPort.startsWith('::ffff:') ? withoutPort.slice(7) : withoutPort;
};

const getChatRateLimitKey = (req: express.Request): string => {
  const rawClientId = typeof req.headers['x-client-id'] === 'string' ? req.headers['x-client-id'] : '';
  const clientId = rawClientId.trim();
  if (clientId) {
    return `client:${clientId.slice(0, 120)}`;
  }

  const forwardedRaw = typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'] : '';
  const forwardedIp = forwardedRaw.split(',')[0] ?? '';
  const ip =
    normalizeClientIp(forwardedIp) ||
    normalizeClientIp(req.socket.remoteAddress ?? '') ||
    'unknown';
  return `ip:${ip}`;
};

const touchRateWindow = (
  store: Map<string, RateWindowBucket>,
  key: string,
  maxRequests: number,
  windowMs: number,
  now: number
) => {
  const existing = store.get(key);
  if (!existing || now - existing.startedAt >= windowMs) {
    store.set(key, { startedAt: now, count: 1 });
    return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - existing.startedAt)) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true, remaining: Math.max(0, maxRequests - existing.count), retryAfterSeconds: 0 };
};

const cleanupRateWindow = (
  store: Map<string, RateWindowBucket>,
  now: number,
  maxWindowMs: number
) => {
  if (store.size <= CHAT_RATE_LIMIT_MAX_KEYS) {
    return;
  }
  for (const [key, value] of store.entries()) {
    if (now - value.startedAt > maxWindowMs) {
      store.delete(key);
    }
    if (store.size <= CHAT_RATE_LIMIT_MAX_KEYS) {
      break;
    }
  }
};

const chatQueryRateLimitMiddleware: express.RequestHandler = (req, res, next) => {
  const now = Date.now();
  const key = getChatRateLimitKey(req);

  cleanupRateWindow(chatRateLimitWindows, now, CHAT_RATE_LIMIT_WINDOW_MS);
  cleanupRateWindow(chatRateLimitBurstWindows, now, CHAT_RATE_LIMIT_BURST_WINDOW_MS);

  const sustained = touchRateWindow(
    chatRateLimitWindows,
    key,
    CHAT_RATE_LIMIT_MAX_REQUESTS,
    CHAT_RATE_LIMIT_WINDOW_MS,
    now
  );
  const burst = touchRateWindow(
    chatRateLimitBurstWindows,
    key,
    CHAT_RATE_LIMIT_BURST_MAX_REQUESTS,
    CHAT_RATE_LIMIT_BURST_WINDOW_MS,
    now
  );

  if (!sustained.allowed || !burst.allowed) {
    const retryAfter = Math.max(sustained.retryAfterSeconds, burst.retryAfterSeconds);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Troppe richieste chat. Riprova tra pochi secondi.'
    });
  }

  res.setHeader('X-RateLimit-Limit', String(CHAT_RATE_LIMIT_MAX_REQUESTS));
  res.setHeader('X-RateLimit-Remaining', String(sustained.remaining));
  res.setHeader('X-RateLimit-Window-Seconds', String(Math.ceil(CHAT_RATE_LIMIT_WINDOW_MS / 1000)));
  return next();
};

const buildCacheKey = (query: Record<string, string | undefined>) => {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&');
};

const runSingleRefresh = async (
  source: 'microsoft' | 'eos' | 'fabric' | 'm365roadmap'
): Promise<SourceUpdateResult> => {
  const startTime = Date.now();

  try {
    // Run the npm script for this source
    await execAsync(`npm run refresh:${source}`, { cwd: repoRoot });

    const duration = Date.now() - startTime;
    const timestamp = new Date().toISOString();

    // Read latest.json to verify the snapshot was created
    const latestPath = path.resolve(repoRoot, 'public', 'data', 'latest.json');
    const latestRaw = await readFile(latestPath, 'utf-8');
    const latest = JSON.parse(latestRaw) as Record<string, string>;
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
    const snapshot = JSON.parse(snapshotRaw) as { version: number; items: unknown[] };

    return {
      source,
      status: 'ok',
      itemCount: snapshot.items.length,
      duration,
      timestamp
    };
  } catch (error) {
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

  app.post('/api/chat/query', chatQueryRateLimitMiddleware, handleChatQuery);
  app.get('/api/chat/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // GitHub Proxy for Web Mode
  app.all('/api/github/*', async (req, res) => {
    const envToken = process.env.GITHUB_ISSUES_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'Allecpu';
    const repo = process.env.GITHUB_REPO || 'UpdateLens';
    const inboundAuth = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
    const normalizeAuth = (value?: string) => {
      if (!value) return '';
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

    const githubPath = (req.params as string[])[0];
    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
    const url = `https://api.github.com/repos/${owner}/${repo}/${githubPath}${query}`;

    try {
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined;
      const makeHeaders = (auth?: string) => {
        const headers: Record<string, string> = {
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
    } catch (error) {
      res.status(500).json({ error: 'Errore durante il proxy GitHub: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });

  app.get('/api/releaseplans', (req, res) => {
    const {
      app: appName,
      product,
      status,
      wave,
      tag,
      lang = 'en-US',
      updatedSince,
      limit,
      offset,
      sort = 'newest'
    } = req.query as Record<string, string>;

    const effectiveLimit = Math.min(Number(limit || DEFAULT_LIMIT), MAX_LIMIT);
    const effectiveOffset = Number(offset || 0);

    const filters: string[] = ['language = @lang'];
    const params: Record<string, unknown> = {
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
    const orderClause =
      sort === 'oldest' ? 'ORDER BY availability_date ASC' : 'ORDER BY availability_date DESC';

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
    const total = db.prepare(countQuery).get(params) as { total: number };

    const cacheKey = buildCacheKey(req.query as Record<string, string>);
    const snapshot = db
      .prepare(
        `SELECT hash FROM release_plan_snapshots WHERE language = ? ORDER BY snapshot_id DESC LIMIT 1`
      )
      .get(lang) as { hash?: string } | undefined;
    const etag = snapshot?.hash ? `${snapshot.hash}:${cacheKey}` : cacheKey;
    if (etag && req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('ETag', etag);
    res.json({ items, total: total?.total ?? 0 });
  });

  app.get('/api/releaseplans/meta', (req, res) => {
    const lang = (req.query.lang as string) ?? 'en-US';
    const selectDistinct = (column: string) =>
      db
        .prepare(
          `SELECT DISTINCT ${column} as value FROM release_plan_items WHERE language = ? ORDER BY ${column}`
        )
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
    const lang = (req.query.lang as string) ?? 'en-US';
    const item = db
      .prepare(
        `SELECT * FROM release_plan_items WHERE source_plan_id = ? AND language = ?`
      )
      .get(planId, lang);
    if (!item) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(item);
  });

  app.get('/api/releaseplans/changes', (req, res) => {
    const since = (req.query.since as string) ?? '';
    if (!since) {
      res.status(400).json({ error: 'Missing since parameter' });
      return;
    }
    const rows = db
      .prepare(
        `SELECT h.*, i.source_plan_id, i.feature_name, i.product_name
         FROM release_plan_history h
         JOIN release_plan_items i ON i.id = h.item_id
         WHERE h.changed_at >= ?
         ORDER BY h.changed_at DESC`
      )
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
      const sourcesRaw = (req.body?.sources ?? []) as string[];
      const sources = sourcesRaw
        .map((value) => value.toLowerCase())
        .filter((value): value is RefreshSource => value === 'microsoft' || value === 'eos');

      const result = await buildRefreshZip(sources);
      const filename = `UpdateLens_refresh_${result.manifest.generatedAt.replace(/[:.]/g, '-')}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-UpdateLens-Refresh-At', result.manifest.generatedAt);
      res.setHeader('X-UpdateLens-Items-Microsoft', String(result.manifest.items.microsoft));
      res.setHeader('X-UpdateLens-Items-EOS', String(result.manifest.items.eos));
      res.setHeader('X-UpdateLens-Result', 'success');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'X-UpdateLens-Refresh-At, X-UpdateLens-Items-Microsoft, X-UpdateLens-Items-EOS, X-UpdateLens-Result, Content-Disposition'
      );

      res.send(result.zipBuffer);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Errore durante refresh ZIP.';
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
          } catch {
            return text;
          }
        })();

        if (!response.ok) {
          return res.status(response.status).json({
            error: `Errore Azure Functions: ${response.status}`,
            details: data
          });
        }

        return res.status(response.status).json(data);
      } catch (error) {
        return res.status(500).json({
          error: 'Errore durante la chiamata ad Azure Functions: ' + (error instanceof Error ? error.message : String(error))
        });
      }
    }

    // Local execution (development)
    try {
      const sources: Array<'microsoft' | 'eos' | 'fabric' | 'm365roadmap'> = [
        'microsoft',
        'eos',
        'fabric',
        'm365roadmap'
      ];

      // Run all refreshes in parallel with Promise.allSettled for resilience
      const settledResults = await Promise.allSettled(
        sources.map(source => runSingleRefresh(source))
      );

      // Extract results from settled promises
      const results: SourceUpdateResult[] = settledResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
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

      const response: UpdateAllResponse = {
        completedAt: new Date().toISOString(),
        results,
        summary
      };

      res.json(response);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      res.status(500).json({ error: 'Errore durante il caricamento delle label.' });
    }
  });

  app.get('/api/github/issues/:number/comments', async (req, res) => {
    try {
      if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'GITHUB_TOKEN non configurato sul server.' });
      }
      const { number } = req.params;
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${number}/comments`,
        {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
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
      } else {
        res.status(response.status).json(data);
      }
    } catch (error) {
      res.status(500).json({ error: 'Errore durante l\'upload dell\'immagine.' });
    }
  });

  // ============================================
  // CSS API Endpoints
  // ============================================

  app.get('/api/css/customers', (_req, res) => {
    try {
      res.json({ items: css.listCssCustomers(db) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il recupero clienti CSS';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/css/customers', (req, res) => {
    try {
      const { name, aliases, isActive } = req.body ?? {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'name obbligatorio' });
      }
      const created = css.createCssCustomer(db, {
        name,
        aliases: Array.isArray(aliases) ? aliases.filter((item: unknown) => typeof item === 'string') : [],
        isActive: typeof isActive === 'boolean' ? isActive : true
      });
      res.status(201).json(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante la creazione cliente CSS';
      res.status(400).json({ error: message });
    }
  });

  app.patch('/api/css/customers/:id', (req, res) => {
    try {
      const { name, aliases, isActive } = req.body ?? {};
      const updated = css.updateCssCustomer(db, req.params.id, {
        name: typeof name === 'string' ? name : undefined,
        aliases: Array.isArray(aliases)
          ? aliases.filter((item: unknown) => typeof item === 'string')
          : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined
      });
      res.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante aggiornamento cliente CSS';
      const status = message.includes('non trovato') ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/css/customers/merge', (req, res) => {
    try {
      const { primaryCustomerId, secondaryCustomerId } = req.body ?? {};
      if (!primaryCustomerId || typeof primaryCustomerId !== 'string') {
        return res.status(400).json({ error: 'primaryCustomerId obbligatorio' });
      }
      if (!secondaryCustomerId || typeof secondaryCustomerId !== 'string') {
        return res.status(400).json({ error: 'secondaryCustomerId obbligatorio' });
      }
      const result = css.mergeCssCustomers(db, { primaryCustomerId, secondaryCustomerId });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante merge clienti CSS';
      const status = message.includes('non trovato') ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/css/meta', (_req, res) => {
    try {
      res.json(css.getCssMeta(db));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il recupero metadata CSS';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/css/activities', (req, res) => {
    try {
      const activities = css.listCssActivities(db, {
        customer: typeof req.query.customer === 'string' ? req.query.customer : undefined,
        owner: typeof req.query.owner === 'string' ? req.query.owner : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        query: typeof req.query.query === 'string' ? req.query.query : undefined
      });
      res.json({ items: activities, total: activities.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il recupero attività CSS';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/css/activities', (req, res) => {
    try {
      const {
        customerName, cssOwner, lastUpdate, blBu, issue, listStatus, issueStatus, details,
        eosOwners, customerOwners, cssAction, notes, customerPriority, cssPriority, dueDate,
        rating, itemType, sourceRef
      } = req.body ?? {};
      if (!customerName || typeof customerName !== 'string') {
        return res.status(400).json({ error: 'customerName obbligatorio' });
      }
      if (!issue || typeof issue !== 'string') {
        return res.status(400).json({ error: 'issue obbligatoria' });
      }
      const created = css.createCssActivity(db, {
        customerName,
        cssOwner: typeof cssOwner === 'string' ? cssOwner : null,
        lastUpdate: typeof lastUpdate === 'string' ? lastUpdate : null,
        blBu: typeof blBu === 'string' ? blBu : null,
        issue,
        listStatus: typeof listStatus === 'string' ? listStatus : null,
        issueStatus: typeof issueStatus === 'string' ? issueStatus : 'Action required',
        details: typeof details === 'string' ? details : null,
        eosOwners: typeof eosOwners === 'string' ? eosOwners : null,
        customerOwners: typeof customerOwners === 'string' ? customerOwners : null,
        cssAction: typeof cssAction === 'string' ? cssAction : null,
        notes: typeof notes === 'string' ? notes : null,
        customerPriority: typeof customerPriority === 'string' ? customerPriority : null,
        cssPriority: typeof cssPriority === 'string' ? cssPriority : null,
        dueDate: typeof dueDate === 'string' ? dueDate : null,
        rating: typeof rating === 'number' ? rating : null,
        itemType: typeof itemType === 'string' ? itemType : null,
        sourceRef: typeof sourceRef === 'string' ? sourceRef : null
      });
      res.status(201).json(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante la creazione attività CSS';
      res.status(400).json({ error: message });
    }
  });

  app.patch('/api/css/activities/:id', (req, res) => {
    try {
      const updated = css.updateCssActivity(db, req.params.id, req.body ?? {});
      res.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante aggiornamento attività CSS';
      const status = message.includes('non trovata') ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.delete('/api/css/activities/:id', (req, res) => {
    try {
      const result = css.deleteCssActivity(db, req.params.id);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante eliminazione attività CSS';
      const status = message.includes('non trovata') ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/css/activities/bulk-delete', (req, res) => {
    try {
      const { activityIds } = req.body ?? {};
      if (!Array.isArray(activityIds) || activityIds.length === 0) {
        return res.status(400).json({ error: 'activityIds obbligatorio (array non vuoto)' });
      }
      const result = css.bulkDeleteCssActivities(
        db,
        activityIds.filter((id: unknown) => typeof id === 'string')
      );
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore bulk delete attività CSS';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/css/activities/bulk-status', (req, res) => {
    try {
      const { activityIds, issueStatus } = req.body ?? {};
      if (!Array.isArray(activityIds) || activityIds.length === 0) {
        return res.status(400).json({ error: 'activityIds obbligatorio (array non vuoto)' });
      }
      if (!issueStatus || typeof issueStatus !== 'string') {
        return res.status(400).json({ error: 'issueStatus obbligatorio' });
      }
      const result = css.bulkUpdateCssActivityStatus(db, {
        activityIds: activityIds.filter((id: unknown) => typeof id === 'string'),
        issueStatus
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore bulk update stato attività CSS';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/css/documents', (_req, res) => {
    try {
      res.json({ items: css.listCssDocuments(db) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il recupero documenti CSS';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/css/documents/upload', async (req, res) => {
    try {
      const { filename, mimeType, contentBase64 } = req.body ?? {};
      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ error: 'filename obbligatorio' });
      }
      if (!contentBase64 || typeof contentBase64 !== 'string') {
        return res.status(400).json({ error: 'contentBase64 obbligatorio' });
      }
      const uploaded = await css.uploadCssDocument(db, {
        filename,
        mimeType: typeof mimeType === 'string' ? mimeType : null,
        contentBase64,
        uploadedBy: req.user?.email ?? null
      });
      res.status(201).json(uploaded);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante upload documento';
      res.status(400).json({ error: message });
    }
  });

  app.delete('/api/css/documents/:id', (req, res) => {
    try {
      const result = css.deleteCssDocument(db, req.params.id);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante eliminazione documento';
      const status = message.includes('non trovato') ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/css/documents/:id/extract', async (req, res) => {
    try {
      const result = await css.processCssDocument(db, req.params.id);
      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante l\'estrazione documento';
      const status = message.includes('non trovato') ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/css/documents/:id/batches', (req, res) => {
    try {
      const items = css.listCssDocumentBatches(db, req.params.id);
      res.json({ items, total: items.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il recupero storico analisi documento';
      const status = message.includes('non trovato') ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/css/proposals/:batchId', (req, res) => {
    try {
      const proposals = css.getCssProposalsByBatch(db, req.params.batchId);
      res.json({ items: proposals, total: proposals.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il recupero proposte';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/css/proposals/:batchId/validate', (req, res) => {
    try {
      const result = css.validateCssBatch(db, req.params.batchId, {
        reviewer: req.user?.email ?? null,
        approveAll: Boolean(req.body?.approveAll),
        decisions: Array.isArray(req.body?.decisions) ? req.body.decisions : []
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante la validazione proposte';
      const status = message.includes('non trovato') ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  // ============================================
  // Auth & Preset API Endpoints
  // ============================================

  // Check if Easy Auth is configured
  const isEasyAuthConfigured = (): boolean => {
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
    const identity = req.user!;

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il recupero dei preset';
      res.status(500).json({ error: message });
    }
  });

  // Presets: Create new preset
  app.post('/api/presets', whitelistMiddleware, (req, res) => {
    const identity = req.user!;

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
    } catch (error) {
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
    const identity = req.user!;

    try {
      const { id } = req.params;
      const preset = presets.getPresetById(db, id);

      if (!preset) {
        return res.status(404).json({ error: 'Preset non trovato' });
      }

      if (!presets.canAccessPreset(db, identity, preset)) {
        return res.status(403).json({ error: 'Non autorizzato ad accedere a questo preset' });
      }

      const response: presets.PresetResponse = {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il recupero del preset';
      res.status(500).json({ error: message });
    }
  });

  // Presets: Update preset
  app.put('/api/presets/:id', whitelistMiddleware, (req, res) => {
    const identity = req.user!;

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante l\'aggiornamento del preset';
      if (message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Esiste già un preset con questo nome' });
      }
      res.status(500).json({ error: message });
    }
  });

  // Presets: Delete preset
  app.delete('/api/presets/:id', whitelistMiddleware, (req, res) => {
    const identity = req.user!;

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante l\'eliminazione del preset';
      res.status(500).json({ error: message });
    }
  });

  // Presets: Duplicate preset
  app.post('/api/presets/:id/duplicate', whitelistMiddleware, (req, res) => {
    const identity = req.user!;

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante la duplicazione del preset';
      if (message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Esiste già un preset con questo nome' });
      }
      res.status(500).json({ error: message });
    }
  });

  // Sharing: Get sharing info for a preset
  app.get('/api/presets/:id/sharing', whitelistMiddleware, (req, res) => {
    const identity = req.user!;

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il recupero delle informazioni di condivisione';
      res.status(500).json({ error: message });
    }
  });

  // Sharing: Update sharing settings for a preset
  app.put('/api/presets/:id/sharing', whitelistMiddleware, (req, res) => {
    const identity = req.user!;

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante l\'aggiornamento delle impostazioni di condivisione';
      res.status(500).json({ error: message });
    }
  });

  // Shares: Get presets I've shared with others (outgoing)
  app.get('/api/shares/outgoing', whitelistMiddleware, (req, res) => {
    const identity = req.user!;

    try {
      const outgoing = presets.getOutgoingShares(db, identity);
      res.json({ shares: outgoing });
    } catch (error) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il recupero degli utenti';
      res.status(500).json({ error: message });
    }
  });

  // Users: Add a new user (requires whitelist - only existing users can add new users)
  app.post('/api/shares/users', whitelistMiddleware, (req, res) => {
    const identity = req.user!;

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante l\'aggiunta dell\'utente';
      if (message.includes('già esistente')) {
        return res.status(409).json({ error: message });
      }
      res.status(400).json({ error: message });
    }
  });

  // Users: Update a user (role, enabled) - requires whitelist
  app.patch('/api/shares/users/:id', whitelistMiddleware, (req, res) => {
    const identity = req.user!;

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
    } catch (error) {
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
    const identity = req.user!;

    try {
      const incoming = presets.getIncomingShares(db, identity);
      res.json({ shares: incoming });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il recupero delle condivisioni in entrata';
      res.status(500).json({ error: message });
    }
  });

  // Migration: Migrate presets from localStorage
  app.post('/api/presets/migrate', whitelistMiddleware, (req, res) => {
    const identity = req.user!;

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
    } catch (error) {
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
