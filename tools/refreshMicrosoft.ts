import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { extractCountriesFromHtmlNode } from './geographyNode';
import {
  buildReleasePlansUrl,
  encodeApp,
  isValidGuid,
  resolveAppNameFromProduct
} from '../src/utils/releaseplans';

const SOURCE_URL = 'https://releaseplans.microsoft.com/it-it/allreleaseplans/';
const SNAPSHOT_URL =
  'https://releaseplans.microsoft.com/_api/mssh_releaseplansnapshots?$select=mssh_releaseplansnapshotid,mssh_featurename,_mssh_releaseplan_value,mssh_docsurl,mssh_articlepath&$filter=statecode eq 0';

const resolveAppName = (product: string): string | null =>
  resolveAppNameFromProduct(product);

const buildPublicUrl = (product: string): string => {
  const appName = resolveAppName(product);
  if (!appName) {
    return 'https://releaseplans.microsoft.com/';
  }
  return `https://releaseplans.microsoft.com/?app=${encodeApp(appName)}`;
};

const buildSourceUrl = (product: string, planId?: string): string | null => {
  const appName = resolveAppName(product);
  if (!planId || !appName || !isValidGuid(planId)) {
    return null;
  }
  return buildReleasePlansUrl(appName, planId);
};

type ReleaseItem = {
  id: string;
  source: 'Microsoft';
  productId?: string;
  releasePlanId?: string | null;
  product: string;
  category?: string;
  wave?: string;
  availabilityTypes?: string[];
  enabledFor?: string;
  geography?: string;
  geographyCountries?: string[];
  title: string;
  summary: string;
  status: 'Planned' | 'Rolling out' | 'Try now' | 'Launched' | 'Unknown';
  availabilityDate: string;
  availabilityDateFull?: string;
  firstAvailableDate?: string;
  lastUpdatedDate?: string;
  sourcePlanId?: string | null;
  sourceAppName?: string | null;
  sourceUrl?: string | null;
  learnUrl?: string | null;
  url: string;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

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
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned;
};

const stripHtml = (value: string): string => {
  const $ = cheerio.load(value);
  return normalizeText($.text());
};

const parseDate = (value: string): string | null => {
  const cleaned = normalizeText(value);
  if (!cleaned) {
    return null;
  }
  const fullMatch = cleaned.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (fullMatch) {
    const first = Number(fullMatch[1]);
    const second = Number(fullMatch[2]);
    const year = fullMatch[3];
    let month: number;

    if (first > 12 && second <= 12) {
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
    } else {
      month = first;
    }

    const monthText = String(month).padStart(2, '0');
    return `${year}-${monthText}`;
  }
  const yearMatch = cleaned.match(/(20\d{2})[-/](\d{1,2})/);
  if (yearMatch) {
    const year = yearMatch[1];
    const month = String(Number(yearMatch[2])).padStart(2, '0');
    return `${year}-${month}`;
  }
  return null;
};

const parseDateFull = (value: string): string | null => {
  const cleaned = normalizeText(value);
  if (!cleaned) {
    return null;
  }
  const fullMatch = cleaned.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (fullMatch) {
    const first = Number(fullMatch[1]);
    const second = Number(fullMatch[2]);
    const year = fullMatch[3];
    let month: number;
    let day: number;

    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      day = second;
      month = first;
    } else {
      month = first;
      day = second;
    }

    const monthText = String(month).padStart(2, '0');
    const dayText = String(day).padStart(2, '0');
    return `${year}-${monthText}-${dayText}`;
  }
  return null;
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

type LatestManifest = {
  microsoft?: string;
  eos?: string;
};

const readManifest = async (filePath: string): Promise<LatestManifest> => {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as LatestManifest;
  } catch {
    return {};
  }
};

const writeManifest = async (filePath: string, updates: LatestManifest): Promise<void> => {
  const current = await readManifest(filePath);
  const next = { ...current, ...updates };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2), 'utf-8');
};

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

