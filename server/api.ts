import express from 'express';
import { createDb } from "./db.js";
import { buildRefreshZip, type RefreshSource } from "./refreshZip.js";
import { buildReleaseZip } from "./releaseZip.js";
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

type SourceUpdateResult = {
  source: 'microsoft' | 'eos' | 'fabric';
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

const buildCacheKey = (query: Record<string, string | undefined>) => {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&');
};

const runSingleRefresh = async (
  source: 'microsoft' | 'eos' | 'fabric'
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

  app.post('/api/release-zip', async (_req, res) => {
    try {
      const result = await buildReleaseZip();
      const filename = `UpdateLens_release_${result.generatedAt.replace(/[:.]/g, '-')}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-UpdateLens-Release-At', result.generatedAt);
      res.setHeader('X-UpdateLens-Result', 'success');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'X-UpdateLens-Release-At, X-UpdateLens-Result, Content-Disposition'
      );

      res.send(result.zipBuffer);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Errore durante build release ZIP.';
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

        return res.status(202).json({
          ok: true,
          message: 'Refresh avviato via Azure Functions',
          details: data
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Errore durante la chiamata ad Azure Functions: ' + (error instanceof Error ? error.message : String(error))
        });
      }
    }

    // Local execution (development)
    try {
      const sources: Array<'microsoft' | 'eos' | 'fabric'> = ['microsoft', 'eos', 'fabric'];

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
