import type { ReleaseItem, ReleaseSource } from '../models/ReleaseItem';
import { ReleaseItemSchema } from '../models/ReleaseItem';
import type { ProductsConfig, RulesConfig } from '../models/Config';
import { ProductsConfigSchema, RulesConfigSchema } from '../models/Config';
import { loadCatalog } from './CatalogService';
import { isValidHttpUrl } from '../utils/url';
import {
  buildReleasePlansUrl,
  isReleasePlansUrl,
  isValidGuid,
  resolveAppNameFromProduct
} from '../utils/releaseplans';

import productsConfig from '../data/config/products.catalog.json';
import rulesConfig from '../data/config/rules.json';

export type SnapshotPayload = {
  version: number;
  items: ReleaseItem[];
};

type LatestSnapshots = {
  microsoft?: string;
  eos?: string;
  fabric?: string;
  m365roadmap?: string;
};

type SnapshotManifestKey = keyof LatestSnapshots;

const SOURCE_KEY_TO_RELEASE_SOURCE: Record<SnapshotManifestKey, ReleaseSource> = {
  microsoft: 'Microsoft',
  eos: 'EOS',
  fabric: 'Fabric',
  m365roadmap: 'MICROSOFT 365'
};

export type SnapshotLoadResult = {
  items: ReleaseItem[];
  errors: string[];
};

export type SnapshotLoadWithPreviousResult = SnapshotLoadResult & {
  previousItems: ReleaseItem[];
  previousBaselineSources: ReleaseSource[];
};

const EOS_TITLE_REGEX = /^(.*)\s+\(([^)]+)\)\s*$/;
const EOS_ID_DATE_REGEX = /-(\d{2})-(\d{2})-(\d{2})$/;
const DATA_BASE_URL = 'data';
const LATEST_MANIFEST_URL = `${DATA_BASE_URL}/latest.json`;

const toIsoDateFromMonth = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month] = value.split('-');
  return `${year}-${month}-01`;
};

const toIsoDateFromEosId = (id?: string | null): string | null => {
  if (!id) {
    return null;
  }
  const match = id.match(EOS_ID_DATE_REGEX);
  if (!match) {
    return null;
  }
  const [, day, month, year] = match;
  const fullYear = 2000 + Number(year);
  return `${fullYear}-${month}-${day}`;
};

const getEosAppInfo = (title: string): { name: string; acronym: string } => {
  const trimmed = title.trim();
  const match = trimmed.match(EOS_TITLE_REGEX);
  if (!match) {
    return { name: trimmed || 'EOS App', acronym: 'APP' };
  }
  return { name: match[1].trim(), acronym: match[2].trim() };
};

const toEosProductId = (name: string, acronym: string): string => {
  if (acronym) {
    return `EOS:${acronym.toUpperCase()}`;
  }
  const compact = name.toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return `EOS:${compact || 'APP'}`;
};

const normalizeReleaseDate = (item: ReleaseItem): string => {
  const byFull = item.availabilityDateFull ?? item.firstAvailableDate;
  const fromFull = byFull ? toIsoDateFromMonth(byFull) ?? byFull : null;
  return (
    fromFull ??
    toIsoDateFromMonth(item.availabilityDate) ??
    new Date().toISOString().slice(0, 10)
  );
};

const normalizeEosReleaseDate = (item: ReleaseItem): string => {
  return (
    toIsoDateFromEosId(item.id) ??
    toIsoDateFromMonth(item.availabilityDate) ??
    new Date().toISOString().slice(0, 10)
  );
};

const inferBcMinVersion = (product: string, releaseDate: string): number | null => {
  if (!/business central/i.test(product)) {
    return null;
  }
  const year = Number(releaseDate.slice(0, 4));
  if (!year || year < 2000 || year > 2100) {
    return null;
  }
  return year - 2000;
};

const resolveMicrosoftSourceUrl = (item: ReleaseItem): string | null => {
  const planId = item.sourcePlanId?.trim() ?? '';
  const appName =
    item.sourceAppName?.trim() ?? resolveAppNameFromProduct(item.product);
  if (!planId || !appName || !isValidGuid(planId)) {
    return null;
  }
  const url = buildReleasePlansUrl(appName, planId);
  return isReleasePlansUrl(url) ? url : null;
};

const resolveGenericSourceUrl = (item: ReleaseItem): string | null => {
  const candidate = (item.sourceUrl ?? item.url ?? '').trim();
  if (!candidate || !isValidHttpUrl(candidate)) {
    return null;
  }
  return candidate;
};

const resolveSourceUrl = (item: ReleaseItem): string | null => {
  if (item.source === 'Microsoft') {
    return resolveMicrosoftSourceUrl(item);
  }
  if (item.source === 'Fabric') {
    const candidate = (item.url ?? '').trim();
    if (!candidate || !isValidHttpUrl(candidate)) {
      return null;
    }
    return candidate;
  }
  if (item.source === 'MICROSOFT 365') {
    // Extract feature ID from id (format: m365roadmap-{id}-{productSlug})
    const match = item.id.match(/^m365roadmap-(\d+)-/);
    const featureId = match ? match[1] : item.id.replace('m365roadmap-', '');
    return `https://www.microsoft.com/microsoft-365/roadmap?featureid=${featureId}&searchterms=${featureId}`;
  }
  return resolveGenericSourceUrl(item);
};

