import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  normalizeLearnLevel,
  normalizeLearnType,
  resolveLearnProductKey,
  type LearnMeta,
  type LearnType
} from '../src/utils/learn';

const LEARN_API_ENDPOINT = 'https://learn.microsoft.com/api/catalog/';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const GENERIC_TITLE_REGEX =
  /\b(introduction|intro|overview|what is|get started|fundamentals)\b/i;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'your',
  'are',
  'into',
  'using',
  'use',
  'new',
  'preview',
  'general',
  'availability',
  'release',
  'feature',
  'microsoft'
]);

export type LearnEnrichableItem = {
  id: string;
  title: string;
  product: string;
  productName?: string;
  learnUrl?: string | null;
  learnMeta?: LearnMeta | null;
};

type LearnCatalogResource = {
  uid?: string;
  title: string;
  url: string;
  type: LearnType;
  level?: string;
  products: string[];
  durationMinutes?: number;
  moduleCount?: number;
  xp?: number;
  roles: string[];
  subjects: string[];
};

type LearnCatalogCache = Record<string, LearnCatalogResource[]>;

type LearnEnrichmentStats = {
  processed: number;
  skippedWithLearnUrl: number;
  noProductMapping: number;
  noCatalogCandidates: number;
  matched: number;
};

const readCache = async (cacheFilePath: string): Promise<LearnCatalogCache> => {
  try {
    const raw = await readFile(cacheFilePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const cache: LearnCatalogCache = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!Array.isArray(value)) {
        return;
      }
      cache[key] = value
        .map((entry) => normalizeCatalogResource(entry, key))
        .filter((entry): entry is LearnCatalogResource => Boolean(entry));
    });
    return cache;
  } catch {
    return {};
  }
};

const isCacheFresh = async (cacheFilePath: string): Promise<boolean> => {
  try {
    const fileStats = await stat(cacheFilePath);
    return Date.now() - fileStats.mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
};

const writeCache = async (
  cacheFilePath: string,
  cache: LearnCatalogCache
): Promise<void> => {
  await mkdir(path.dirname(cacheFilePath), { recursive: true });
  await writeFile(cacheFilePath, JSON.stringify(cache, null, 2), 'utf-8');
};

const normalizeCatalogResource = (
  raw: unknown,
  fallbackProductKey: string
): LearnCatalogResource | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  if (!title || !url || !/^https?:\/\//i.test(url)) {
    return null;
  }
  const uid = typeof value.uid === 'string' ? value.uid.trim() : undefined;
  const type = normalizeLearnType(typeof value.type === 'string' ? value.type : null);
  const levelFromString = typeof value.level === 'string' ? value.level : undefined;
  const levelFromArray = Array.isArray(value.levels)
    ? value.levels.find((entry) => typeof entry === 'string' && entry.trim().length > 0)
    : undefined;
  const level =
    typeof levelFromArray === 'string'
      ? levelFromArray
      : levelFromString;
  const products = Array.isArray(value.products)
    ? value.products
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0)
    : [];
  const roles = Array.isArray(value.roles)
    ? value.roles
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0)
    : [];
  const subjects = Array.isArray(value.subjects)
    ? value.subjects
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0)
    : [];
  const durationRaw =
    typeof value.duration_in_minutes === 'number'
      ? value.duration_in_minutes
      : typeof value.durationMinutes === 'number'
        ? value.durationMinutes
        : undefined;
  const durationMinutes =
    typeof durationRaw === 'number' && Number.isFinite(durationRaw) && durationRaw > 0
      ? Math.round(durationRaw)
      : undefined;
  const moduleCountRaw =
    typeof value.number_of_children === 'number'
      ? value.number_of_children
      : typeof value.moduleCount === 'number'
        ? value.moduleCount
        : undefined;
  const moduleCount =
    typeof moduleCountRaw === 'number' &&
    Number.isFinite(moduleCountRaw) &&
    moduleCountRaw >= 0
      ? Math.round(moduleCountRaw)
      : undefined;
  const xpRaw =
    typeof value.xp === 'number'
      ? value.xp
      : typeof value.xpPoints === 'number'
        ? value.xpPoints
        : undefined;
  const xp =
    typeof xpRaw === 'number' && Number.isFinite(xpRaw) && xpRaw > 0
      ? Math.round(xpRaw)
      : undefined;

  return {
    uid,
    title,
    url,
    type,
    level,
    products: products.length > 0 ? products : [fallbackProductKey],
    durationMinutes,
    moduleCount,
    xp,
    roles,
    subjects
  };
};

