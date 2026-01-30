import { uploadSnapshot, updateManifest } from '../shared/blobStorage.js';
import {
  todayStamp,
  monthStamp,
  slugify,
  normalizeText,
  isValidHttpUrl
} from '../shared/utils.js';
import type { M365RoadmapReleaseItem, Snapshot, RefreshResult } from '../shared/types.js';

const SOURCE_URL = 'https://www.microsoft.com/releasecommunications/api/v1/m365';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

type RawM365RoadmapItem = {
  id: number;
  title: string;
  description: string;
  status: string;
  publicDisclosureAvailabilityDate: string; // "Month CYYYYY"
  publicPreviewDate: string;
  created: string; // ISO 8601
  modified: string; // ISO 8601
  moreInfoLink: string | null;
  locale: string | null;
  tags: string[];
  tagsContainer: {
    products: Array<{ tagId: number; tagName: string }>;
    cloudInstances: Array<{ tagId: number; tagName: string }>;
    platforms: Array<{ tagId: number; tagName: string }>;
    releasePhase: Array<{ tagId: number; tagName: string }>;
  };
  publicRoadmapStatus: string;
};

// Month name to number mapping
const MONTH_MAP: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12'
};

/**
 * Parse M365-specific date format "Month CYYYYY" (e.g. "February CY2026")
 */
const parseM365Date = (dateStr: string): string => {
  if (!dateStr) return monthStamp();

  const match = dateStr.match(/^(\w+)\s+CY(\d{4})$/i);
  if (!match) {
    console.warn(`[RefreshM365Roadmap] Unexpected date format: "${dateStr}", using current month`);
    return monthStamp();
  }

  const monthName = match[1].toLowerCase();
  const year = match[2];
  const month = MONTH_MAP[monthName];

  if (!month) {
    console.warn(`[RefreshM365Roadmap] Unknown month name: "${monthName}", using current month`);
    return monthStamp();
  }

  return `${year}-${month}`;
};

/**
 * Parse ISO 8601 date string to YYYY-MM-DD format
 */
const parseDateFull = (isoDate: string): string | undefined => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}T/.test(isoDate)) return undefined;
  return isoDate.slice(0, 10);
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'UpdateLens/1.0 (+M365 Roadmap snapshot)',
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.warn(
        `[RefreshM365Roadmap] Attempt ${attempt}/${retries} failed:`,
        error instanceof Error ? error.message : error
      );

      if (attempt === retries) throw error;
      await sleep(RETRY_DELAY * attempt);
    }
  }

  throw new Error('Max retries exceeded');
}

async function fetchAllM365Data(): Promise<RawM365RoadmapItem[]> {
  console.log('[RefreshM365Roadmap] Fetching data from M365 Release Communications API...');

  const response = await fetchWithRetry(SOURCE_URL);
  const items: RawM365RoadmapItem[] = await response.json();

  console.log(`[RefreshM365Roadmap] Fetched ${items.length} raw items`);
  return items;
}

/**
 * Extract all tags from tagsContainer structure
 */
const extractAllTags = (raw: RawM365RoadmapItem): string[] => {
  const tags: string[] = [];
  const tc = raw.tagsContainer;

  tc?.products?.forEach((p) => tags.push(p.tagName));
  tc?.platforms?.forEach((p) => tags.push(p.tagName));
  tc?.cloudInstances?.forEach((c) => tags.push(c.tagName));
  tc?.releasePhase?.forEach((ph) => tags.push(ph.tagName));

  return [...new Set(tags)];
};

function buildStatus(raw: RawM365RoadmapItem): M365RoadmapReleaseItem['status'] {
  const status = raw.status?.trim();

  if (status === 'Launched') return 'Launched';
  if (status === 'Rolling out') return 'Rolling out';
  if (status === 'In development') return 'Planned';

  console.warn(`[RefreshM365Roadmap] Unknown status: "${status}" for item ${raw.id}`);
  return 'Unknown';
}

function buildAvailabilityTypes(raw: RawM365RoadmapItem): string[] {
  const types: string[] = [];
  raw.tagsContainer?.releasePhase?.forEach((phase) => {
    types.push(phase.tagName);
  });
  return types;
}

/**
 * Build a single ReleaseItem from raw data and product name
 */