const parseSnapshot = (payload: SnapshotPayload): ReleaseItem[] => {
  return payload.items.map((item) => {
    if (item.source === 'EOS') {
      const appInfo = getEosAppInfo(item.title);
      const normalized = {
        ...item,
        productId: toEosProductId(appInfo.name, appInfo.acronym),
        product: appInfo.name,
        productName: appInfo.name,
        description: item.summary,
        releaseDate: normalizeEosReleaseDate(item),
        tryNow: false,
        minBcVersion: item.minBcVersion ?? null
      };
      const parsed = ReleaseItemSchema.parse(normalized);
      return {
        ...parsed,
        sourceUrl: resolveSourceUrl(parsed),
        docsUrl:
          parsed.docsUrl && isValidHttpUrl(parsed.docsUrl)
            ? parsed.docsUrl
            : null,
        learnUrl:
          parsed.learnUrl && isValidHttpUrl(parsed.learnUrl)
            ? parsed.learnUrl
            : null
      };
    }

    if (item.source === 'Fabric') {
      const normalized = {
        ...item,
        availabilityDateFull: item.availabilityDateFull ?? undefined,
        firstAvailableDate: item.firstAvailableDate ?? undefined,
        lastUpdatedDate: item.lastUpdatedDate ?? undefined,
        productName: item.product,
        description: item.summary,
        releaseDate:
          item.availabilityDateFull ??
          toIsoDateFromMonth(item.availabilityDate) ??
          new Date().toISOString().slice(0, 10),
        tryNow: item.status === 'Try now',
        minBcVersion: null
      };
      const parsed = ReleaseItemSchema.parse(normalized);
      return {
        ...parsed,
        sourceUrl: resolveSourceUrl(parsed),
        docsUrl:
          parsed.docsUrl && isValidHttpUrl(parsed.docsUrl)
            ? parsed.docsUrl
            : null,
        learnUrl:
          parsed.learnUrl && isValidHttpUrl(parsed.learnUrl)
            ? parsed.learnUrl
            : null
      };
    }

    if (item.source === 'MICROSOFT 365') {
      const normalized = {
        ...item,
        productName: item.product,
        description: item.summary,
        releaseDate:
          item.availabilityDateFull ??
          toIsoDateFromMonth(item.availabilityDate) ??
          new Date().toISOString().slice(0, 10),
        tryNow: false, // M365 roadmap doesn't have public preview
        minBcVersion: null
      };
      const parsed = ReleaseItemSchema.parse(normalized);
      return {
        ...parsed,
        sourceUrl: resolveSourceUrl(parsed),
        docsUrl:
          parsed.docsUrl && isValidHttpUrl(parsed.docsUrl)
            ? parsed.docsUrl
            : null,
        learnUrl:
          parsed.learnUrl && isValidHttpUrl(parsed.learnUrl)
            ? parsed.learnUrl
            : null
      };
    }

    const normalized = {
      ...item,
      productName: item.product,
      description: item.summary,
      releaseDate: normalizeReleaseDate(item),
      tryNow: item.status === 'Try now',
      minBcVersion: inferBcMinVersion(item.product, normalizeReleaseDate(item))
    };
    const parsed = ReleaseItemSchema.parse(normalized);
    return {
      ...parsed,
      sourceUrl: resolveSourceUrl(parsed),
      docsUrl:
        parsed.docsUrl && isValidHttpUrl(parsed.docsUrl) ? parsed.docsUrl : null,
      learnUrl:
        parsed.learnUrl && isValidHttpUrl(parsed.learnUrl) ? parsed.learnUrl : null
    };
  });
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
};

const loadSnapshotFromUrl = async (filename: string): Promise<SnapshotPayload> => {
  return fetchJson<SnapshotPayload>(`${DATA_BASE_URL}/${filename}`);
};

const loadSnapshotWithFallback = async (
  label: string,
  filename: string | undefined
): Promise<{ items: ReleaseItem[]; error?: string }> => {
  if (!filename) {
    return {
      items: [],
      error: `Snapshot ${label} non disponibile.`
    };
  }
  try {
    const payload = await loadSnapshotFromUrl(filename);
    return { items: parseSnapshot(payload) };
  } catch {
    return { items: [], error: `Snapshot ${label} non valida.` };
  }
};

const SNAPSHOT_FILENAME_REGEX = /^(.*)_(\d{4})_(\d{2})_(\d{2})\.json$/;
const PREVIOUS_LOOKBACK_DAYS = 31;

