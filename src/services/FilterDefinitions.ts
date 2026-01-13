import type { ReleaseSource } from '../models/ReleaseItem';

export const ALL_RELEASE_SOURCES: ReleaseSource[] = ['Microsoft', 'EOS'];

export const RELEASE_SOURCE_LABELS: Record<ReleaseSource, string> = {
  Microsoft: 'Microsoft Release Plans',
  EOS: 'EOS Apps'
};

export type SourceKey = 'microsoft' | 'eos';
export type FilterKey =
  | 'status'
  | 'wave'
  | 'categories'
  | 'geography'
  | 'enabledFor'
  | 'availabilityType'
  | 'releaseDateRange'
  | 'periodNewDays'
  | 'periodChangedDays'
  | 'releaseInDays'
  | 'bcMinVersion'
  | 'productOrApp'
  | 'months'
  | 'tags'
  | 'language'
  | 'query'
  | 'sortOrder'
  | 'historyMonths'
  | 'horizonMonths';

export const FILTER_CAPABILITIES: Record<SourceKey, FilterKey[]> = {
  microsoft: [
    'status',
    'wave',
    'categories',
    'geography',
    'enabledFor',
    'availabilityType',
    'releaseDateRange',
    'periodNewDays',
    'periodChangedDays',
    'releaseInDays',
    'productOrApp',
    'months',
    'tags',
    'language',
    'query',
    'sortOrder',
    'historyMonths',
    'horizonMonths'
  ],
  eos: [
    'status',
    'categories',
    'geography',
    'releaseDateRange',
    'periodNewDays',
    'periodChangedDays',
    'releaseInDays',
    'bcMinVersion',
    'productOrApp',
    'months',
    'tags',
    'language',
    'query',
    'sortOrder',
    'historyMonths',
    'horizonMonths'
  ]
};

export const toSourceKey = (source: ReleaseSource): SourceKey =>
  source === 'Microsoft' ? 'microsoft' : 'eos';

export const isFilterSupported = (source: ReleaseSource, key: FilterKey): boolean =>
  FILTER_CAPABILITIES[toSourceKey(source)].includes(key);

export const getSupportedSourcesForFilter = (key: FilterKey): ReleaseSource[] => {
  const supported: ReleaseSource[] = [];
  (Object.keys(FILTER_CAPABILITIES) as SourceKey[]).forEach((sourceKey) => {
    if (FILTER_CAPABILITIES[sourceKey].includes(key)) {
      supported.push(sourceKey === 'microsoft' ? 'Microsoft' : 'EOS');
    }
  });
  return supported;
};

export const getActiveSupportedSources = (
  activeSources: ReleaseSource[],
  key: FilterKey
): ReleaseSource[] => {
  const supported = getSupportedSourcesForFilter(key);
  return supported.filter((source) => activeSources.includes(source));
};

export const resolveActiveSources = (sources?: ReleaseSource[]): ReleaseSource[] => {
  if (!sources || sources.length === 0) {
    return ALL_RELEASE_SOURCES;
  }
  return sources;
};
