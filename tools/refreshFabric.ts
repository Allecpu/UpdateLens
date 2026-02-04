import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { LearnMeta } from '../src/utils/learn';
import { enrichReleaseItemsWithLearn } from './learnEnrichment';

const SOURCE_URL = 'https://fabric-gps.com/api/releases';
const PAGE_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

type RawFabricItem = {
  release_item_id: string;
  product_id: string;
  product_name: string;
  feature_name: string;
  feature_description: string;
  release_status: 'Planned' | 'Shipped';
  release_type: 'Public preview' | 'General availability';
  release_date: string;
  last_modified: string;
  blog_url?: string;
  blog_title?: string;
};

type RawFabricResponse = {
  data: RawFabricItem[];
  pagination: {
    page: number;
    total_pages: number;
    has_next: boolean;
    next_page?: number;
  };
};

type ReleaseItem = {
  id: string;
  source: 'Fabric';
  productId: string;
  product: string;
  productName: string;
  category: string;
  title: string;
  summary: string;
  description: string;
  status: 'Planned' | 'Try now' | 'Launched' | 'Unknown';
  availabilityDate: string;
  availabilityDateFull?: string;
  releaseDate: string;
  tryNow: boolean;
  minBcVersion: null;
  availabilityTypes?: string[];
  firstAvailableDate?: string;
  lastUpdatedDate?: string;
  sourceUrl: string;
  learnUrl?: string | null;
  docsUrl?: string | null;
  learnMeta?: LearnMeta | null;
  url: string;
};

type LatestManifest = {
  microsoft?: string;
  eos?: string;
  fabric?: string;
};

const todayStamp = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}_${month}_${day}`;
};

const monthStamp = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const normalizeText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const parseMonthDate = (dateStr: string): string => {
  if (!dateStr) return monthStamp();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return monthStamp();
  }

  const [year, month] = dateStr.split('-');
  return `${year}-${month}`;
};

const parseDateFull = (dateStr: string): string | null => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return dateStr;
};

async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'UpdateLens/1.0 (+Fabric roadmap snapshot)',
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.warn(
        `[RefreshFabric] Attempt ${attempt}/${retries} failed:`,
        error instanceof Error ? error.message : error
      );

      if (attempt === retries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * attempt));
    }
  }

  throw new Error('Max retries exceeded');
}

async function fetchAllReleases(): Promise<RawFabricItem[]> {
  const allItems: RawFabricItem[] = [];
  let page = 1;
  let hasMore = true;

  console.log('[RefreshFabric] Fetching data from Fabric GPS...');

  while (hasMore) {
    console.log(`[RefreshFabric] Fetching page ${page}...`);

    const url = `${SOURCE_URL}?page=${page}&page_size=${PAGE_SIZE}`;
    const response = await fetchWithRetry(url);
    const payload: RawFabricResponse = await response.json();

    allItems.push(...payload.data);

    hasMore = payload.pagination.has_next;
    page = payload.pagination.next_page ?? page + 1;

    if (page > 100) {
      console.warn('[RefreshFabric] Max pages limit (100) reached');
      break;
    }
  }

  console.log(
    `[RefreshFabric] Fetched ${allItems.length} items across ${page - 1} pages`
  );
  return allItems;
}

function buildStatus(raw: RawFabricItem): ReleaseItem['status'] {
  if (raw.release_type === 'Public preview') {
    return 'Try now';
  }

  if (raw.release_status === 'Shipped') {
    return 'Launched';
  }

  if (raw.release_status === 'Planned') {
    return 'Planned';
  }

  console.warn(
    `[RefreshFabric] Unknown status combination for ${raw.release_item_id}:`,
    { status: raw.release_status, type: raw.release_type }
  );

  return 'Unknown';
}

function buildAvailabilityTypes(raw: RawFabricItem): string[] {
  const types: string[] = [];

  if (raw.release_type === 'Public preview') {
    types.push('Public Preview');
  }

  if (raw.release_type === 'General availability' || raw.release_status === 'Shipped') {
    types.push('GA');
  }

  return types;
}

function extractItems(rawItems: RawFabricItem[]): ReleaseItem[] {
  const validItems: ReleaseItem[] = [];
  const skippedIds: string[] = [];

  rawItems.forEach((raw) => {
    try {
      if (!raw.release_item_id || !raw.feature_name) {
        skippedIds.push(raw.release_item_id ?? 'unknown');
        return;
      }

      const availabilityDate = parseMonthDate(raw.release_date);
      const availabilityDateFull = parseDateFull(raw.release_date);
      const releaseDate =
        availabilityDateFull ?? `${availabilityDate}-01`;

      const releasePage = `https://fabric-gps.com/releases/${raw.release_item_id}`;
      const blogUrl = raw.blog_url ?? null;

      const item: ReleaseItem = {
        id: `fabric-${raw.release_item_id}`,
        source: 'Fabric',
        productId: `FABRIC:${raw.product_id}`,
        product: normalizeText(raw.product_name),
        productName: normalizeText(raw.product_name),
        category: normalizeText(raw.product_name),
        title: normalizeText(raw.feature_name),
        summary: normalizeText(raw.feature_description ?? ''),
        description: normalizeText(raw.feature_description ?? ''),
        status: buildStatus(raw),
        availabilityDate,
        availabilityDateFull,
        releaseDate,
        tryNow: buildStatus(raw) === 'Try now',
        minBcVersion: null,
        availabilityTypes: buildAvailabilityTypes(raw),
        firstAvailableDate: availabilityDateFull,
        lastUpdatedDate: parseDateFull(raw.last_modified),
        sourceUrl: releasePage,
        learnUrl: null,
        docsUrl: null,
        url: blogUrl ?? releasePage
      };

      validItems.push(item);
    } catch (error) {
      console.warn(
        `[RefreshFabric] Skipped invalid item ${raw.release_item_id}:`,
        error instanceof Error ? error.message : error
      );
      skippedIds.push(raw.release_item_id);
    }
  });

  if (skippedIds.length > 0) {
    console.warn(
      `[RefreshFabric] Skipped ${skippedIds.length} invalid items:`,
      skippedIds.slice(0, 10)
    );
  }

  return validItems;
}

