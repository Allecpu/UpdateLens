import type { ReleaseItem, ReleaseSource } from '../models/ReleaseItem';
import { extractCountriesFromHtml } from '../utils/geography';

export type FilterOption = {
  value: string;
  label?: string;
  count: number;
  sources: ReleaseSource[];
};

export type FilterMetadata = {
  sources: FilterOption[];
  products: FilterOption[];
  statuses: FilterOption[];
  categories: FilterOption[];
  tags: FilterOption[];
  waves: FilterOption[];
  months: FilterOption[];
  availabilityTypes: FilterOption[];
  enabledFor: FilterOption[];
  geography: FilterOption[];
  language: FilterOption[];
};

const countValues = (
  items: ReleaseItem[],
  extractValues: (item: ReleaseItem) => string[]
): FilterOption[] => {
  const counts = new Map<string, { count: number; sources: Set<ReleaseSource> }>();
  items.forEach((item) => {
    extractValues(item).forEach((value) => {
      if (!value) {
        return;
      }
      const entry = counts.get(value) ?? { count: 0, sources: new Set<ReleaseSource>() };
      entry.count += 1;
      entry.sources.add(item.source);
      counts.set(value, entry);
    });
  });
  return Array.from(counts.entries())
    .map(([value, entry]) => ({
      value,
      count: entry.count,
      sources: Array.from(entry.sources)
    }))
    .sort((a, b) => a.value.localeCompare(b.value));
};

const sortMonthsDesc = (
  items: ReleaseItem[],
  extractValues: (item: ReleaseItem) => string[]
): FilterOption[] => {
  const counts = new Map<string, { count: number; sources: Set<ReleaseSource> }>();
  items.forEach((item) => {
    extractValues(item).forEach((value) => {
      if (!value) {
        return;
      }
      const entry = counts.get(value) ?? { count: 0, sources: new Set<ReleaseSource>() };
      entry.count += 1;
      entry.sources.add(item.source);
      counts.set(value, entry);
    });
  });
  return Array.from(counts.entries())
    .map(([value, entry]) => ({
      value,
      count: entry.count,
      sources: Array.from(entry.sources)
    }))
    .sort((a, b) => b.value.localeCompare(a.value));
};

export const buildFilterMetadata = (items: ReleaseItem[]): FilterMetadata => {
  return {
    sources: countValues(items, (item) => [item.source]),
    products: countValues(items, (item) => [item.productName]),
    statuses: countValues(items, (item) => [item.status]),
    categories: countValues(items, (item) => [item.category ?? '']),
    tags: countValues(items, (item) => item.tags ?? []),
    waves: countValues(items, (item) => [item.wave ?? '']),
    months: sortMonthsDesc(items, (item) => [item.availabilityDate]),
    availabilityTypes: countValues(items, (item) => item.availabilityTypes ?? []),
    enabledFor: countValues(items, (item) => [item.enabledFor ?? '']),
    geography: countValues(items, (item) => {
      if (item.geographyCountries && item.geographyCountries.length > 0) {
        return item.geographyCountries;
      }
      return extractCountriesFromHtml(item.geography ?? '');
    }),
    language: countValues(items, (item) => [item.language ?? ''])
  };
};
