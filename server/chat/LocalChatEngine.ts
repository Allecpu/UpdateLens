import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChatQueryRequest, ChatQueryResponse } from './ChatSchemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

type SnapshotItem = {
  id?: string;
  source?: string;
  product?: string;
  productName?: string;
  title?: string;
  summary?: string;
  description?: string;
  status?: string;
  category?: string;
  wave?: string;
  availabilityTypes?: string[];
  availabilityDate?: string;
  releaseDate?: string;
  lastUpdatedDate?: string;
  tags?: string[];
  enabledFor?: string;
  language?: string;
  minBcVersion?: number;
};

type ChatContextBookmark = {
  showBookmarksOnly?: unknown;
  bookmarkedIds?: unknown;
  currentScopeItemIds?: unknown;
};

type BaseFilters = Partial<{
  products: string[];
  sources: string[];
  statuses: string[];
  categories: string[];
  waves: string[];
  availabilityTypes: string[];
  periodNewDays: number;
  periodChangedDays: number;
  releaseInDays: number;
  months: string[];
  tags: string[];
  enabledFor: string[];
  language: string[];
  bcVersions: string[];
  minBcVersionMin: number | null;
  horizonMonths: number;
  historyMonths: number;
  releaseDateFrom: string;
  releaseDateTo: string;
  query: string;
}>;

const FAVORITES_PATTERN = /\b(preferit[oi]|segnalibr[io]|bookmark(?:s)?|favorites?)\b/i;
const FAVORITES_COUNT_PATTERN = /\b(quanti|quante|numero|count|how many)\b/i;

const SOURCE_MAP: Array<{ pattern: RegExp; value: 'Microsoft' | 'EOS' | 'Fabric' | 'MICROSOFT 365' }> = [
  { pattern: /\bmicrosoft 365\b|\bm365\b|\boffice 365\b/i, value: 'MICROSOFT 365' },
  { pattern: /\bfabric\b/i, value: 'Fabric' },
  { pattern: /\beos\b/i, value: 'EOS' },
  { pattern: /\bmicrosoft\b|\brelease plans?\b|\bms\b/i, value: 'Microsoft' }
];

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'with', 'and',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'del', 'della', 'delle', 'dei',
  'su', 'con', 'per', 'e', 'da', 'al', 'ai', 'alle', 'agli',
  'release', 'notes', 'novita', 'novità', 'novit',
  'che', 'ci', 'sono', 'cosa', 'quale', 'quali', 'mi', 'puoi', 'puo', 'può',
  'quanti', 'quante', 'quanto', 'quanta', 'how', 'many'
]);

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\bd365\b/g, 'dynamics 365')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const tokenizeQuery = (value: string): string[] => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }
  return Array.from(
    new Set(
      normalized
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    )
  );
};

const tokenizeHaystack = (value: string): Set<string> => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return new Set();
  }
  return new Set(normalized.split(' ').filter(Boolean));
};

const loadLatestItems = async (): Promise<SnapshotItem[]> => {
  const latestPath = path.resolve(repoRoot, 'public', 'data', 'latest.json');
  const latestRaw = await readFile(latestPath, 'utf-8');
  const latest = JSON.parse(latestRaw) as Record<string, string>;

  const files = [latest.microsoft, latest.eos, latest.fabric, latest.m365roadmap].filter(
    (value): value is string => Boolean(value)
  );

  const groups = await Promise.all(
    files.map(async (filename) => {
      const fullPath = path.resolve(repoRoot, 'public', 'data', filename);
      const raw = await readFile(fullPath, 'utf-8');
      const parsed = JSON.parse(raw) as { items?: SnapshotItem[] };
      return parsed.items ?? [];
    })
  );

  return groups.flat();
};

const detectSource = (text: string): Array<'Microsoft' | 'EOS' | 'Fabric' | 'MICROSOFT 365'> => {
  const matches: Array<'Microsoft' | 'EOS' | 'Fabric' | 'MICROSOFT 365'> = [];
  for (const entry of SOURCE_MAP) {
    if (entry.pattern.test(text)) {
      matches.push(entry.value);
    }
  }
  return Array.from(new Set(matches));
};

