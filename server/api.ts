import express from 'express';
import { createDb } from './db';
import { buildRefreshZip, type RefreshSource } from './refreshZip';
import { buildReleaseZip } from './releaseZip';
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

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
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

  return app;
};
