import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = 'https://www.microsoft.com/releasecommunications/api/v1/m365';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

type RawM365RoadmapItem = {
  id: number;
  title: string;
  description: string;
  status: string;
  publicDisclosureAvailabilityDate: string; // "Month CYYYYY"
  publicPreviewDate: string; // Sempre vuoto
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

type ReleaseItem = {
  id: string;
  source: 'MICROSOFT 365';
  productId: string;
  product: string;
  productName: string;
  category: string;
  title: string;
  summary: string;
  description: string;
  status: 'Planned' | 'Rolling out' | 'Launched' | 'Unknown';
  availabilityDate: string;
  availabilityDateFull?: string;
  releaseDate: string;
  tryNow: boolean;
  minBcVersion: null;
  availabilityTypes?: string[];
  tags?: string[];
  firstAvailableDate?: string;
  lastUpdatedDate?: string;
  sourceUrl: string;
  learnUrl?: string | null;
  url: string;
};

type LatestManifest = {
  microsoft?: string;
  eos?: string;
  fabric?: string;
  m365roadmap?: string;
};

// ============================================================================
// UTILITY FUNCTIONS - Date & Time
// ============================================================================

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
 * Returns YYYY-MM format
 */
const parseM365Date = (dateStr: string): string => {
  if (!dateStr) return monthStamp();

  // Match "February CY2026" format
  const match = dateStr.match(/^(\w+)\s+CY(\d{4})$/i);
  if (!match) {
    console.warn(
      `[RefreshM365Roadmap] Unexpected date format: "${dateStr}", using current month`
    );
    return monthStamp();
  }

  const monthName = match[1].toLowerCase();
  const year = match[2];
  const month = MONTH_MAP[monthName];

  if (!month) {
    console.warn(
      `[RefreshM365Roadmap] Unknown month name: "${monthName}", using current month`
    );
    return monthStamp();
  }

  return `${year}-${month}`;
};

/**
 * Parse ISO 8601 date string to YYYY-MM-DD format
 */
const parseDateFull = (isoDate: string): string | null => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}T/.test(isoDate)) return null;
  return isoDate.slice(0, 10);
};

// ============================================================================
// UTILITY FUNCTIONS - Text Processing
// ============================================================================

const normalizeText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const isValidHttpUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// ============================================================================
// UTILITY FUNCTIONS - Tags Extraction
// ============================================================================

/**
 * Extract all tags from tagsContainer structure
 */
const extractAllTags = (raw: RawM365RoadmapItem): string[] => {
  const tags: string[] = [];
  const tc = raw.tagsContainer;

  // Products (all products, including the main one)
  tc?.products?.forEach((p) => tags.push(p.tagName));

  // Platforms
  tc?.platforms?.forEach((p) => tags.push(p.tagName));

  // Cloud instances
  tc?.cloudInstances?.forEach((c) => tags.push(c.tagName));

  // Release phase
  tc?.releasePhase?.forEach((ph) => tags.push(ph.tagName));

  // Deduplicate
  return [...new Set(tags)];
};

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES
): Promise<Response> {
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

      if (attempt === retries) {
        throw error;
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * attempt));
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

// ============================================================================
// STATUS & AVAILABILITY MAPPING
// ============================================================================

function buildStatus(raw: RawM365RoadmapItem): ReleaseItem['status'] {
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

// ============================================================================
// ITEM BUILDING & EXTRACTION
// ============================================================================

/**
 * Build a single ReleaseItem from raw data and product name
 */
const buildReleaseItem = (
  raw: RawM365RoadmapItem,
  productName: string
): ReleaseItem => {
  const productSlug = slugify(productName);
  const availabilityDate = parseM365Date(raw.publicDisclosureAvailabilityDate);
  const availabilityDateFull = `${availabilityDate}-01`; // Default to first of month
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
    tryNow: false, // M365 roadmap doesn't have public preview concept
    minBcVersion: null,
    availabilityTypes: buildAvailabilityTypes(raw),
    tags: extractAllTags(raw),
    firstAvailableDate: parseDateFull(raw.created),
    lastUpdatedDate: parseDateFull(raw.modified),
    sourceUrl: `https://www.microsoft.com/microsoft-365/roadmap?featureid=${featureId}`,
    learnUrl:
      raw.moreInfoLink && isValidHttpUrl(raw.moreInfoLink)
        ? raw.moreInfoLink
        : null,
    url: `https://www.microsoft.com/microsoft-365/roadmap?featureid=${featureId}`
  };
};

/**
 * Extract and transform items with multi-product duplication
 */
function extractItems(rawItems: RawM365RoadmapItem[]): ReleaseItem[] {
  const validItems: ReleaseItem[] = [];
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
        // Fallback: create item with generic product
        console.warn(
          `[RefreshM365Roadmap] No products found for item ${raw.id}, using fallback "Microsoft 365"`
        );
        const item = buildReleaseItem(raw, 'Microsoft 365');
        validItems.push(item);
      } else {
        // Create one ReleaseItem per product (multi-product duplication)
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

// ============================================================================
// MANIFEST MANAGEMENT
// ============================================================================

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

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function run(): Promise<void> {
  try {
    // 1. Fetch raw data from API
    const rawItems = await fetchAllM365Data();

    // 2. Transform and extract items
    const items = extractItems(rawItems);

    if (items.length === 0) {
      throw new Error('No valid items extracted from M365 Release Communications API');
    }

    // 3. Create snapshot
    const snapshot = {
      version: 1,
      items
    };

    const filename = `m365roadmap_data_${todayStamp()}.json`;

    // 4. Write snapshot to both locations
    const snapshotsPath = path.resolve('src', 'data', 'snapshots', filename);
    const publicPath = path.resolve('public', 'data', filename);

    await mkdir(path.dirname(snapshotsPath), { recursive: true });
    await mkdir(path.dirname(publicPath), { recursive: true });

    const content = JSON.stringify(snapshot, null, 2);
    await writeFile(snapshotsPath, content, 'utf-8');
    await writeFile(publicPath, content, 'utf-8');

    // 5. Update manifest files (merge-safe)
    await writeManifest(path.resolve('public', 'data', 'latest.json'), {
      m365roadmap: filename
    });
    await writeManifest(
      path.resolve('src', 'data', 'snapshots', 'latest.json'),
      { m365roadmap: filename }
    );

    // 6. Success log
    console.log(`[RefreshM365Roadmap] ✓ Snapshot saved: ${snapshotsPath}`);
    console.log(`[RefreshM365Roadmap] ✓ Total items: ${items.length}`);
    console.log(`[RefreshM365Roadmap] ✓ Raw items fetched: ${rawItems.length}`);
    console.log(
      `[RefreshM365Roadmap] ✓ Duplication factor: ${(items.length / rawItems.length).toFixed(2)}x`
    );
    console.log(`[RefreshM365Roadmap] ✓ Manifest updated`);
  } catch (error) {
    console.error(
      '[RefreshM365Roadmap] ✗ Error:',
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  }
}

run();
