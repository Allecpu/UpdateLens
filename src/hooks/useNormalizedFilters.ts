import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FilterState } from '../models/Filters';
import type { FilterMetadata } from '../services/FilterMetadata';
import type { ReleaseItem } from '../models/ReleaseItem';
import {
  buildNormalizationContext,
  createDefaultFilters,
  normalizeFilters,
  type NormalizationContext
} from '../services/FilterNormalization';
import { useFilterStore } from '../app/store/useFilterStore';

type UseNormalizedFiltersParams = {
  items: ReleaseItem[];
  metadata: FilterMetadata;
  sourceOptions: string[];
  statusOptions: string[];
  productOptions: string[];
  rulesDefaults: {
    horizonMonths: number;
    historyMonths: number;
  };
};

type UseNormalizedFiltersResult = {
  normContext: NormalizationContext;
  defaultFilters: FilterState;
  normalizeRaw: (raw: FilterState) => FilterState;
  normalizedGlobal: FilterState;
  currentFilters: FilterState;
  contextReady: boolean;
};

export const useNormalizedFilters = (
  params: UseNormalizedFiltersParams,
  filterScope: 'global' | 'customer',
  activeCustomerId: string | null
): UseNormalizedFiltersResult => {
  const {
    items,
    metadata,
    sourceOptions,
    statusOptions,
    productOptions,
    rulesDefaults
  } = params;

  const {
    cssFilters,
    customerFilters,
    customerFilterMode
  } = useFilterStore();

  const normContext = useMemo(
    () => buildNormalizationContext(items, metadata, sourceOptions),
    [items, metadata, sourceOptions]
  );

  const contextReady =
    normContext.sourceOptions.length > 0 && metadata.products.length > 0;

  const defaultFilters = useMemo(
    () =>
      createDefaultFilters(
        productOptions,
        sourceOptions,
        statusOptions,
        rulesDefaults.horizonMonths,
        rulesDefaults.historyMonths
      ),
    [productOptions, sourceOptions, statusOptions, rulesDefaults.horizonMonths, rulesDefaults.historyMonths]
  );

  // WeakMap cache for normalizeRaw
  const cacheRef = useRef(new WeakMap<FilterState, FilterState>());

  const normalizeRaw = useCallback(
    (raw: FilterState): FilterState => {
      const cached = cacheRef.current.get(raw);
      if (cached) return cached;
      const result = normalizeFilters(raw, defaultFilters, normContext);
      cacheRef.current.set(raw, result);
      return result;
    },
    [defaultFilters, normContext]
  );

  // Invalidate cache when dependencies change
  useEffect(() => {
    cacheRef.current = new WeakMap();
  }, [normalizeRaw]);

  const normalizedGlobal = useMemo(() => {
    if (!cssFilters) return defaultFilters;
    return normalizeRaw(cssFilters);
  }, [cssFilters, defaultFilters, normalizeRaw]);

  const currentFilters = useMemo(() => {
    if (filterScope === 'customer' && activeCustomerId) {
      const activeMode = customerFilterMode[activeCustomerId] ?? 'inherit';
      const activeFilters = customerFilters[activeCustomerId];
      if (activeMode === 'custom' && activeFilters) {
        return normalizeRaw(activeFilters);
      }
      return normalizedGlobal;
    }
    return normalizedGlobal;
  }, [
    filterScope,
    activeCustomerId,
    customerFilterMode,
    customerFilters,
    normalizedGlobal,
    normalizeRaw
  ]);

  return {
    normContext,
    defaultFilters,
    normalizeRaw,
    normalizedGlobal,
    currentFilters,
    contextReady
  };
};