const extractSnapshotFilenameParts = (
  filename: string
): { prefix: string; date: Date } | null => {
  const match = filename.match(SNAPSHOT_FILENAME_REGEX);
  if (!match) {
    return null;
  }
  const [, prefix, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return { prefix, date };
};

const toSnapshotFilename = (prefix: string, date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${prefix}_${year}_${month}_${day}.json`;
};

const loadPreviousSnapshot = async (
  latestFilename: string | undefined
): Promise<{ items: ReleaseItem[]; found: boolean }> => {
  if (!latestFilename) {
    return { items: [], found: false };
  }

  const parts = extractSnapshotFilenameParts(latestFilename);
  if (!parts) {
    return { items: [], found: false };
  }

  for (let offset = 1; offset <= PREVIOUS_LOOKBACK_DAYS; offset += 1) {
    const candidateDate = new Date(parts.date.getTime());
    candidateDate.setUTCDate(candidateDate.getUTCDate() - offset);
    const candidateFilename = toSnapshotFilename(parts.prefix, candidateDate);
    try {
      const payload = await loadSnapshotFromUrl(candidateFilename);
      return { items: parseSnapshot(payload), found: true };
    } catch {
      // Continue looking backward until the first available snapshot is found.
    }
  }

  return { items: [], found: false };
};

export const loadAllSnapshots = async (): Promise<SnapshotLoadResult> => {
  let manifest: LatestSnapshots | null = null;
  try {
    manifest = await fetchJson<LatestSnapshots>(LATEST_MANIFEST_URL);
  } catch {
    manifest = null;
  }

  const microsoft = await loadSnapshotWithFallback(
    'Microsoft',
    manifest?.microsoft
  );
  const eos = await loadSnapshotWithFallback(
    'EOS',
    manifest?.eos
  );
  const fabric = await loadSnapshotWithFallback(
    'Fabric',
    manifest?.fabric
  );
  const m365roadmap = await loadSnapshotWithFallback(
    'MICROSOFT 365',
    manifest?.m365roadmap
  );
  const items: ReleaseItem[] = [
    ...microsoft.items,
    ...eos.items,
    ...fabric.items,
    ...m365roadmap.items
  ];
  const errors = [microsoft.error, eos.error, fabric.error, m365roadmap.error].filter(
    Boolean
  ) as string[];

  const missingSource = items.filter((item) => !item.sourceUrl);
  if (missingSource.length > 0) {
    console.warn(
      `[UpdateLens] Record senza sourceUrl valido: ${missingSource.length}`,
      missingSource.slice(0, 10).map((item) => ({
        id: item.id,
        source: item.source,
        product: item.product,
        title: item.title,
        sourcePlanId: item.sourcePlanId,
        releasePlanId: item.releasePlanId
      }))
    );
  }

  const mismatchedMicrosoft = items.filter((item) => {
    if (item.source !== 'Microsoft') {
      return false;
    }
    const url = item.sourceUrl ?? '';
    if (url && !isReleasePlansUrl(url)) {
      return true;
    }
    const sourcePlanId = item.sourcePlanId ?? '';
    const expectedApp = resolveAppNameFromProduct(item.product) ?? '';
    if (!url || !sourcePlanId || !expectedApp) {
      return false;
    }
    try {
      const parsed = new URL(url);
      const urlPlanId = parsed.searchParams.get('planID') ?? '';
      const urlApp = parsed.searchParams.get('app') ?? '';
      return urlPlanId !== sourcePlanId || urlApp !== expectedApp;
    } catch {
      return true;
    }
  });
  if (mismatchedMicrosoft.length > 0) {
    console.warn(
      `[UpdateLens] Record Microsoft con sourceUrl non coerente: ${mismatchedMicrosoft.length}`,
      mismatchedMicrosoft.slice(0, 10).map((item) => ({
        id: item.id,
        title: item.title,
        sourcePlanId: item.sourcePlanId,
        sourceUrl: item.sourceUrl
      }))
    );
  }

  return { items, errors };
};

export const loadAllSnapshotsWithPrevious = async (): Promise<SnapshotLoadWithPreviousResult> => {
  const current = await loadAllSnapshots();

  let manifest: LatestSnapshots | null = null;
  try {
    manifest = await fetchJson<LatestSnapshots>(LATEST_MANIFEST_URL);
  } catch {
    manifest = null;
  }

  const previousBySource = await Promise.all(
    (Object.keys(SOURCE_KEY_TO_RELEASE_SOURCE) as SnapshotManifestKey[]).map(async (key) => {
      const loaded = await loadPreviousSnapshot(manifest?.[key]);
      return {
        key,
        items: loaded.items,
        found: loaded.found
      };
    })
  );

  const previousItems = previousBySource.flatMap((entry) => entry.items);
  const previousBaselineSources = previousBySource
    .filter((entry) => entry.found)
    .map((entry) => SOURCE_KEY_TO_RELEASE_SOURCE[entry.key]);

  return {
    ...current,
    previousItems,
    previousBaselineSources
  };
};

export const loadProductsConfig = (): ProductsConfig => {
  const base = ProductsConfigSchema.parse(productsConfig as ProductsConfig);
  return loadCatalog(base);
};

export const loadRulesConfig = (): RulesConfig => {
  return RulesConfigSchema.parse(rulesConfig as RulesConfig);
};
