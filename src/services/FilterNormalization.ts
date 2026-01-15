import type { FilterState } from '../models/Filters';
import type { ReleaseSource } from '../models/ReleaseItem';
import type { FilterMetadata } from './FilterMetadata';

export type NormalizationContext = {
  sourceOptions: string[];
  metadata: FilterMetadata;
  productSourceMap: Map<string, ReleaseSource>;
  productsBySource: Map<ReleaseSource, string[]>;
};

const normalizeSelection = (values: string[], options: string[]): string[] => {
  if (values.length === 0 || options.length === 0) {
    return options;
  }
  const valid = values.filter((value) => options.includes(value));
  return valid.length > 0 ? valid : options;
};

const optionValuesForSources = (
  options: { value: string; sources: ReleaseSource[] }[],
  sources: ReleaseSource[],
  matchAllSources: boolean
): string[] => {
  if (options.length === 0 || sources.length === 0) {
    return [];
  }
  return options
    .filter((option) =>
      matchAllSources
        ? sources.every((source) => option.sources.includes(source))
        : option.sources.some((source) => sources.includes(source))
    )
    .map((option) => option.value);
};

const normalizeSelectionForSources = (
  values: string[],
  options: { value: string; sources: ReleaseSource[] }[],
  sources: ReleaseSource[],
  matchAllSources: boolean
): string[] => {
  const available = optionValuesForSources(options, sources, matchAllSources);
  return normalizeSelection(values, available);
};

export const normalizeFilters = (
  raw: FilterState | null,
  defaults: FilterState,
  context: NormalizationContext
): FilterState => {
  if (!raw) {
    return defaults;
  }

  const { sourceOptions, metadata, productSourceMap, productsBySource } = context;
  const merged = { ...defaults, ...raw };
  const matchAllSources = false;

  // Guard: If context is not ready, skip normalization to prevent data loss
  if (
    context.sourceOptions.length === 0 ||
    context.metadata.products.length === 0
  ) {
    console.log('[FilterDebug] SKIP_NOT_READY', {
      result: 'No-op (data not ready)',
      sourcesReady: context.sourceOptions.length,
      productsReady: context.metadata.products.length
    });
    return merged;
  }

  // Normalize sources first - this determines what other options are available
  const sources = normalizeSelection(merged.sources, sourceOptions) as ReleaseSource[];

  // Normalize products with source awareness
  const productSelection = normalizeSelectionForSources(
    merged.products,
    metadata.products,
    sources,
    matchAllSources
  );

  // Expand products to include at least one product per active source
  const expandedProducts = new Set(productSelection);
  sources.forEach((source) => {
    const hasProduct = productSelection.some(
      (product) => productSourceMap.get(product) === source
    );
    if (!hasProduct) {
      (productsBySource.get(source) ?? []).forEach((product) =>
        expandedProducts.add(product)
      );
    }
  });

  return {
    ...merged,
    products: Array.from(expandedProducts),
    sources,
    statuses: normalizeSelectionForSources(
      merged.statuses,
      metadata.statuses,
      sources,
      matchAllSources
    ),
    categories: normalizeSelectionForSources(
      merged.categories,
      metadata.categories,
      sources,
      matchAllSources
    ),
    tags: normalizeSelectionForSources(
      merged.tags,
      metadata.tags,
      sources,
      matchAllSources
    ),
    waves: normalizeSelectionForSources(
      merged.waves,
      metadata.waves,
      sources,
      matchAllSources
    ),
    months: normalizeSelectionForSources(
      merged.months,
      metadata.months,
      sources,
      matchAllSources
    ),
    availabilityTypes: normalizeSelectionForSources(
      merged.availabilityTypes,
      metadata.availabilityTypes,
      sources,
      matchAllSources
    ),
    enabledFor: normalizeSelectionForSources(
      merged.enabledFor,
      metadata.enabledFor,
      sources,
      matchAllSources
    ),
    geography: normalizeSelectionForSources(
      merged.geography,
      metadata.geography,
      sources,
      matchAllSources
    ),
    language: normalizeSelectionForSources(
      merged.language,
      metadata.language,
      sources,
      matchAllSources
    )
  };
};

export const createDefaultFilters = (
  productOptions: string[],
  sourceOptions: string[],
  statusOptions: string[],
  horizonMonths: number,
  historyMonths: number
): FilterState => ({
  targetCustomerIds: [],
  targetGroupIds: [],
  targetCssOwners: [],
  products: productOptions,
  sources: sourceOptions,
  statuses: statusOptions,
  categories: [],
  tags: [],
  waves: [],
  months: [],
  availabilityTypes: [],
  enabledFor: [],
  geography: [],
  language: [],
  periodNewDays: 0,
  periodChangedDays: 0,
  releaseInDays: 0,
  minBcVersionMin: null,
  releaseDateFrom: '',
  releaseDateTo: '',
  sortOrder: 'newest',
  query: '',
  horizonMonths,
  historyMonths
});

export const buildNormalizationContext = (
  items: { productName: string; source: ReleaseSource }[],
  metadata: FilterMetadata,
  sourceOptions: string[]
): NormalizationContext => {
  const productSourceMap = new Map<string, ReleaseSource>();
  const productsBySource = new Map<ReleaseSource, string[]>();

  items.forEach((item) => {
    if (!productSourceMap.has(item.productName)) {
      productSourceMap.set(item.productName, item.source);
    }
    const list = productsBySource.get(item.source) ?? [];
    if (!list.includes(item.productName)) {
      list.push(item.productName);
      productsBySource.set(item.source, list);
    }
  });

  return {
    sourceOptions,
    metadata,
    productSourceMap,
    productsBySource
  };
};