const extractSemanticQuery = (text: string): string => {
  const normalized = normalizeText(text);
  if (!normalized) return '';

  const countPatterns = [
    /^(?:quanti|quante|quanto|quanta|numero(?:\s+di)?|count)\s+(?:elementi|novita|risultati|update|aggiornamenti)\s+(?:per|su|di)\s+(.+)$/i,
    /^(?:how many)\s+(?:items|updates|results)\s+(?:for|about)\s+(.+)$/i
  ];

  for (const pattern of countPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return text.trim();
};

const levenshteinDistance = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + cost
      );
      prev = temp;
    }
  }
  return dp[n];
};

const detectProductFromQuery = (items: SnapshotItem[], query: string): string | null => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return null;

  const productMap = new Map<string, string>();
  for (const item of items) {
    const label = (item.productName ?? item.product ?? '').trim();
    if (!label) continue;
    const normalizedLabel = normalizeText(label);
    if (!normalizedLabel) continue;
    if (!productMap.has(normalizedLabel)) {
      productMap.set(normalizedLabel, label);
    }
  }

  const exact = productMap.get(normalizedQuery);
  if (exact) return exact;

  const candidates = Array.from(productMap.entries())
    .filter(([normalizedLabel]) =>
      normalizedLabel.includes(normalizedQuery) || normalizedQuery.includes(normalizedLabel)
    )
    .sort((a, b) => b[0].length - a[0].length);

  if (candidates[0]) {
    return candidates[0][1];
  }

  // Fuzzy fallback for common typos (e.g. "autoamte" -> "automate")
  let bestLabel: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [normalizedLabel, label] of productMap.entries()) {
    const distance = levenshteinDistance(normalizedQuery, normalizedLabel);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLabel = label;
    }
  }
  const maxAllowedDistance =
    normalizedQuery.length >= 16 ? 3 : normalizedQuery.length >= 8 ? 2 : 1;
  if (bestLabel && bestDistance <= maxAllowedDistance) {
    return bestLabel;
  }

  return null;
};

const toPreviewItem = (item: SnapshotItem) => {
  return {
    id: item.id ?? crypto.randomUUID(),
    productName: item.productName ?? item.product ?? 'N/D',
    status: item.status ?? 'Unknown',
    title: item.title ?? 'N/D',
    description: item.description ?? item.summary ?? ''
  };
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
};

const toMonthDate = (value?: string): number | null => {
  if (!value) return null;
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [yearRaw, monthRaw] = value.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!year || !month || month < 1 || month > 12) return null;
    return new Date(year, month - 1, 1).getTime();
  }
  return null;
};

const parseIsoDate = (value: unknown): number | null => {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
};

const parseDateAny = (value: unknown): number | null => {
  const iso = parseIsoDate(value);
  if (iso !== null) return iso;
  if (typeof value !== 'string') return null;
  return toMonthDate(value);
};

