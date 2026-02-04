import type { ReleaseItem } from '../models/ReleaseItem';
import type { ReleaseSource } from '../models/ReleaseItem';
import type { FilterState } from '../models/Filters';
import { isFilterSupported } from './FilterDefinitions';
import { extractCountriesFromHtml } from '../utils/geography';
import { normalizeProductLabel, normalizeAvailabilityType } from './FilterMetadata';

// Enable debug logging only when needed (set to true for troubleshooting)
const DEBUG_FILTERS = false;

const toMonthDate = (value: string): Date | null => {
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month || month < 1 || month > 12) {
    return null;
  }
  return new Date(year, month - 1, 1);
};

const addMonths = (date: Date, months: number): Date => {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
};

const parseDateAny = (value?: string): Date | null => {
  if (!value) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }
  return toMonthDate(value);
};

const withinLastDays = (date: Date | null, days: number, now: Date): boolean => {
  if (!date) {
    return false;
  }
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return date >= cutoff && date <= now;
};

const QUERY_STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'with', 'and',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'del', 'della', 'delle', 'dei',
  'su', 'con', 'per', 'e', 'da', 'al', 'ai', 'alle', 'agli',
  'che', 'ci', 'sono', 'cosa', 'quale', 'quali', 'mi', 'puoi', 'puo', 'puoi',
  'dammi', 'mostra', 'notizie', 'novita', 'novita'
]);

const normalizeSearchText = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const tokenizeSearchText = (value: string): string[] => {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }
  return Array.from(
    new Set(
      normalized
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !QUERY_STOP_WORDS.has(token))
    )
  );
};

