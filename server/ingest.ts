import crypto from 'node:crypto';
import { createDb } from './db';
import { buildReleasePlansUrl, isValidGuid } from './releaseplans';
import { normalizeText, parseDateFull, parseMonthDate, resolveAppName } from './normalize';

type RawMicrosoftItem = {
  ['Product name']?: string;
  ['ProductId']?: string;
  ['Feature name']?: string;
  ['Business value']?: string;
  ['Investment area']?: string;
  ['Early access date']?: string;
  ['Public preview date']?: string;
  ['GA date']?: string;
  ['Public Preview Release Wave']?: string;
  ['GA Release Wave']?: string;
  ['Enabled for']?: string;
  ['GeographicAreasDetails']?: string;
  ['Last Gitcommit date']?: string;
  ['Release Plan ID']?: string;
};

type RawMicrosoftResponse = {
  results: RawMicrosoftItem[];
  totalrecords?: string;
};

type NormalizedItem = {
  sourcePlanId: string;
  releasePlanId: string | null;
  learnUrl: string | null;
  appName: string;
  productName: string;
  featureName: string;
  summary: string;
  investmentArea: string | null;
  status: string;
  wave: string | null;
  availabilityDate: string | null;
  availabilityDateFull: string | null;
  firstAvailableDate: string | null;
  lastUpdatedDate: string | null;
  enabledFor: string | null;
  geographyHtml: string | null;
  language: string;
  sourceUrl: string;
  availabilityTypes: string[];
};

const SOURCE_URL = process.env.RELEASEPLANS_URL
  ? process.env.RELEASEPLANS_URL
  : 'https://releaseplans.microsoft.com/en-US/allreleaseplans/';
const SNAPSHOT_URL =
  'https://releaseplans.microsoft.com/_api/mssh_releaseplansnapshots?$select=mssh_releaseplansnapshotid,mssh_featurename,_mssh_releaseplan_value,mssh_docsurl,mssh_articlepath&$filter=statecode eq 0';

const LANGUAGE = process.env.RELEASEPLANS_LANG ?? 'en-US';
const SCHEMA_VERSION = 'v1';

const buildStatus = (raw: RawMicrosoftItem): string => {
  if (raw['GA date']) {
    return 'Launched';
  }
  if (raw['Public preview date']) {
    return 'Try now';
  }
  if (raw['Early access date']) {
    return 'Planned';
  }
  return 'Unknown';
};

const buildAvailabilityTypes = (raw: RawMicrosoftItem): string[] => {
  const types: string[] = [];
  if (raw['Early access date']) {
    types.push('Early Access');
  }
  if (raw['Public preview date']) {
    types.push('Public Preview');
  }
  if (raw['GA date']) {
    types.push('GA');
  }
  return types;
};

const toSummary = (raw: RawMicrosoftItem): string => {
  const summary = raw['Business value'] ? normalizeText(raw['Business value']) : '';
  return summary || 'Details available in the official release plans link.';
};

const buildSnapshotKey = (releasePlanId: string, featureName: string): string => {
  return `${releasePlanId}::${normalizeText(featureName).toLowerCase()}`;
};

const normalizeDocUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `https://learn.microsoft.com${trimmed}`;
  }
  return null;
};

const normalizeItem = (
  raw: RawMicrosoftItem,
  language: string,
  snapshotIndex: Map<string, { snapshotId: string; learnUrl: string | null }>
): NormalizedItem | null => {
  const product = normalizeText(raw['Product name'] ?? '');
  const feature = normalizeText(raw['Feature name'] ?? '');
  const planId = normalizeText(raw['Release Plan ID'] ?? '');
  if (!product || !feature || !planId || !isValidGuid(planId)) {
    return null;
  }
  const appName = resolveAppName(product);
  if (!appName) {
    return null;
  }

  const gaMonth = parseMonthDate(raw['GA date'] ?? '');
  const publicMonth = parseMonthDate(raw['Public preview date'] ?? '');
  const earlyMonth = parseMonthDate(raw['Early access date'] ?? '');
  const availabilityDate = gaMonth || publicMonth || earlyMonth;

  const gaFull = parseDateFull(raw['GA date'] ?? '');
  const publicFull = parseDateFull(raw['Public preview date'] ?? '');
  const earlyFull = parseDateFull(raw['Early access date'] ?? '');
  const firstAvailableDate = earlyFull || publicFull || gaFull;
  const availabilityDateFull = gaFull || publicFull || earlyFull;
  const lastUpdated = parseDateFull(raw['Last Gitcommit date'] ?? '');

  const snapshotKey = buildSnapshotKey(planId, feature);
  const snapshotEntry = snapshotIndex.get(snapshotKey);
  const snapshotId = snapshotEntry?.snapshotId;
  const sourcePlanId = snapshotId ?? planId;
  const learnUrl = snapshotEntry?.learnUrl ?? null;
  const sourceUrl = buildReleasePlansUrl(appName, sourcePlanId);
  return {
    sourcePlanId,
    releasePlanId: planId,
    learnUrl,
    appName,
    productName: product,
    featureName: feature,
    summary: toSummary(raw),
    investmentArea: raw['Investment area'] ? normalizeText(raw['Investment area']) : null,
    status: buildStatus(raw),
    wave: raw['GA Release Wave'] || raw['Public Preview Release Wave'] || null,
    availabilityDate,
    availabilityDateFull,
    firstAvailableDate,
    lastUpdatedDate: lastUpdated,
    enabledFor: raw['Enabled for'] ? normalizeText(raw['Enabled for']) : null,
    geographyHtml: raw['GeographicAreasDetails'] ?? null,
    language,
    sourceUrl,
    availabilityTypes: buildAvailabilityTypes(raw)
  };
};

