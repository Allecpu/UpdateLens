import type { ReleaseItem, ReleaseSource } from '../models/ReleaseItem';
import { extractCountriesFromHtml } from '../utils/geography';

export type FilterOption = {
  value: string;
  label?: string;
  description?: string;
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
 * Normalize availability type values.
 * Maps "GA" to "General Availability" for consistent filtering and display.
 */
export const normalizeAvailabilityType = (raw: string): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Map "GA" to "General Availability"
  if (trimmed === 'GA') {
    return 'General Availability';
  }
  return trimmed;
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
    const rawValue = item.productName || item.product;
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
  extractValues: (item: ReleaseItem) => string[],
  normalizeValue?: (value: string) => string
): FilterOption[] => {
  const counts = new Map<string, { count: number; sources: Set<ReleaseSource> }>();
  items.forEach((item) => {
    extractValues(item).forEach((value) => {
      if (!value) {
        return;
      }
      // Apply normalization if provided
      const normalizedValue = normalizeValue ? normalizeValue(value) : value;
      if (!normalizedValue) {
        return;
      }
      const entry = counts.get(normalizedValue) ?? { count: 0, sources: new Set<ReleaseSource>() };
      entry.count += 1;
      entry.sources.add(item.source);
      counts.set(normalizedValue, entry);
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

const parseMonthSortKey = (value: string): number => {
  const match = value.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) {
    return 0;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return 0;
  }
  return year * 100 + month;
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
    .sort((a, b) => {
      const diff = parseMonthSortKey(b.value) - parseMonthSortKey(a.value);
      if (diff !== 0) {
        return diff;
      }
      return b.value.localeCompare(a.value);
    });
};

const parseWaveSortKey = (value: string): number => {
  const normalized = value.toLowerCase();
  const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);
  const waveMatch = normalized.match(/\bwave\s*([12])\b/);
  const year = yearMatch ? Number(yearMatch[0]) : 0;
  const wave = waveMatch ? Number(waveMatch[1]) : 0;
  return year * 10 + wave;
};

const sortWavesDesc = (
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
    .sort((a, b) => {
      const diff = parseWaveSortKey(b.value) - parseWaveSortKey(a.value);
      if (diff !== 0) {
        return diff;
      }
      return b.value.localeCompare(a.value);
    });
};

export const buildFilterMetadata = (items: ReleaseItem[]): FilterMetadata => {
  return {
    sources: countValues(items, (item) => [item.source]),
    products: countProductsWithNormalization(items), // Use normalized/deduplicated products
    statuses: countValues(items, (item) => [item.status]),
    categories: countValues(items, (item) => [item.category ?? '']),
    tags: countValues(items, (item) => item.tags ?? []),
    waves: sortWavesDesc(items, (item) => [item.wave ?? '']),
    months: sortMonthsDesc(items, (item) => [item.availabilityDate]),
    availabilityTypes: countValues(items, (item) => item.availabilityTypes ?? [], normalizeAvailabilityType),
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

const BC_VERSION_LABELS: Record<number, string> = {
  14: 'BC14 - 2019 Wave 1',
  15: 'BC15 - 2019 Wave 2',
  16: 'BC16 - 2020 Wave 1',
  17: 'BC17 - 2020 Wave 2',
  18: 'BC18 - 2021 Wave 1',
  19: 'BC19 - 2021 Wave 2',
  20: 'BC20 - 2022 Wave 1',
  21: 'BC21 - 2022 Wave 2',
  22: 'BC22 - 2023 Wave 1',
  23: 'BC23 - 2023 Wave 2',
  24: 'BC24 - 2024 Wave 1',
  25: 'BC25 - 2024 Wave 2',
  26: 'BC26 - 2025 Wave 1',
  27: 'BC27 - 2025 Wave 2'
};

export const buildBcVersionOptions = (items: { minBcVersion?: number | null }[]): FilterOption[] => {
  const counts = new Map<number, number>();
  items.forEach((item) => {
    if (typeof item.minBcVersion !== 'number') {
      return;
    }
    counts.set(item.minBcVersion, (counts.get(item.minBcVersion) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([value, count]) => ({
      value: String(value),
      label: BC_VERSION_LABELS[value] ?? `BC ${value}`,
      count,
      sources: ['EOS'] as ReleaseSource[]
    }))
    .sort((a, b) => Number(b.value) - Number(a.value));
};
