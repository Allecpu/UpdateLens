import type { ReleaseSource } from '../models/ReleaseItem';

export const ALL_RELEASE_SOURCES: ReleaseSource[] = ['Microsoft', 'EOS', 'Fabric'];

export const RELEASE_SOURCE_LABELS: Record<ReleaseSource, string> = {
  Microsoft: 'Microsoft Release Plans',
  EOS: 'EOS Apps',
  Fabric: 'Microsoft Fabric Roadmap'
};

export type SourceKey = 'microsoft' | 'eos' | 'fabric';
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
  ],
  fabric: [
    'status',
    'categories',
    'productOrApp',
    'availabilityType',
    'releaseDateRange',
    'periodNewDays',
    'periodChangedDays',
    'releaseInDays',
    'months',
    'tags',
    'query',
    'sortOrder',
    'historyMonths',
    'horizonMonths'
  ]
};

export const toSourceKey = (source: ReleaseSource): SourceKey => {
  if (source === 'Microsoft') return 'microsoft';
  if (source === 'EOS') return 'eos';
  return 'fabric';
};

export const isFilterSupported = (source: ReleaseSource, key: FilterKey): boolean =>
  FILTER_CAPABILITIES[toSourceKey(source)].includes(key);

export const getSupportedSourcesForFilter = (key: FilterKey): ReleaseSource[] => {
  const supported: ReleaseSource[] = [];
  (Object.keys(FILTER_CAPABILITIES) as SourceKey[]).forEach((sourceKey) => {
    if (FILTER_CAPABILITIES[sourceKey].includes(key)) {
      if (sourceKey === 'microsoft') supported.push('Microsoft');
      else if (sourceKey === 'eos') supported.push('EOS');
      else supported.push('Fabric');
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
