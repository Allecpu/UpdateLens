import type { FilterState } from '../models/Filters';
import type { ReleaseSource } from '../models/ReleaseItem';
import { type FilterMetadata, normalizeProductLabel } from './FilterMetadata';

export type NormalizationContext = {
  sourceOptions: string[];
  metadata: FilterMetadata;
  productSourceMap: Map<string, ReleaseSource>;
  productsBySource: Map<ReleaseSource, string[]>;
};

/**
 * Normalize a selection array.
 * CRITICAL: Empty values array means "no filter" → return empty (filter won't apply).
 * This matches GlobalFiltersPage behavior where empty = no restriction.
 */
const normalizeSelection = (values: string[], options: string[]): string[] => {
  // Empty values = "no filter" (don't restrict by this field)
  if (values.length === 0) {
    return [];
  }
  // No options available = return empty (nothing to select from)
  if (options.length === 0) {
    return [];
  }
  // Keep only valid values; if all invalid, return all options as fallback
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
  // Use NORMALIZED product names as keys for consistent filtering
  const productSourceMap = new Map<string, ReleaseSource>();
  const productsBySource = new Map<ReleaseSource, string[]>();

  items.forEach((item) => {
    const normalizedName = normalizeProductLabel(item.productName);
    if (!normalizedName) return;

    if (!productSourceMap.has(normalizedName)) {
      productSourceMap.set(normalizedName, item.source);
    }
    const list = productsBySource.get(item.source) ?? [];
    if (!list.includes(normalizedName)) {
      list.push(normalizedName);
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

export type FilterMode = 'inherit' | 'custom';

/**
 * SINGLE SOURCE OF TRUTH for effective persistent filters.
 * Used by BOTH GlobalFiltersPage and DashboardPage.
 *
 * Logic:
 * - If no activeCustomerId ("Tutti clienti"): use normalized cssFilters
 * - If activeCustomerId with mode 'custom' and override exists: use normalized customerFilters[id]
 * - Otherwise: use normalized cssFilters (inherit mode)
 */
export const selectEffectiveFilters = (
  activeCustomerId: string | null,
  cssFilters: FilterState | null,
  customerFilters: Record<string, FilterState>,
  customerFilterMode: Record<string, FilterMode>,
  defaultFilters: FilterState,
  normContext: NormalizationContext
): FilterState => {
  // Normalize global filters first
  const normalizedGlobal = normalizeFilters(cssFilters, defaultFilters, normContext);

  // No customer selected -> use global
  if (!activeCustomerId) {
    return normalizedGlobal;
  }

  // Check customer mode
  const mode = customerFilterMode[activeCustomerId] ?? 'inherit';
  if (mode === 'inherit') {
    return normalizedGlobal;
  }

  // Custom mode - check if override exists
  const customerOverride = customerFilters[activeCustomerId];
  if (!customerOverride) {
    return normalizedGlobal;
  }

  // Use customer override
  return normalizeFilters(customerOverride, defaultFilters, normContext);
};

/**
 * Strip customer-targeting fields for Dashboard filtering.
 * Dashboard shows ALL items matching filters, not scoped to specific customers.
 */
export const stripTargetingFields = (filters: FilterState): FilterState => ({
  ...filters,
  targetCustomerIds: [],
  targetGroupIds: [],
  targetCssOwners: []
});