const applyBaseFilters = (items: SnapshotItem[], baseFiltersRaw: unknown): SnapshotItem[] => {
  const baseFilters = (baseFiltersRaw ?? {}) as BaseFilters;

  const sourceSet = new Set(toStringArray(baseFilters.sources).map(normalizeText));
  const productSet = new Set(toStringArray(baseFilters.products).map(normalizeText));
  const statusSet = new Set(toStringArray(baseFilters.statuses).map(normalizeText));
  const categorySet = new Set(toStringArray(baseFilters.categories).map(normalizeText));
  const waveSet = new Set(toStringArray(baseFilters.waves).map(normalizeText));
  const availabilitySet = new Set(toStringArray(baseFilters.availabilityTypes).map(normalizeText));
  const monthsSet = new Set(toStringArray(baseFilters.months));
  const tagsSet = new Set(toStringArray(baseFilters.tags).map(normalizeText));
  const enabledForSet = new Set(toStringArray(baseFilters.enabledFor).map(normalizeText));
  const languageSet = new Set(toStringArray(baseFilters.language).map(normalizeText));
  const bcVersionSet = new Set(
    toStringArray(baseFilters.bcVersions)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  );

  const periodNewDays =
    typeof baseFilters.periodNewDays === 'number' && Number.isFinite(baseFilters.periodNewDays)
      ? Math.max(0, baseFilters.periodNewDays)
      : 0;
  const periodSince = periodNewDays > 0 ? Date.now() - periodNewDays * 24 * 60 * 60 * 1000 : null;
  const periodChangedDays =
    typeof baseFilters.periodChangedDays === 'number' && Number.isFinite(baseFilters.periodChangedDays)
      ? Math.max(0, baseFilters.periodChangedDays)
      : 0;
  const periodChangedSince = periodChangedDays > 0 ? Date.now() - periodChangedDays * 24 * 60 * 60 * 1000 : null;
  const releaseInDays =
    typeof baseFilters.releaseInDays === 'number' && Number.isFinite(baseFilters.releaseInDays)
      ? Math.max(0, baseFilters.releaseInDays)
      : 0;
  const releaseInLimit = releaseInDays > 0 ? Date.now() + releaseInDays * 24 * 60 * 60 * 1000 : null;

  const horizonMonths =
    typeof baseFilters.horizonMonths === 'number' && Number.isFinite(baseFilters.horizonMonths)
      ? baseFilters.horizonMonths
      : 12;
  const historyMonths =
    typeof baseFilters.historyMonths === 'number' && Number.isFinite(baseFilters.historyMonths)
      ? baseFilters.historyMonths
      : 6;
  const nowDate = new Date();
  const horizonDate = new Date(nowDate.getTime());
  horizonDate.setMonth(horizonDate.getMonth() + horizonMonths);
  const historyLimitDate = new Date(nowDate.getTime());
  historyLimitDate.setMonth(historyLimitDate.getMonth() - historyMonths);
  const horizonTs = horizonDate.getTime();
  const historyTs = historyLimitDate.getTime();

  const releaseFrom = parseDateAny(baseFilters.releaseDateFrom);
  const releaseTo = parseDateAny(baseFilters.releaseDateTo);

  const baseQuery = typeof baseFilters.query === 'string' ? normalizeText(baseFilters.query) : '';
  const baseQueryTokens = tokenizeQuery(baseFilters.query ?? '');

  return items.filter((item) => {
    if (sourceSet.size > 0) {
      const source = normalizeText(item.source ?? '');
      if (!sourceSet.has(source)) return false;
    }

    if (productSet.size > 0) {
      const product = normalizeText(item.productName ?? item.product ?? '');
      if (!productSet.has(product)) return false;
    }

    if (statusSet.size > 0) {
      const status = normalizeText(item.status ?? '');
      if (!statusSet.has(status)) return false;
    }

    if (categorySet.size > 0) {
      const category = normalizeText(item.category ?? '');
      if (!categorySet.has(category)) return false;
    }

    if (waveSet.size > 0) {
      const wave = normalizeText(item.wave ?? '');
      if (!waveSet.has(wave)) return false;
    }

    if (availabilitySet.size > 0) {
      const itemAvailability = (item.availabilityTypes ?? []).map(normalizeText);
      if (!itemAvailability.some((value) => availabilitySet.has(value))) return false;
    }

    const availabilityTs = parseDateAny(item.availabilityDate);
    if (availabilityTs !== null && availabilityTs > horizonTs) return false;
    if (availabilityTs !== null && availabilityTs < historyTs) return false;

    if (monthsSet.size > 0) {
      if (!item.availabilityDate || !monthsSet.has(item.availabilityDate)) return false;
    }

    if (tagsSet.size > 0) {
      const itemTags = (item.tags ?? []).map(normalizeText);
      if (!itemTags.some((tag) => tagsSet.has(tag))) return false;
    }

    if (enabledForSet.size > 0) {
      const enabledFor = normalizeText(item.enabledFor ?? '');
      if (!enabledForSet.has(enabledFor)) return false;
    }

    if (languageSet.size > 0) {
      const language = normalizeText(item.language ?? '');
      if (!languageSet.has(language)) return false;
    }

    if (bcVersionSet.size > 0) {
      if (item.minBcVersion == null || !bcVersionSet.has(item.minBcVersion)) return false;
    } else if (typeof baseFilters.minBcVersionMin === 'number' && Number.isFinite(baseFilters.minBcVersionMin)) {
      if (item.minBcVersion != null && item.minBcVersion < baseFilters.minBcVersionMin) return false;
    }

    const releaseTs = parseDateAny(item.releaseDate);
    if (periodSince && (releaseTs === null || releaseTs < periodSince)) return false;
    if (periodChangedSince) {
      const changedTs = parseDateAny(item.lastUpdatedDate) ?? releaseTs;
      if (changedTs === null || changedTs < periodChangedSince) return false;
    }
    if (releaseInLimit !== null) {
      if (releaseTs === null || releaseTs < Date.now() || releaseTs > releaseInLimit) return false;
    }
    if (releaseFrom !== null && (releaseTs === null || releaseTs < releaseFrom)) return false;
    if (releaseTo !== null && (releaseTs === null || releaseTs > releaseTo)) return false;

    if (baseQuery) {
      const haystack = normalizeText(
        [item.title, item.summary, item.description, item.product, item.productName, item.source]
          .filter(Boolean)
          .join(' ')
      );
      if (!haystack.includes(baseQuery)) {
        const haystackSet = new Set(haystack.split(' ').filter(Boolean));
        if (baseQueryTokens.length === 0) return false;
        if (!baseQueryTokens.every((token) => haystackSet.has(token))) return false;
      }
    }

    return true;
  });
};