const parseCatalogPayload = (
  payload: unknown,
  productKey: string
): LearnCatalogResource[] => {
  const rows: Array<{ row: unknown; fallbackType?: LearnType }> = [];
  const pushRows = (value: unknown, fallbackType?: LearnType) => {
    if (!Array.isArray(value)) {
      return;
    }
    value.forEach((row) => {
      rows.push({ row, fallbackType });
    });
  };

  if (Array.isArray(payload)) {
    pushRows(payload);
  } else if (payload && typeof payload === 'object') {
    const root = payload as Record<string, unknown>;
    pushRows(root.results);
    pushRows(root.modules, 'module');
    pushRows(root.learningPaths, 'learningPath');
    pushRows(root.courses, 'course');
    pushRows(root.certifications, 'certification');
    pushRows(root.items);
  }

  const dedupe = new Map<string, LearnCatalogResource>();

  const mergeCatalogResource = (
    current: LearnCatalogResource,
    incoming: LearnCatalogResource
  ): LearnCatalogResource => {
    const mergedProducts = Array.from(new Set([...current.products, ...incoming.products]));
    const mergedRoles = Array.from(new Set([...current.roles, ...incoming.roles]));
    const mergedSubjects = Array.from(new Set([...current.subjects, ...incoming.subjects]));
    return {
      ...current,
      title: incoming.title.length > current.title.length ? incoming.title : current.title,
      type: current.type === 'documentation' ? incoming.type : current.type,
      level: current.level ?? incoming.level,
      products: mergedProducts.length > 0 ? mergedProducts : current.products,
      durationMinutes: incoming.durationMinutes ?? current.durationMinutes,
      moduleCount: incoming.moduleCount ?? current.moduleCount,
      xp: incoming.xp ?? current.xp,
      roles: mergedRoles,
      subjects: mergedSubjects
    };
  };

  rows.forEach(({ row, fallbackType }) => {
    if (!row || typeof row !== 'object') {
      return;
    }
    const candidate = row as Record<string, unknown>;
    if (fallbackType && typeof candidate.type !== 'string') {
      candidate.type = fallbackType;
    }
    const normalized = normalizeCatalogResource(candidate, productKey);
    if (!normalized) {
      return;
    }
    const key = normalized.uid ?? normalized.url;
    const existing = dedupe.get(key);
    if (!existing) {
      dedupe.set(key, normalized);
      return;
    }
    dedupe.set(key, mergeCatalogResource(existing, normalized));
  });

  return Array.from(dedupe.values());
};

