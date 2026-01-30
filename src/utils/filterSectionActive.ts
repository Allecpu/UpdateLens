import type { FilterState } from '../models/Filters';

/**
 * Section key type that maps to filter sections in the sidebar.
 * Each section key corresponds to one or more filter fields in FilterState.
 */
export type FilterSectionKey =
  | 'products'
  | 'microsoftProducts'
  | 'eosProducts'
  | 'fabricProducts'
  | 'm365Products'
  | 'status'
  | 'bcVersion'
  | 'months'
  | 'tags'
  | 'categories'
  | 'waves'
  | 'availabilityType'
  | 'enabledFor'
  | 'geography'
  | 'language'
  | 'periods'
  | 'query'
  | 'ownerCss'
  | 'targetCustomers'
  | 'targetGroups'
  | 'timeHorizon';

/**
 * Default values for filters. A filter is considered "active" if its value
 * differs from the default.
 */
const DEFAULT_VALUES = {
  periodNewDays: 0,
  periodChangedDays: 0,
  releaseInDays: 0,
  horizonMonths: 12,
  historyMonths: 12
} as const;

/**
 * Checks if an array filter is active (has at least one selected value).
 */
const isArrayActive = (arr: string[] | undefined | null): boolean => {
  return Array.isArray(arr) && arr.length > 0;
};

/**
 * Checks if a numeric filter is active (differs from its default value).
 */
const isNumberActive = (
  value: number | undefined | null,
  defaultValue: number
): boolean => {
  return value !== undefined && value !== null && value !== defaultValue;
};

/**
 * Checks if a string filter is active (non-empty).
 */
const isStringActive = (value: string | undefined | null): boolean => {
  return value !== undefined && value !== null && value.trim() !== '';
};

/**
 * Determines if a filter section has at least one active filter.
 *
 * A section is considered "active" if any of its associated filters
 * have a value different from the default (empty array, 0, empty string, etc.).
 *
 * @param sectionKey - The section identifier
 * @param filters - The current filter state
 * @param productSourceMap - Optional map to check source-specific products
 * @returns true if the section has at least one active filter
 *
 * @example
 * ```ts
 * const isActive = isSectionActive('status', filters);
 * // Returns true if filters.statuses has any selected values
 * ```
 */
export function isSectionActive(
  sectionKey: FilterSectionKey,
  filters: FilterState | null | undefined,
  productSourceMap?: Map<string, string>
): boolean {
  if (!filters) return false;

  switch (sectionKey) {
    // Single-source product sections
    case 'products':
      return isArrayActive(filters.products);

    case 'microsoftProducts':
      if (!productSourceMap) return isArrayActive(filters.products);
      return (filters.products ?? []).some(
        (p) => productSourceMap.get(p) === 'Microsoft'
      );

    case 'eosProducts':
      if (!productSourceMap) return isArrayActive(filters.products);
      return (filters.products ?? []).some(
        (p) => productSourceMap.get(p) === 'EOS'
      );

    case 'fabricProducts':
      if (!productSourceMap) return isArrayActive(filters.products);
      return (filters.products ?? []).some(
        (p) => productSourceMap.get(p) === 'Fabric'
      );

    case 'm365Products':
      if (!productSourceMap) return isArrayActive(filters.products);
      return (filters.products ?? []).some(
        (p) => productSourceMap.get(p) === 'MICROSOFT 365'
      );

    // Simple array sections
    case 'status':
      return isArrayActive(filters.statuses);

    case 'bcVersion':
      return isArrayActive(filters.bcVersions);

    case 'months':
      return isArrayActive(filters.months);

    case 'tags':
      return isArrayActive(filters.tags);

    case 'categories':
      return isArrayActive(filters.categories);

    case 'waves':
      return isArrayActive(filters.waves);

    case 'availabilityType':
      return isArrayActive(filters.availabilityTypes);

    case 'enabledFor':
      return isArrayActive(filters.enabledFor);

    case 'geography':
      return isArrayActive(filters.geography);

    case 'language':
      return isArrayActive(filters.language);

    // Periods section - combines multiple filters
    case 'periods':
      return (
        isNumberActive(filters.periodNewDays, DEFAULT_VALUES.periodNewDays) ||
        isNumberActive(filters.periodChangedDays, DEFAULT_VALUES.periodChangedDays) ||
        isNumberActive(filters.releaseInDays, DEFAULT_VALUES.releaseInDays) ||
        isStringActive(filters.releaseDateFrom) ||
        isStringActive(filters.releaseDateTo)
      );

    // Query/search section
    case 'query':
      return isStringActive(filters.query);

    // Targeting sections
    case 'ownerCss':
      return isArrayActive(filters.targetCssOwners);

    case 'targetCustomers':
      return isArrayActive(filters.targetCustomerIds);

    case 'targetGroups':
      return isArrayActive(filters.targetGroupIds);

    // Time horizon section - active when not in "all" (no restriction) mode
    case 'timeHorizon':
      return (
        (filters.historyMonths !== undefined && filters.historyMonths < 999) ||
        (filters.horizonMonths !== undefined && filters.horizonMonths < 999)
      );

    default:
      return false;
  }
}

/**
 * Checks if any filter in the "Avanzati" (Advanced) section group is active.
 * This is used to show the indicator on the parent "Avanzati" collapsible section.
 */
export function isAdvancedSectionActive(
  filters: FilterState | null | undefined
): boolean {
  if (!filters) return false;

  return (
    isSectionActive('categories', filters) ||
    isSectionActive('waves', filters) ||
    isSectionActive('availabilityType', filters) ||
    isSectionActive('enabledFor', filters) ||
    isSectionActive('geography', filters) ||
    isSectionActive('language', filters) ||
    isSectionActive('periods', filters) ||
    isSectionActive('timeHorizon', filters)
  );
}