export const runLocalChatEngine = async (
  req: ChatQueryRequest
): Promise<ChatQueryResponse> => {
  const traceId = crypto.randomUUID();
  const text = req.message.trim();
  const normalized = text.toLowerCase();
  const chatContext = (req.chatContext ?? {}) as ChatContextBookmark;
  const showBookmarksOnly = chatContext.showBookmarksOnly === true;
  const bookmarkedIdsSet = new Set(
    Array.isArray(chatContext.bookmarkedIds)
      ? chatContext.bookmarkedIds.filter(
          (value): value is string => typeof value === 'string' && value.length > 0
        )
      : []
  );

  if (/^(mostra tutto|reset|resetta|azzera|pulisci filtri?)$/i.test(normalized)) {
    return {
      message: 'Filtri azzerati. Mostro tutti gli elementi disponibili.',
      items: [],
      showPreview: false,
      canApplyFilters: true,
      filterPatch: {},
      engine: 'local',
      fallbackUsed: false,
      traceId
    };
  }

  const detectedSources = detectSource(text);
  const allItems = await loadLatestItems();
  const currentScopeIdsSet = new Set(
    Array.isArray(chatContext.currentScopeItemIds)
      ? chatContext.currentScopeItemIds.filter(
          (value): value is string => typeof value === 'string' && value.length > 0
        )
      : []
  );
  const scopedItems =
    req.searchScope === 'current'
      ? currentScopeIdsSet.size > 0
        ? allItems.filter((item) => !!item.id && currentScopeIdsSet.has(item.id))
        : applyBaseFilters(allItems, req.baseFilters)
      : allItems;

  if (FAVORITES_PATTERN.test(normalized)) {
    if (bookmarkedIdsSet.size === 0) {
      return {
        message: 'Non ci sono elementi preferiti al momento.',
        items: [],
        showPreview: false,
        canApplyFilters: false,
        filterPatch: {},
        engine: 'local',
        fallbackUsed: false,
        traceId
      };
    }

    const favoriteItems = scopedItems.filter(
      (item) => item.id && bookmarkedIdsSet.has(item.id)
    );
    const sourceFilteredFavorites =
      detectedSources.length > 0
        ? favoriteItems.filter(
            (item) => item.source && detectedSources.includes(item.source as never)
          )
        : favoriteItems;
    const preview = sourceFilteredFavorites.slice(0, req.topK).map(toPreviewItem);
    const sourceLabel = detectedSources.length > 0 ? ` per ${detectedSources.join(', ')}` : '';

    if (FAVORITES_COUNT_PATTERN.test(normalized)) {
      return {
        message: `Hai ${sourceFilteredFavorites.length} preferiti${sourceLabel}.`,
        items: [],
        showPreview: false,
        canApplyFilters: false,
        filterPatch: {},
        engine: 'local',
        fallbackUsed: false,
        traceId
      };
    }

    return {
      message: `Hai ${sourceFilteredFavorites.length} preferiti${sourceLabel}.`,
      items: preview,
      showPreview: preview.length > 0,
      canApplyFilters: false,
      filterPatch: {},
      engine: 'local',
      fallbackUsed: false,
      traceId
    };
  }

  const filterPatch: ChatQueryResponse['filterPatch'] = {};

  if (detectedSources.length > 0) {
    filterPatch.sources = detectedSources;
  }

  const periodMatch = normalized.match(/ultimi?\s+(\d+)\s+giorni?/i);
  if (periodMatch) {
    filterPatch.periodNewDays = Number(periodMatch[1]);
  }

  if (/\bga\b|\bgeneral availability\b|\bdisponibilit[aà]\s+generale\b/i.test(normalized)) {
    filterPatch.availabilityTypes = ['General Availability'];
  } else if (/\bpreview\b|\banteprima\b/i.test(normalized)) {
    filterPatch.availabilityTypes = ['Public Preview'];
  }

  const semanticQuery = extractSemanticQuery(text);
  const matchedProduct =
    semanticQuery.length >= 2 ? detectProductFromQuery(scopedItems, semanticQuery) : null;
  if (matchedProduct) {
    filterPatch.products = [matchedProduct];
  } else if (Object.keys(filterPatch).length === 0 && semanticQuery.length >= 3) {
    filterPatch.query = semanticQuery;
  }

  const quickQuery = filterPatch.query ? normalizeText(filterPatch.query) : '';
  const queryTokens = tokenizeQuery(filterPatch.query ?? '');
  const sourceFilter = filterPatch.sources;
  const productFilter = new Set(
    (filterPatch.products ?? []).map((value) => normalizeText(value))
  );

  const filtered = scopedItems.filter((item) => {
    if (showBookmarksOnly && (!item.id || !bookmarkedIdsSet.has(item.id))) {
      return false;
    }
    if (sourceFilter?.length && (!item.source || !sourceFilter.includes(item.source as never))) {
      return false;
    }
    if (productFilter.size > 0) {
      const product = normalizeText(item.productName ?? item.product ?? '');
      if (!productFilter.has(product)) {
        return false;
      }
    }
    if (quickQuery || queryTokens.length > 0) {
      const haystackRaw =
        [
        item.title,
        item.summary,
        item.description,
        item.product,
        item.productName,
        item.source
        ]
          .filter(Boolean)
          .join(' ');
      const haystack = normalizeText(haystackRaw);
      const haystackTokens = tokenizeHaystack(haystackRaw);
      if (quickQuery && haystack.includes(quickQuery)) {
        return true;
      }
      if (queryTokens.length > 0) {
        return queryTokens.every((token) => haystackTokens.has(token));
      }
      return false;
    }
    return true;
  });

  const preview = filtered.slice(0, req.topK).map(toPreviewItem);

  return {
    message: `Trovati ${filtered.length} elementi per "${text}".`,
    items: preview,
    showPreview: preview.length > 0,
    canApplyFilters: Object.keys(filterPatch).length > 0,
    filterPatch,
    engine: 'local',
    fallbackUsed: false,
    traceId,
    totalCount: filtered.length
  };
};
