import type { ReleaseItem } from '../models/ReleaseItem';
import type { ReleaseSource } from '../models/ReleaseItem';
import type { FilterState } from '../models/Filters';
import { isFilterSupported } from './FilterDefinitions';
import { extractCountriesFromHtml } from '../utils/geography';

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

const withinLastDays = (date: Date | null, days: number): boolean => {
  if (!date) {
    return false;
  }
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return date >= cutoff && date <= now;
};

export const filterReleaseItems = (
  items: ReleaseItem[],
  filters: FilterState
): ReleaseItem[] => {
  const now = new Date();
  const horizon = addMonths(now, filters.horizonMonths);
  const historyLimit = addMonths(now, -filters.historyMonths);
  const query = filters.query.trim().toLowerCase();
  const releaseDateFrom = parseDateAny(filters.releaseDateFrom);
  const releaseDateTo = parseDateAny(filters.releaseDateTo);
  const productSourceMap = new Map<string, ReleaseSource>();
  items.forEach((item) => {
    if (!productSourceMap.has(item.productName)) {
      productSourceMap.set(item.productName, item.source);
    }
  });

  return items.filter((item) => {
    if (filters.sources.length && !filters.sources.includes(item.source)) {
      return false;
    }

    if (
      isFilterSupported(item.source, 'status') &&
      filters.statuses.length &&
      !filters.statuses.includes(item.status)
    ) {
      return false;
    }

    if (isFilterSupported(item.source, 'productOrApp') && filters.products.length) {
      const hasProductForSource = filters.products.some(
        (product) => productSourceMap.get(product) === item.source
      );
      if (hasProductForSource && !filters.products.includes(item.productName)) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'categories') && filters.categories.length) {
      if (!item.category || !filters.categories.includes(item.category)) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'wave') && filters.waves.length) {
      if (!item.wave || !filters.waves.includes(item.wave)) {
        return false;
      }
    }

    if (
      isFilterSupported(item.source, 'availabilityType') &&
      filters.availabilityTypes.length
    ) {
      const types = item.availabilityTypes ?? [];
      const hasType = filters.availabilityTypes.some((type) => types.includes(type));
      if (!hasType) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'enabledFor') && filters.enabledFor.length) {
      if (!item.enabledFor || !filters.enabledFor.includes(item.enabledFor)) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'geography') && filters.geography.length) {
      const geographyValues =
        item.geographyCountries && item.geographyCountries.length > 0
          ? item.geographyCountries
          : extractCountriesFromHtml(item.geography ?? '');
      const hasGeography = filters.geography.some((geo) => geographyValues.includes(geo));
      if (!hasGeography) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'language') && filters.language.length) {
      if (!item.language || !filters.language.includes(item.language)) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'bcMinVersion') && filters.minBcVersionMin !== null) {
      if (item.minBcVersion != null && item.minBcVersion < filters.minBcVersionMin) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'tags') && filters.tags.length) {
      const tags = item.tags ?? [];
      const hasTag = filters.tags.some((tag) => tags.includes(tag));
      if (!hasTag) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'months') && filters.months.length) {
      if (!filters.months.includes(item.availabilityDate)) {
        return false;
      }
    }

    const itemDate = toMonthDate(item.availabilityDate);
    if (itemDate && itemDate > horizon) {
      return false;
    }
    if (itemDate && itemDate < historyLimit) {
      return false;
    }

    if (isFilterSupported(item.source, 'periodNewDays') && filters.periodNewDays > 0) {
      const firstDate = parseDateAny(item.releaseDate);
      if (!withinLastDays(firstDate, filters.periodNewDays)) {
        return false;
      }
    }

    if (
      isFilterSupported(item.source, 'periodChangedDays') &&
      filters.periodChangedDays > 0
    ) {
      const updated = parseDateAny(item.lastUpdatedDate) ?? parseDateAny(item.releaseDate);
      if (!withinLastDays(updated, filters.periodChangedDays)) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'releaseInDays') && filters.releaseInDays > 0) {
      const releaseDate = parseDateAny(item.releaseDate);
      if (!releaseDate) {
        return false;
      }
      const now = new Date();
      const limit = new Date(now.getTime() + filters.releaseInDays * 24 * 60 * 60 * 1000);
      if (releaseDate < now || releaseDate > limit) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'releaseDateRange') && releaseDateFrom) {
      const releaseDate = parseDateAny(item.releaseDate);
      if (!releaseDate || releaseDate < releaseDateFrom) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'releaseDateRange') && releaseDateTo) {
      const releaseDate = parseDateAny(item.releaseDate);
      if (!releaseDate || releaseDate > releaseDateTo) {
        return false;
      }
    }

    if (isFilterSupported(item.source, 'query') && query) {
      const haystack =
        `${item.title} ${item.description} ${item.productName}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });
};
