import type { ReleaseSource } from '../models/ReleaseItem';
import type { FilterKey } from '../services/FilterDefinitions';
import {
  RELEASE_SOURCE_LABELS,
  getActiveSupportedSources,
  getSupportedSourcesForFilter
} from '../services/FilterDefinitions';

/**
 * Get option values filtered by active sources.
 */
export const optionValuesForSources = (
  options: { value: string; sources: ReleaseSource[] }[],
  sources: ReleaseSource[],
  matchAllSources: boolean
): string[] => {
  if (options.length === 0 || sources.length === 0) return [];
  return options
    .filter((option) =>
      matchAllSources
        ? sources.every((source) => option.sources.includes(source))
        : option.sources.some((source) => sources.includes(source))
    )
    .map((option) => option.value);
};

/**
 * Format a source badge label from an array of sources.
 */
export const formatSourceBadge = (sources: ReleaseSource[]): string | undefined => {
  const ordered = (['Microsoft', 'EOS', 'Fabric', 'MICROSOFT 365'] as ReleaseSource[]).filter(
    (source) => sources.includes(source)
  );
  if (ordered.length === 4) return 'Tutte le fonti';
  if (ordered.length === 3)
    return `${RELEASE_SOURCE_LABELS[ordered[0]]} + ${RELEASE_SOURCE_LABELS[ordered[1]]} + ${RELEASE_SOURCE_LABELS[ordered[2]]}`;
  if (ordered.length === 2)
    return `${RELEASE_SOURCE_LABELS[ordered[0]]} + ${RELEASE_SOURCE_LABELS[ordered[1]]}`;
  if (ordered.length === 1) return RELEASE_SOURCE_LABELS[ordered[0]];
  return undefined;
};

/**
 * Get source tag for a filter key, based on active sources.
 */
export const sourceTagFor = (
  activeSources: ReleaseSource[],
  key: FilterKey,
  availableSources?: ReleaseSource[]
): string | undefined => {
  const supported = availableSources ?? getActiveSupportedSources(activeSources, key);
  const activeSupported = supported.filter((source) => activeSources.includes(source));
  if (activeSources.length > 1 && activeSupported.length > 0) {
    return formatSourceBadge(activeSupported);
  }
  return undefined;
};

/**
 * Check if a filter section is visible based on active sources.
 */
export const isFilterVisible = (
  activeSources: ReleaseSource[],
  key: FilterKey
): boolean => {
  if (activeSources.length === 0) {
    return getSupportedSourcesForFilter(key).length > 0;
  }
  return getActiveSupportedSources(activeSources, key).length > 0;
};

/**
 * Check if there are options matching active sources.
 */
export const hasOptionsForSources = (
  options: { value: string; sources: ReleaseSource[] }[],
  activeSources: ReleaseSource[],
  matchAllSources: boolean
): boolean => {
  if (activeSources.length === 0) return options.length > 0;
  return optionValuesForSources(options, activeSources, matchAllSources).length > 0;
};

/**
 * Extract all unique sources from a set of options.
 */
export const sourcesFromOptions = (
  options: { sources: ReleaseSource[] }[]
): ReleaseSource[] => {
  const set = new Set<ReleaseSource>();
  options.forEach((option) => option.sources.forEach((source) => set.add(source)));
  return Array.from(set);
};

/**
 * Split products by source from metadata.
 */
export const splitProductsBySource = <T extends { sources: ReleaseSource[] }>(
  products: T[]
) => ({
  microsoftProducts: products.filter((option) => option.sources.includes('Microsoft')),
  eosProducts: products.filter((option) => option.sources.includes('EOS')),
  fabricProducts: products.filter((option) => option.sources.includes('Fabric')),
  m365RoadmapProducts: products.filter((option) =>
    option.sources.includes('MICROSOFT 365')
  )
});