const diffRecord = (current: Record<string, unknown>, next: Record<string, unknown>) => {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  Object.keys(next).forEach((key) => {
    if (current[key] !== next[key]) {
      diff[key] = { before: current[key], after: next[key] };
    }
  });
  return diff;
};

const fetchSnapshotIndex = async (): Promise<Map<string, { snapshotId: string; learnUrl: string | null }>> => {
  const headers = {
    Accept: 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0'
  };
  let nextUrl: string | undefined = SNAPSHOT_URL;
  const index = new Map<string, { snapshotId: string; learnUrl: string | null }>();

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers });
    if (!response.ok) {
      throw new Error(`Snapshot API error: ${response.status}`);
    }
    const payload = (await response.json()) as {
      value: Array<{
        mssh_releaseplansnapshotid: string;
        mssh_featurename?: string;
        _mssh_releaseplan_value?: string;
        mssh_docsurl?: string;
        mssh_articlepath?: string;
      }>;
      ['@odata.nextLink']?: string;
    };
    payload.value.forEach((row) => {
      if (!row._mssh_releaseplan_value || !row.mssh_featurename) {
        return;
      }
      const key = buildSnapshotKey(row._mssh_releaseplan_value, row.mssh_featurename);
      if (!index.has(key)) {
        const learnUrl = normalizeDocUrl(row.mssh_docsurl ?? row.mssh_articlepath ?? null);
        index.set(key, { snapshotId: row.mssh_releaseplansnapshotid, learnUrl });
      }
    });
    nextUrl = payload['@odata.nextLink'];
  }

  return index;
};

const fetchPayload = async (etag: string | null): Promise<{ text: string; etag: string | null }> => {
  const headers: Record<string, string> = {
    'User-Agent': 'UpdateLens/1.0 (+releaseplans ingest)'
  };
  if (etag) {
    headers['If-None-Match'] = etag;
  }
  const response = await fetch(SOURCE_URL, { headers });
  if (response.status === 304) {
    return { text: '', etag: etag ?? null };
  }
  if (!response.ok) {
    throw new Error(`Releaseplans fetch failed: ${response.status}`);
  }
  const text = await response.text();
  return { text, etag: response.headers.get('etag') };
};