const readManifest = async (filePath: string): Promise<LatestManifest> => {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as LatestManifest;
  } catch {
    return {};
  }
};

const writeManifest = async (
  filePath: string,
  updates: Partial<LatestManifest>
): Promise<void> => {
  const current = await readManifest(filePath);
  const next = { ...current, ...updates };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2), 'utf-8');
};

async function run(): Promise<void> {
  try {
    const rawItems = await fetchAllReleases();

    const items = extractItems(rawItems);
    const enrichment = await enrichReleaseItemsWithLearn(items);

    if (enrichment.items.length === 0) {
      throw new Error('No valid items extracted from Fabric GPS API');
    }

    const snapshot = {
      version: 1,
      items: enrichment.items
    };

    const filename = `fabric_roadmap_${todayStamp()}.json`;

    const snapshotsPath = path.resolve('src', 'data', 'snapshots', filename);
    const publicPath = path.resolve('public', 'data', filename);

    await mkdir(path.dirname(snapshotsPath), { recursive: true });
    await mkdir(path.dirname(publicPath), { recursive: true });

    const content = JSON.stringify(snapshot, null, 2);
    await writeFile(snapshotsPath, content, 'utf-8');
    await writeFile(publicPath, content, 'utf-8');

    await writeManifest(path.resolve('public', 'data', 'latest.json'), {
      fabric: filename
    });
    await writeManifest(
      path.resolve('src', 'data', 'snapshots', 'latest.json'),
      { fabric: filename }
    );

    console.log(`[RefreshFabric] ✓ Snapshot saved: ${snapshotsPath}`);
    console.log(`[RefreshFabric] ✓ Total items: ${enrichment.items.length}`);
    console.log(
      `[LearnEnrichment] matched=${enrichment.stats.matched}, skipped=${enrichment.stats.skippedWithLearnUrl}, missingMapping=${enrichment.stats.noProductMapping}`
    );
    console.log(`[RefreshFabric] ✓ Manifest updated`);
  } catch (error) {
    console.error(
      '[RefreshFabric] ✗ Error:',
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  }
}

run();