const buildStatus = (raw: RawMicrosoftItem): ReleaseItem['status'] => {
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

const extractItems = (
  payload: RawMicrosoftResponse,
  snapshotIndex: Map<string, { snapshotId: string; learnUrl: string | null }>
): ReleaseItem[] => {
  const items: ReleaseItem[] = [];
  const seen = new Set<string>();

  payload.results.forEach((raw) => {
    const product = normalizeText(raw['Product name'] ?? '');
    const title = normalizeText(raw['Feature name'] ?? '');
    if (!product || !title) {
      return;
    }
    const idBase = raw['Release Plan ID']
      ? `ms-${raw['Release Plan ID']}`
      : `ms-${slugify(`${product}-${title}`)}`;
    if (seen.has(idBase)) {
      return;
    }
    seen.add(idBase);

    const summaryRaw = raw['Business value'] ?? '';
    const summary = stripHtml(summaryRaw) || 'Dettaglio disponibile nel link ufficiale.';
    const gaMonth = parseDate(raw['GA date'] ?? '');
    const publicMonth = parseDate(raw['Public preview date'] ?? '');
    const earlyMonth = parseDate(raw['Early access date'] ?? '');
    const availability = gaMonth || publicMonth || earlyMonth || monthStamp();
    const gaFull = parseDateFull(raw['GA date'] ?? '');
    const publicFull = parseDateFull(raw['Public preview date'] ?? '');
    const earlyFull = parseDateFull(raw['Early access date'] ?? '');
    const firstAvailableDate = earlyFull || publicFull || gaFull || null;
    const availabilityDateFull = gaFull || publicFull || earlyFull || null;
    const lastUpdated = parseDateFull(raw['Last Gitcommit date'] ?? '');

    const geographyRaw = raw['GeographicAreasDetails'] ?? '';
    const geographyCountries = geographyRaw
      ? extractCountriesFromHtmlNode(geographyRaw)
      : undefined;

    const releasePlanId = raw['Release Plan ID'] ?? null;
    const snapshotKey =
      releasePlanId && title ? buildSnapshotKey(releasePlanId, title) : null;
    const snapshotEntry = snapshotKey ? snapshotIndex.get(snapshotKey) ?? null : null;
    const snapshotId = snapshotEntry?.snapshotId ?? null;
    if (!snapshotId && releasePlanId) {
      console.warn(
        `[UpdateLens] Snapshot ID mancante per ${title} (${releasePlanId})`
      );
    }
    const sourcePlanId = snapshotId ?? releasePlanId;
    const learnUrl = snapshotEntry?.learnUrl ?? null;
    const sourceAppName = resolveAppName(product);
    const sourceUrl = buildSourceUrl(product, sourcePlanId ?? undefined);
    items.push({
      id: idBase,
      productId: raw['ProductId'],
      releasePlanId,
      sourcePlanId,
      sourceAppName,
      source: 'Microsoft',
      product,
      category: raw['Investment area'] ? normalizeText(raw['Investment area'] ?? '') : undefined,
      wave: raw['GA Release Wave'] || raw['Public Preview Release Wave'],
      availabilityTypes: buildAvailabilityTypes(raw),
      enabledFor: raw['Enabled for'] ? normalizeText(raw['Enabled for'] ?? '') : undefined,
      geography: geographyRaw ? normalizeText(geographyRaw) : undefined,
      geographyCountries,
      title,
      summary,
      status: buildStatus(raw),
      availabilityDate: availability,
      availabilityDateFull,
      firstAvailableDate,
      lastUpdatedDate: lastUpdated,
      sourceUrl,
      learnUrl,
      url: sourceUrl ?? buildPublicUrl(product)
    });
  });

  return items;
};

const run = async (): Promise<void> => {
  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'UpdateLens/1.0 (+offline snapshot generator)'
    }
  });
  if (!response.ok) {
    throw new Error(`Release plans fetch error: ${response.status}`);
  }
  const rawText = await response.text();
  const payload = JSON.parse(rawText) as RawMicrosoftResponse;
  const snapshotIndex = await fetchSnapshotIndex();
  const items = extractItems(payload, snapshotIndex);

  const snapshot = {
    version: 1,
    items
  };

  const filename = `microsoft_releaseplans_${todayStamp()}.json`;
  const outputPath = path.resolve('src', 'data', 'snapshots', filename);
  const publicPath = path.resolve('public', 'data', filename);
  await mkdir(path.dirname(publicPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  await writeFile(publicPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  await writeManifest(path.resolve('public', 'data', 'latest.json'), {
    microsoft: filename
  });
  await writeManifest(path.resolve('src', 'data', 'snapshots', 'latest.json'), {
    microsoft: filename
  });
  console.log(`Snapshot Microsoft salvata: ${outputPath} (${items.length} items)`);
};

run().catch((error) => {
  console.error('Errore refresh Microsoft:', error);
  process.exitCode = 1;
});