const run = async (): Promise<void> => {
  const db = createDb();
  const lastSnapshot = db
    .prepare(
      `SELECT etag, hash FROM release_plan_snapshots WHERE language = ? ORDER BY snapshot_id DESC LIMIT 1`
    )
    .get(LANGUAGE) as { etag?: string; hash?: string } | undefined;

  const { text, etag } = await fetchPayload(lastSnapshot?.etag ?? null);
  if (!text) {
    console.log('[Ingest] No changes (ETag match).');
    return;
  }

  const hash = crypto.createHash('sha256').update(text).digest('hex');
  if (hash && lastSnapshot?.hash === hash) {
    console.log('[Ingest] Payload unchanged (hash match).');
    return;
  }

  const payload = JSON.parse(text) as RawMicrosoftResponse;
  if (!payload.results || !Array.isArray(payload.results)) {
    throw new Error('Unexpected payload shape: missing results');
  }

  const snapshotIndex = await fetchSnapshotIndex();
  const now = new Date().toISOString();
  const snapshotStmt = db.prepare(
    `INSERT INTO release_plan_snapshots (fetched_at, language, etag, hash, raw_payload, schema_version)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const snapshotInfo = snapshotStmt.run(
    now,
    LANGUAGE,
    etag,
    hash,
    text,
    SCHEMA_VERSION
  );
  const snapshotId = Number(snapshotInfo.lastInsertRowid);

  const selectItem = db.prepare(
    `SELECT * FROM release_plan_items WHERE source_plan_id = ? AND language = ?`
  );
  const upsertItem = db.prepare(
    `INSERT INTO release_plan_items (
        source_plan_id, release_plan_id, learn_url, app_name, product_name, feature_name, summary, investment_area, status, wave,
        availability_date, availability_date_full, first_available_date, last_updated_date, enabled_for,
        geography_html, language, source_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_plan_id, language) DO UPDATE SET
        release_plan_id = excluded.release_plan_id,
        learn_url = excluded.learn_url,
        app_name = excluded.app_name,
        product_name = excluded.product_name,
        feature_name = excluded.feature_name,
        summary = excluded.summary,
        investment_area = excluded.investment_area,
        status = excluded.status,
        wave = excluded.wave,
        availability_date = excluded.availability_date,
        availability_date_full = excluded.availability_date_full,
        first_available_date = excluded.first_available_date,
        last_updated_date = excluded.last_updated_date,
        enabled_for = excluded.enabled_for,
        geography_html = excluded.geography_html,
        source_url = excluded.source_url,
        updated_at = excluded.updated_at`
  );
  const insertHistory = db.prepare(
    `INSERT INTO release_plan_history (item_id, snapshot_id, change_type, diff, changed_at)
     VALUES (?, ?, ?, ?, ?)`
  );

  const deleteAvailability = db.prepare(
    `DELETE FROM release_plan_availability_types WHERE item_id = ?`
  );
  const insertAvailability = db.prepare(
    `INSERT INTO release_plan_availability_types (item_id, type) VALUES (?, ?)`
  );

  let inserted = 0;
  let updated = 0;

  const transaction = db.transaction((items: RawMicrosoftItem[]) => {
    items.forEach((raw) => {
      const normalized = normalizeItem(raw, LANGUAGE, snapshotIndex);
      if (!normalized) {
        return;
      }

      const existing = selectItem.get(normalized.sourcePlanId, LANGUAGE) as
        | Record<string, unknown>
        | undefined;
      const nowLocal = new Date().toISOString();
      const createdAt = existing?.created_at ? String(existing.created_at) : nowLocal;

      const info = upsertItem.run(
        normalized.sourcePlanId,
        normalized.releasePlanId,
        normalized.learnUrl,
        normalized.appName,
        normalized.productName,
        normalized.featureName,
        normalized.summary,
        normalized.investmentArea,
        normalized.status,
        normalized.wave,
        normalized.availabilityDate,
        normalized.availabilityDateFull,
        normalized.firstAvailableDate,
        normalized.lastUpdatedDate,
        normalized.enabledFor,
        normalized.geographyHtml,
        normalized.language,
        normalized.sourceUrl,
        createdAt,
        nowLocal
      );

      const itemId = Number(info.lastInsertRowid);
      if (!existing) {
        inserted += 1;
        insertHistory.run(
          itemId,
          snapshotId,
          'insert',
          JSON.stringify({}),
          nowLocal
        );
      } else {
        const diff = diffRecord(existing, {
          release_plan_id: normalized.releasePlanId,
          learn_url: normalized.learnUrl,
          app_name: normalized.appName,
          product_name: normalized.productName,
          feature_name: normalized.featureName,
          summary: normalized.summary,
          investment_area: normalized.investmentArea,
          status: normalized.status,
          wave: normalized.wave,
          availability_date: normalized.availabilityDate,
          availability_date_full: normalized.availabilityDateFull,
          first_available_date: normalized.firstAvailableDate,
          last_updated_date: normalized.lastUpdatedDate,
          enabled_for: normalized.enabledFor,
          geography_html: normalized.geographyHtml,
          source_url: normalized.sourceUrl
        });
        if (Object.keys(diff).length > 0) {
          updated += 1;
          insertHistory.run(
            Number(existing.id),
            snapshotId,
            'update',
            JSON.stringify(diff),
            nowLocal
          );
        }
      }

      const effectiveItemId = existing ? Number(existing.id) : itemId;
      deleteAvailability.run(effectiveItemId);
      normalized.availabilityTypes.forEach((type) => {
        insertAvailability.run(effectiveItemId, type);
      });
    });
  });

  transaction(payload.results);
  console.log(
    `[Ingest] Snapshot ${snapshotId} stored. inserted=${inserted} updated=${updated}`
  );
};

run().catch((error) => {
  console.error('[Ingest] Error:', error);
  process.exitCode = 1;
});