export const filterReleaseItems = (
  items: ReleaseItem[],
  filters: FilterState
): ReleaseItem[] => {
  // Pre-compute date boundaries once
  const now = new Date();
  const nowTime = now.getTime();
  const horizon = addMonths(now, filters.horizonMonths);
  const historyLimit = addMonths(now, -filters.historyMonths);

  // Pre-compute filter values as Sets for O(1) lookup
  const sourcesSet = new Set(filters.sources);
  const statusesSet = new Set(filters.statuses);
  const productsSet = new Set(filters.products);
  const categoriesSet = new Set(filters.categories);
  const wavesSet = new Set(filters.waves);
  const tagsSet = new Set(filters.tags);
  const monthsSet = new Set(filters.months);
  const enabledForSet = new Set(filters.enabledFor);
  const geographySet = new Set(filters.geography);
  const languageSet = new Set(filters.language);
  const bcVersionSet = new Set(
    (filters.bcVersions ?? [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  );

  // Pre-compute normalized availability types
  const normalizedAvailabilityTypes = filters.availabilityTypes.map(normalizeAvailabilityType);
  const availabilityTypesSet = new Set(normalizedAvailabilityTypes);

  // Pre-compute query
  const query = normalizeSearchText(filters.query.trim());
  const queryTokens = tokenizeSearchText(filters.query);

  // Pre-compute date ranges
  const releaseDateFrom = parseDateAny(filters.releaseDateFrom);
  const releaseDateTo = parseDateAny(filters.releaseDateTo);
  const releaseInDaysLimit = filters.releaseInDays > 0
    ? new Date(nowTime + filters.releaseInDays * 24 * 60 * 60 * 1000)
    : null;

  // Pre-compute which sources have selected products (single pass)
  const selectedSources = new Set<ReleaseSource>();
  if (productsSet.size > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const normalizedName = normalizeProductLabel(item.productName);
      if (productsSet.has(normalizedName)) {
        selectedSources.add(item.source);
      }
    }
  }

  // Check if filters are active (for early exit optimization)
  const hasSourcesFilter = sourcesSet.size > 0;
  const hasStatusesFilter = statusesSet.size > 0;
  const hasProductsFilter = productsSet.size > 0;
  const hasCategoriesFilter = categoriesSet.size > 0;
  const hasWavesFilter = wavesSet.size > 0;
  const hasAvailabilityTypesFilter = availabilityTypesSet.size > 0;
  const hasEnabledForFilter = enabledForSet.size > 0;
  const hasGeographyFilter = geographySet.size > 0;
  const hasLanguageFilter = languageSet.size > 0;
  const hasBcVersionFilter = bcVersionSet.size > 0;
  const hasTagsFilter = tagsSet.size > 0;
  const hasMonthsFilter = monthsSet.size > 0;
  const hasPeriodNewDays = filters.periodNewDays > 0;
  const hasPeriodChangedDays = filters.periodChangedDays > 0;
  const hasReleaseInDays = filters.releaseInDays > 0;
  const hasQuery = query.length > 0;

  // Single pass filter - much faster than multiple array.filter() calls
  const result: ReleaseItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 1. Sources filter
    if (hasSourcesFilter && !sourcesSet.has(item.source)) {
      continue;
    }

    // 2. Statuses filter
    if (hasStatusesFilter && isFilterSupported(item.source, 'status')) {
      if (!statusesSet.has(item.status)) {
        continue;
      }
    }

    // 3. Products filter
    if (hasProductsFilter && isFilterSupported(item.source, 'productOrApp')) {
      if (!selectedSources.has(item.source)) {
        continue;
      }
      const normalizedItemProduct = normalizeProductLabel(item.productName);
      if (!productsSet.has(normalizedItemProduct)) {
        continue;
      }
    }

    // 4. Horizon filter
    const itemDate = toMonthDate(item.availabilityDate);
    if (itemDate && itemDate > horizon) {
      continue;
    }

    // 5. History filter
    if (itemDate && itemDate < historyLimit) {
      continue;
    }

    // 6. Categories filter
    if (hasCategoriesFilter && isFilterSupported(item.source, 'categories')) {
      if (!item.category || !categoriesSet.has(item.category)) {
        continue;
      }
    }

    // 7. Wave filter
    if (hasWavesFilter && isFilterSupported(item.source, 'wave')) {
      if (!item.wave || !wavesSet.has(item.wave)) {
        continue;
      }
    }

    // 8. Availability types filter
    if (hasAvailabilityTypesFilter && isFilterSupported(item.source, 'availabilityType')) {
      const types = item.availabilityTypes ?? [];
      let hasType = false;
      for (let j = 0; j < types.length; j++) {
        if (availabilityTypesSet.has(normalizeAvailabilityType(types[j]))) {
          hasType = true;
          break;
        }
      }
      if (!hasType) {
        continue;
      }
    }

    // 9. Enabled for filter
    if (hasEnabledForFilter && isFilterSupported(item.source, 'enabledFor')) {
      if (!item.enabledFor || !enabledForSet.has(item.enabledFor)) {
        continue;
      }
    }

    // 10. Geography filter
    if (hasGeographyFilter && isFilterSupported(item.source, 'geography')) {
      const geographyValues =
        item.geographyCountries && item.geographyCountries.length > 0
          ? item.geographyCountries
          : extractCountriesFromHtml(item.geography ?? '');
      let hasGeography = false;
      for (let j = 0; j < geographyValues.length; j++) {
        if (geographySet.has(geographyValues[j])) {
          hasGeography = true;
          break;
        }
      }
      if (!hasGeography) {
        continue;
      }
    }

    // 11. Language filter
    if (hasLanguageFilter && isFilterSupported(item.source, 'language')) {
      if (!item.language || !languageSet.has(item.language)) {
        continue;
      }
    }

    // 12. BC Version filter
    if (isFilterSupported(item.source, 'bcMinVersion')) {
      if (hasBcVersionFilter) {
        if (item.minBcVersion == null || !bcVersionSet.has(item.minBcVersion)) {
          continue;
        }
      } else if (filters.minBcVersionMin !== null) {
        if (item.minBcVersion != null && item.minBcVersion < filters.minBcVersionMin) {
          continue;
        }
      }
    }

    // 13. Tags filter
    if (hasTagsFilter && isFilterSupported(item.source, 'tags')) {
      const tags = item.tags ?? [];
      let hasTag = false;
      for (let j = 0; j < tags.length; j++) {
        if (tagsSet.has(tags[j])) {
          hasTag = true;
          break;
        }
      }
      if (!hasTag) {
        continue;
      }
    }

    // 14. Months filter
    if (hasMonthsFilter && isFilterSupported(item.source, 'months')) {
      if (!monthsSet.has(item.availabilityDate)) {
        continue;
      }
    }

    // 15. Period new days filter
    if (hasPeriodNewDays && isFilterSupported(item.source, 'periodNewDays')) {
      const firstDate = parseDateAny(item.releaseDate);
      if (!withinLastDays(firstDate, filters.periodNewDays, now)) {
        continue;
      }
    }

    // 16. Period changed days filter
    if (hasPeriodChangedDays && isFilterSupported(item.source, 'periodChangedDays')) {
      const updated = parseDateAny(item.lastUpdatedDate) ?? parseDateAny(item.releaseDate);
      if (!withinLastDays(updated, filters.periodChangedDays, now)) {
        continue;
      }
    }

    // 17. Release in days filter
    if (hasReleaseInDays && isFilterSupported(item.source, 'releaseInDays')) {
      const releaseDate = parseDateAny(item.releaseDate);
      if (!releaseDate || releaseDate < now || releaseDate > releaseInDaysLimit!) {
        continue;
      }
    }

    // 18. Release date range filter
    if (releaseDateFrom && isFilterSupported(item.source, 'releaseDateRange')) {
      const releaseDate = parseDateAny(item.releaseDate);
      if (!releaseDate || releaseDate < releaseDateFrom) {
        continue;
      }
    }

    if (releaseDateTo && isFilterSupported(item.source, 'releaseDateRange')) {
      const releaseDate = parseDateAny(item.releaseDate);
      if (!releaseDate || releaseDate > releaseDateTo) {
        continue;
      }
    }

    // 19. Query filter (text search)
    if (hasQuery && isFilterSupported(item.source, 'query')) {
      const haystack = normalizeSearchText(
        `${item.title} ${item.description} ${item.productName} ${item.source}`
      );
      if (!haystack.includes(query)) {
        if (queryTokens.length === 0) {
          continue;
        }
        const haystackSet = new Set(haystack.split(' ').filter(Boolean));
        const allTokensFound = queryTokens.every((token) => haystackSet.has(token));
        if (!allTokensFound) {
          continue;
        }
      }
    }

    // Item passed all filters
    result.push(item);
  }

  // Debug logging (only when enabled)
  if (DEBUG_FILTERS) {
    console.log('[FilterService] FILTER_RESULT', {
      inputCount: items.length,
      outputCount: result.length,
      filters: {
        sources: filters.sources.length,
        statuses: filters.statuses.length,
        products: filters.products.length,
        query: query.length > 0
      }
    });
  }

  return result;
};