const buildReleaseItem = (
  raw: RawM365RoadmapItem,
  productName: string
): M365RoadmapReleaseItem => {
  const productSlug = slugify(productName);
  const availabilityDate = parseM365Date(raw.publicDisclosureAvailabilityDate);
  const availabilityDateFull = `${availabilityDate}-01`;
  const featureId = raw.id;

  return {
    id: `m365roadmap-${featureId}-${productSlug}`,
    source: 'MICROSOFT 365',
    productId: `M365ROADMAP:${productSlug}`,
    product: productName,
    productName: productName,
    category: 'Microsoft 365',
    title: normalizeText(raw.title),
    summary: normalizeText(raw.description),
    description: normalizeText(raw.description),
    status: buildStatus(raw),
    availabilityDate,
    availabilityDateFull,
    releaseDate: availabilityDateFull,
    tryNow: false,
    minBcVersion: null,
    availabilityTypes: buildAvailabilityTypes(raw),
    tags: extractAllTags(raw),
    firstAvailableDate: parseDateFull(raw.created),
    lastUpdatedDate: parseDateFull(raw.modified),
    sourceUrl: `https://www.microsoft.com/microsoft-365/roadmap?featureid=${featureId}&searchterms=${featureId}`,
    learnUrl: raw.moreInfoLink && isValidHttpUrl(raw.moreInfoLink) ? raw.moreInfoLink : undefined,
    url: `https://www.microsoft.com/microsoft-365/roadmap?featureid=${featureId}&searchterms=${featureId}`
  };
};

/**
 * Extract and transform items with multi-product duplication
 */
function extractItems(rawItems: RawM365RoadmapItem[]): M365RoadmapReleaseItem[] {
  const validItems: M365RoadmapReleaseItem[] = [];
  const skippedIds: string[] = [];

  console.log('[RefreshM365Roadmap] Transforming items with multi-product duplication...');

  rawItems.forEach((raw) => {
    try {
      if (!raw.id || !raw.title) {
        skippedIds.push(String(raw.id ?? 'unknown'));
        return;
      }

      const products = raw.tagsContainer?.products ?? [];

      if (products.length === 0) {
        console.warn(
          `[RefreshM365Roadmap] No products found for item ${raw.id}, using fallback "Microsoft 365"`
        );
        const item = buildReleaseItem(raw, 'Microsoft 365');
        validItems.push(item);
      } else {
        products.forEach((productTag) => {
          const productName = normalizeText(productTag.tagName);
          const item = buildReleaseItem(raw, productName);
          validItems.push(item);
        });
      }
    } catch (error) {
      console.warn(
        `[RefreshM365Roadmap] Skipped invalid item ${raw.id}:`,
        error instanceof Error ? error.message : error
      );
      skippedIds.push(String(raw.id));
    }
  });

  if (skippedIds.length > 0) {
    console.warn(
      `[RefreshM365Roadmap] Skipped ${skippedIds.length} invalid items:`,
      skippedIds.slice(0, 10)
    );
  }

  console.log(
    `[RefreshM365Roadmap] Transformed ${rawItems.length} raw items into ${validItems.length} release items`
  );

  return validItems;
}

export const refreshM365Roadmap = async (): Promise<RefreshResult> => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const rawItems = await fetchAllM365Data();
    const items = extractItems(rawItems);

    if (items.length === 0) {
      throw new Error('No valid items extracted from M365 Release Communications API');
    }

    const snapshot: Snapshot<M365RoadmapReleaseItem> = {
      version: 1,
      items
    };

    const filename = `m365roadmap_data_${todayStamp()}.json`;

    console.log(`[RefreshM365Roadmap] Uploading snapshot: ${filename}`);
    await uploadSnapshot('m365roadmap', filename, snapshot);

    console.log('[RefreshM365Roadmap] Updating manifest...');
    await updateManifest({ m365roadmap: filename });

    const duration = Date.now() - startTime;
    console.log(`[RefreshM365Roadmap] Completed: ${items.length} items in ${duration}ms`);
    console.log(`[RefreshM365Roadmap] Raw items: ${rawItems.length}, Duplication factor: ${(items.length / rawItems.length).toFixed(2)}x`);

    return {
      source: 'm365roadmap',
      status: 'ok',
      itemCount: items.length,
      duration,
      timestamp,
      filename
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[RefreshM365Roadmap] Error: ${errorMessage}`);

    return {
      source: 'm365roadmap',
      status: 'failed',
      itemCount: null,
      duration,
      timestamp,
      error: errorMessage
    };
  }
};
