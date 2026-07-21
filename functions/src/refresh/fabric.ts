import { uploadSnapshot, updateManifest } from '../shared/blobStorage.js';
import { todayStamp, monthStamp, normalizeText, parseDateFull } from '../shared/utils.js';
import type { FabricReleaseItem, Snapshot, RefreshResult } from '../shared/types.js';

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

const parseMonthDate = (dateStr: string): string => {
  const fullDate = parseFabricDateFull(dateStr);
  if (!fullDate) return monthStamp();
  const [year, month] = fullDate.split('-');
  return `${year}-${month}`;
};

const parseFabricDateFull = (dateStr: string): string | null => {
  const match = dateStr?.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
  return match?.[1] ?? null;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
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

      await sleep(RETRY_DELAY * attempt);
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

  console.log(`[RefreshFabric] Fetched ${allItems.length} items across ${page - 1} pages`);
  return allItems;
}

function buildStatus(raw: RawFabricItem): FabricReleaseItem['status'] {
  if (raw.release_type === 'Public preview') return 'Try now';
  if (raw.release_status === 'Shipped') return 'Launched';
  if (raw.release_status === 'Planned') return 'Planned';

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

function extractItems(rawItems: RawFabricItem[]): FabricReleaseItem[] {
  const validItems: FabricReleaseItem[] = [];
  const skippedIds: string[] = [];

  rawItems.forEach((raw) => {
    try {
      if (!raw.release_item_id || !raw.feature_name) {
        skippedIds.push(raw.release_item_id ?? 'unknown');
        return;
      }

      const availabilityDate = parseMonthDate(raw.release_date);
      const availabilityDateFull = parseFabricDateFull(raw.release_date);
      const releaseDate = availabilityDateFull ?? `${availabilityDate}-01`;

      const releasePage = `https://www.fabric-gps.com/release/${raw.release_item_id}`;
      const blogUrl = raw.blog_url ?? null;

      const item: FabricReleaseItem = {
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
        availabilityDateFull: availabilityDateFull ?? undefined,
        releaseDate,
        tryNow: buildStatus(raw) === 'Try now',
        minBcVersion: null,
        availabilityTypes: buildAvailabilityTypes(raw),
        firstAvailableDate: availabilityDateFull ?? undefined,
        lastUpdatedDate: parseFabricDateFull(raw.last_modified) ?? undefined,
        sourceUrl: releasePage,
        learnUrl: null,
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

export const refreshFabric = async (): Promise<RefreshResult> => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const rawItems = await fetchAllReleases();
    const items = extractItems(rawItems);

    if (items.length === 0) {
      throw new Error('No valid items extracted from Fabric GPS API');
    }

    const snapshot: Snapshot<FabricReleaseItem> = {
      version: 1,
      items
    };

    const filename = `fabric_roadmap_${todayStamp()}.json`;

    console.log(`[RefreshFabric] Uploading snapshot: ${filename}`);
    await uploadSnapshot('fabric', filename, snapshot);

    console.log('[RefreshFabric] Updating manifest...');
    await updateManifest({ fabric: filename });

    const duration = Date.now() - startTime;
    console.log(`[RefreshFabric] Completed: ${items.length} items in ${duration}ms`);

    return {
      source: 'fabric',
      status: 'ok',
      itemCount: items.length,
      duration,
      timestamp,
      filename
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[RefreshFabric] Error: ${errorMessage}`);

    return {
      source: 'fabric',
      status: 'failed',
      itemCount: null,
      duration,
      timestamp,
      error: errorMessage
    };
  }
};
