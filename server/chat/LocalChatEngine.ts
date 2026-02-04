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
  releaseDate?: string;
};

type ChatContextBookmark = {
  showBookmarksOnly?: unknown;
  bookmarkedIds?: unknown;
};

type BaseFilters = Partial<{
  products: string[];
  sources: string[];
  statuses: string[];
  categories: string[];
  waves: string[];
  availabilityTypes: string[];
  periodNewDays: number;
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
  'release', 'notes', 'novita', 'novità',
  'che', 'ci', 'sono', 'cosa', 'quale', 'quali', 'mi', 'puoi', 'puo', 'può'
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

const parseIsoDate = (value: unknown): number | null => {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
};

const applyBaseFilters = (items: SnapshotItem[], baseFiltersRaw: unknown): SnapshotItem[] => {
  const baseFilters = (baseFiltersRaw ?? {}) as BaseFilters;

  const sourceSet = new Set(toStringArray(baseFilters.sources).map(normalizeText));
  const productSet = new Set(toStringArray(baseFilters.products).map(normalizeText));
  const statusSet = new Set(toStringArray(baseFilters.statuses).map(normalizeText));
  const categorySet = new Set(toStringArray(baseFilters.categories).map(normalizeText));
  const waveSet = new Set(toStringArray(baseFilters.waves).map(normalizeText));
  const availabilitySet = new Set(toStringArray(baseFilters.availabilityTypes).map(normalizeText));

  const periodNewDays =
    typeof baseFilters.periodNewDays === 'number' && Number.isFinite(baseFilters.periodNewDays)
      ? Math.max(0, baseFilters.periodNewDays)
      : 0;
  const periodSince = periodNewDays > 0 ? Date.now() - periodNewDays * 24 * 60 * 60 * 1000 : null;

  const releaseFrom = parseIsoDate(baseFilters.releaseDateFrom);
  const releaseTo = parseIsoDate(baseFilters.releaseDateTo);

  const baseQuery = typeof baseFilters.query === 'string' ? normalizeText(baseFilters.query) : '';

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

    const releaseTs = parseIsoDate(item.releaseDate);
    if (periodSince && releaseTs !== null && releaseTs < periodSince) return false;
    if (releaseFrom !== null && releaseTs !== null && releaseTs < releaseFrom) return false;
    if (releaseTo !== null && releaseTs !== null && releaseTs > releaseTo) return false;

    if (baseQuery) {
      const haystack = normalizeText(
        [item.title, item.summary, item.description, item.product, item.productName, item.source]
          .filter(Boolean)
          .join(' ')
      );
      if (!haystack.includes(baseQuery)) return false;
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
  const scopedItems =
    req.searchScope === 'current' ? applyBaseFilters(allItems, req.baseFilters) : allItems;

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

  if (Object.keys(filterPatch).length === 0 && text.length >= 3) {
    filterPatch.query = text;
  }

  const quickQuery = filterPatch.query ? normalizeText(filterPatch.query) : '';
  const queryTokens = tokenizeQuery(filterPatch.query ?? '');
  const sourceFilter = filterPatch.sources;

  const filtered = scopedItems.filter((item) => {
    if (showBookmarksOnly && (!item.id || !bookmarkedIdsSet.has(item.id))) {
      return false;
    }
    if (sourceFilter?.length && (!item.source || !sourceFilter.includes(item.source as never))) {
      return false;
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
    traceId
  };
};
