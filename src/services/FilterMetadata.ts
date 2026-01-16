import type { ReleaseItem, ReleaseSource } from '../models/ReleaseItem';
import { extractCountriesFromHtml } from '../utils/geography';

export type FilterOption = {
  value: string;
  label?: string;
  count: number;
  sources: ReleaseSource[];
};

/**
 * Normalize a product label for display.
 * - Removes markdown links: [text](url) → text
 * - Removes standalone URLs
 * - Trims whitespace
 * - Converts to Title Case
 */
export const normalizeProductLabel = (raw: string): string => {
  if (!raw) return '';

  let label = raw;

  // Remove markdown links: [text](url) → text
  label = label.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove standalone URLs (http/https)
  label = label.replace(/https?:\/\/[^\s]+/gi, '');

  // Remove any remaining brackets
  label = label.replace(/[[\]()]/g, '');

  // Trim and collapse whitespace
  label = label.trim().replace(/\s+/g, ' ');

  // Convert to Title Case (each word capitalized)
  label = label
    .toLowerCase()
    .split(' ')
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');

  return label;
};

/**
 * Create a case-insensitive key for deduplication.
 */
const normalizedKey = (label: string): string => label.toLowerCase().trim();

/**
 * Count product values with normalization and deduplication.
 * Products with the same normalized label are merged.
 *
 * IMPORTANT: Uses normalized label as `value` for consistent filtering.
 * FilterService must also normalize item.productName when comparing.
 */
const countProductsWithNormalization = (
  items: ReleaseItem[]
): FilterOption[] => {
  // Map: normalizedKey → { label, count, sources }
  const groups = new Map<
    string,
    {
      label: string;
      count: number;
      sources: Set<ReleaseSource>;
    }
  >();

  items.forEach((item) => {
    const rawValue = item.productName;
    if (!rawValue) return;

    const label = normalizeProductLabel(rawValue);
    const key = normalizedKey(label);
    if (!key) return;

    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.sources.add(item.source);
    } else {
      groups.set(key, {
        label,
        count: 1,
        sources: new Set([item.source])
      });
    }
  });

  return Array.from(groups.values())
    .map((group) => ({
      value: group.label, // Use normalized label as value for filtering
      label: group.label,
      count: group.count,
      sources: Array.from(group.sources)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
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
    products: countProductsWithNormalization(items), // Use normalized/deduplicated products
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