const fetchCatalogForProduct = async (
  productKey: string,
  locale: 'it-it' | 'en-us'
): Promise<LearnCatalogResource[]> => {
  const query = new URLSearchParams({
    product: productKey,
    locale
  });
  const response = await fetch(`${LEARN_API_ENDPOINT}?${query.toString()}`, {
    headers: {
      Accept: 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`Learn API error (${locale}): ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  return parseCatalogPayload(payload, productKey);
};

const fetchCatalogWithFallback = async (
  productKey: string
): Promise<LearnCatalogResource[]> => {
  try {
    const italian = await fetchCatalogForProduct(productKey, 'it-it');
    if (italian.length > 0) {
      return italian;
    }
  } catch {
    // fallback below
  }
  return fetchCatalogForProduct(productKey, 'en-us');
};

const extractKeywords = (title: string): string[] => {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 4 && !STOP_WORDS.has(chunk));
};

const scoreCandidate = (
  itemTitle: string,
  productKey: string,
  candidate: LearnCatalogResource
): { score: number; matchedKeyword: boolean } => {
  const lowerTitle = itemTitle.toLowerCase();
  const candidateTitle = candidate.title.toLowerCase();
  const keywords = extractKeywords(lowerTitle);
  const matchedKeyword = keywords.some((keyword) => candidateTitle.includes(keyword));
  let score = 0;

  if (matchedKeyword) {
    score += 3;
  }
  if (candidate.type === 'learningPath') {
    score += 2;
  }
  if (normalizeLearnLevel(candidate.level) === 'intermediate') {
    score += 1;
  }
  if (GENERIC_TITLE_REGEX.test(candidateTitle)) {
    score -= 1;
  }
  if (
    candidate.products.some((product) => product.toLowerCase() === productKey.toLowerCase())
  ) {
    score += 1;
  }

  return { score, matchedKeyword };
};

const selectBestCandidate = (
  item: LearnEnrichableItem,
  productKey: string,
  candidates: LearnCatalogResource[]
): { learnUrl: string; learnMeta: LearnMeta } | null => {
  let selected: { score: number; matchedKeyword: boolean; candidate: LearnCatalogResource } | null =
    null;

  candidates.forEach((candidate) => {
    const ranked = scoreCandidate(item.title, productKey, candidate);
    if (!selected || ranked.score > selected.score) {
      selected = { ...ranked, candidate };
    }
  });

  if (!selected) {
    return null;
  }

  const reliable = selected.score >= 4 || (selected.score >= 3 && selected.matchedKeyword);
  if (!reliable) {
    return null;
  }

  return {
    learnUrl: selected.candidate.url,
    learnMeta: {
      title: selected.candidate.title,
      type: selected.candidate.type,
      level: normalizeLearnLevel(selected.candidate.level),
      uid: selected.candidate.uid,
      productKey,
      score: selected.score,
      durationMinutes: selected.candidate.durationMinutes,
      moduleCount: selected.candidate.moduleCount,
      xp: selected.candidate.xp,
      roles: selected.candidate.roles,
      subjects: selected.candidate.subjects
    }
  };
};

type EnrichmentOptions = {
  cacheFilePath?: string;
  publicCacheFilePath?: string;
};

export const enrichReleaseItemsWithLearn = async <T extends LearnEnrichableItem>(
  items: T[],
  options: EnrichmentOptions = {}
): Promise<{ items: T[]; stats: LearnEnrichmentStats }> => {
  const cacheFilePath =
    options.cacheFilePath ?? path.resolve('src', 'data', 'cache', 'learn_catalog_cache.json');
  const publicCacheFilePath =
    options.publicCacheFilePath ?? path.resolve('public', 'data', 'learn_catalog_cache.json');

  const stats: LearnEnrichmentStats = {
    processed: items.length,
    skippedWithLearnUrl: 0,
    noProductMapping: 0,
    noCatalogCandidates: 0,
    matched: 0
  };

  const cache = await readCache(cacheFilePath);
  const cacheFresh = await isCacheFresh(cacheFilePath);

  const productKeys = new Set<string>();
  items.forEach((item) => {
    if (item.learnUrl) {
      return;
    }
    const productKey = resolveLearnProductKey(item.productName ?? item.product);
    if (productKey) {
      productKeys.add(productKey);
    }
  });

  for (const productKey of productKeys) {
    const hasCache = Array.isArray(cache[productKey]) && cache[productKey].length > 0;
    if (hasCache && cacheFresh) {
      continue;
    }
    try {
      const catalog = await fetchCatalogWithFallback(productKey);
      if (catalog.length > 0) {
        cache[productKey] = catalog;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[LearnEnrichment] API unavailable for ${productKey}: ${reason}`);
    }
  }

  await writeCache(cacheFilePath, cache);
  await writeCache(publicCacheFilePath, cache);

  const enrichedItems = items.map((item) => {
    if (item.learnUrl) {
      stats.skippedWithLearnUrl += 1;
      return item;
    }
    const productKey = resolveLearnProductKey(item.productName ?? item.product);
    if (!productKey) {
      stats.noProductMapping += 1;
      return item;
    }

    const catalog = cache[productKey] ?? [];
    if (catalog.length === 0) {
      stats.noCatalogCandidates += 1;
      return item;
    }

    const selected = selectBestCandidate(item, productKey, catalog);
    if (!selected) {
      return item;
    }

    stats.matched += 1;
    return {
      ...item,
      learnUrl: selected.learnUrl,
      learnMeta: selected.learnMeta
    };
  });

  return { items: enrichedItems, stats };
};
