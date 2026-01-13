import express from 'express';
import { createDb } from './db';
import { buildRefreshZip, type RefreshSource } from './refreshZip';
import { buildReleaseZip } from './releaseZip';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const buildCacheKey = (query: Record<string, string | undefined>) => {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&');
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

  return app;
};
