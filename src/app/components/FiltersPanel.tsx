import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type React from 'react';
import type { ReleaseSource } from '../../models/ReleaseItem';
import type { FilterState } from '../store/useFilterStore';
import type { FilterMetadata, FilterOption } from '../../services/FilterMetadata';
import type { FilterKey } from '../../services/FilterDefinitions';
import { useDebouncedInput } from '../../hooks/useDebouncedValue';
import {
  usePersistedSectionStates,
  STORAGE_KEYS
} from '../../hooks/usePersistedSectionStates';
import {
  ALL_RELEASE_SOURCES,
  RELEASE_SOURCE_LABELS,
  getActiveSupportedSources,
  getSupportedSourcesForFilter,
  resolveActiveSources
} from '../../services/FilterDefinitions';
import { isSectionActive, isAdvancedSectionActive } from '../../utils/filterSectionActive';
import FilterListSection from './FilterListSection';
import FilterSourceToggle from './FilterSourceToggle';
import TimeHorizonFilter from './TimeHorizonFilter';

export type HideSections = {
  ownerCss?: boolean;
  includedCustomers?: boolean;
  targetCustomers?: boolean;
};

export type FiltersPanelOptions = {
  cssOwnerOptions?: FilterOption[];
  customerOptions?: FilterOption[];
  groupOptions?: FilterOption[];
  minBcVersions?: number[];
  bcVersionOptions?: FilterOption[];
};

type Props = {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  metadata: FilterMetadata;
  options: FiltersPanelOptions;
  hideSections?: HideSections;
  productSourceMap: Map<string, ReleaseSource>;
  // For Owner CSS / Target Customers sections (GlobalFiltersPage only)
  onChangeCssOwnerIds?: (next: string[]) => void;
  onChangeGroupIds?: (next: string[]) => void;
  isOwnerDisabled?: boolean;
  isGroupDisabled?: boolean;
  filterScope?: 'global' | 'customer';
  // Optional: custom header for Owner CSS section
  ownerCssStats?: {
    customersCount: number;
    totalProductsCount: number;
    avgProductsPerCustomer: string;
    overridesCount: number;
  };
  // Customer preview (GlobalFiltersPage only)
  customerPreviewSlot?: React.ReactNode;
  // Layout variant
  variant?: 'full' | 'sidebar';
};

const optionValuesForSources = (
  options: { value: string; sources: ReleaseSource[] }[],
  sources: ReleaseSource[],
  matchAllSources: boolean
): string[] => {
  return options
    .filter((option) =>
      matchAllSources
        ? sources.every((source) => option.sources.includes(source))
        : option.sources.some((source) => sources.includes(source))
    )
    .map((option) => option.value);
};

// Expand/Collapse All button component - defined outside FiltersPanel to prevent
// recreation on every render (which breaks event handlers)
const ExpandCollapseButtons = ({
  onExpandAll,
  onCollapseAll,
  hasCollapsed,
  hasExpanded
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  hasCollapsed: boolean;
  hasExpanded: boolean;
}) => (
  <div className="flex gap-2 text-[11px]">
    {hasCollapsed && (
      <button
        type="button"
        className="text-primary underline"
        onClick={onExpandAll}
      >
        Espandi tutto
      </button>
    )}
    {hasExpanded && (
      <button
        type="button"
        className="text-primary underline"
        onClick={onCollapseAll}
      >
        Comprimi tutto
      </button>
    )}
  </div>
);

const FiltersPanel = ({
  filters,
  onChange,
  metadata,
  options,
  hideSections = {},
  productSourceMap,
  onChangeCssOwnerIds,
  onChangeGroupIds,
  isOwnerDisabled = false,
  isGroupDisabled = false,
  filterScope = 'global',
  ownerCssStats,
  customerPreviewSlot,
  variant = 'full'
}: Props) => {
  // Debounced query input (300ms delay to prevent excessive filtering)
  const [localQuery, setLocalQuery] = useDebouncedInput(
    filters.query ?? '',
    (value) => onChange({ query: value }),
    300
  );
  const {
    cssOwnerOptions = [],
    customerOptions = [],
    groupOptions = [],
    minBcVersions = [],
    bcVersionOptions = []
  } = options;
  const resolvedBcOptions = useMemo(() => {
    if (bcVersionOptions.length > 0) {
      return bcVersionOptions;
    }
    return minBcVersions.map((value) => ({
      value: String(value),
      label: `BC ${value}`,
      description: `Business Central Version ${value}`,
      count: 1,
      sources: ['EOS'] as ReleaseSource[]
    }));
  }, [bcVersionOptions, minBcVersions]);

  const activeSources = resolveActiveSources(
    (filters.sources ?? []) as ReleaseSource[]
  );
  const matchAllSources = false;

  const hasOptionsForSources = (
    opts: { value: string; sources: ReleaseSource[] }[]
  ): boolean => {
    if (activeSources.length === 0) {
      return opts.length > 0;
    }
    return optionValuesForSources(opts, activeSources, matchAllSources).length > 0;
  };

  const sourcesFromOptions = (opts: { sources: ReleaseSource[] }[]): ReleaseSource[] => {
    const set = new Set<ReleaseSource>();
    opts.forEach((option) => option.sources.forEach((source) => set.add(source)));
    return Array.from(set);
  };

  const formatSourceBadge = (sources: ReleaseSource[]): string | undefined => {
    const ordered = (['Microsoft', 'EOS', 'Fabric', 'MICROSOFT 365'] as ReleaseSource[]).filter((source) =>
      sources.includes(source)
    );
    if (ordered.length === 4) {
      return 'Tutte le fonti';
    }
    if (ordered.length === 3) {
      return `${RELEASE_SOURCE_LABELS[ordered[0]]} + ${RELEASE_SOURCE_LABELS[ordered[1]]} + ${RELEASE_SOURCE_LABELS[ordered[2]]}`;
    }
    if (ordered.length === 2) {
      return `${RELEASE_SOURCE_LABELS[ordered[0]]} + ${RELEASE_SOURCE_LABELS[ordered[1]]}`;
    }
    if (ordered.length === 1) {
      return RELEASE_SOURCE_LABELS[ordered[0]];
    }
    return undefined;
  };

  const sourceTagFor = (
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

  const isFilterVisible = (key: FilterKey): boolean => {
    if (activeSources.length === 0) {
      return getSupportedSourcesForFilter(key).length > 0;
    }
    return getActiveSupportedSources(activeSources, key).length > 0;
  };

  const showProductSplit = activeSources.length > 1;
  const microsoftProducts = metadata.products.filter((option) =>
    option.sources.includes('Microsoft')
  );
  const eosProducts = metadata.products.filter((option) => option.sources.includes('EOS'));
  const fabricProducts = metadata.products.filter((option) => option.sources.includes('Fabric'));
  const m365RoadmapProducts = metadata.products.filter((option) =>
    option.sources.includes('MICROSOFT 365')
  );

  const updateProductsForSource = (source: ReleaseSource, next: string[]) => {
    const toKeep = (filters.products ?? []).filter(
      (product) => productSourceMap.get(product) !== source
    );
    const merged = Array.from(new Set([...toKeep, ...next]));
    onChange({ products: merged });
  };

  const isSidebar = variant === 'sidebar';

  // Section open state management for expand/collapse all
  type SectionKey =
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
    | 'avanzati';

  // Default open states based on variant
  const defaultSidebarBaseStates: Record<SectionKey, boolean> = {
    products: false,
    microsoftProducts: false,
    eosProducts: false,
    fabricProducts: false,
    m365Products: false,
    status: true,
    bcVersion: false,
    months: false,
    tags: false,
    categories: false,
    waves: false,
    availabilityType: false,
    enabledFor: false,
    geography: false,
    language: false,
    periods: false,
    avanzati: false
  };

  const defaultSidebarAdvancedStates: Record<SectionKey, boolean> = {
    products: false,
    microsoftProducts: false,
    eosProducts: false,
    fabricProducts: false,
    m365Products: false,
    status: false,
    bcVersion: false,
    months: false,
    tags: false,
    categories: false,
    waves: false,
    availabilityType: false,
    enabledFor: false,
    geography: false,
    language: false,
    periods: false,
    avanzati: false
  };

  // Use persisted states for Dashboard (sidebar variant)
  // Note: FiltersPanel with variant="full" is not currently used standalone,
  // but we provide separate storage keys for future flexibility
  const [baseSectionStates, setBaseSectionStates] = usePersistedSectionStates<Record<SectionKey, boolean>>(
    isSidebar ? STORAGE_KEYS.DASHBOARD_BASE : STORAGE_KEYS.GLOBAL_FILTERS_BASE,
    defaultSidebarBaseStates
  );
  const [advancedSectionStates, setAdvancedSectionStates] = usePersistedSectionStates<Record<SectionKey, boolean>>(
    isSidebar ? STORAGE_KEYS.DASHBOARD_ADVANCED : STORAGE_KEYS.GLOBAL_FILTERS_ADVANCED,
    defaultSidebarAdvancedStates
  );

  // Refs for <details> elements that need programmatic open/close sync
  // (HTML <details> doesn't fully work as a controlled component in React)
  const avanzatiDetailsRef = useRef<HTMLDetailsElement>(null);
  const periodsDetailsRef = useRef<HTMLDetailsElement>(null);
  const periodsDetailsRefFull = useRef<HTMLDetailsElement>(null);

  // Sync <details> elements' open state with React state
  useLayoutEffect(() => {
    if (avanzatiDetailsRef.current) {
      avanzatiDetailsRef.current.open = advancedSectionStates.avanzati;
    }
  }, [advancedSectionStates.avanzati]);

  useLayoutEffect(() => {
    if (periodsDetailsRef.current) {
      periodsDetailsRef.current.open = advancedSectionStates.periods;
    }
    if (periodsDetailsRefFull.current) {
      periodsDetailsRefFull.current.open = advancedSectionStates.periods;
    }
  }, [advancedSectionStates.periods]);

  const toggleBaseSection = useCallback((key: SectionKey, isOpen: boolean) => {
    setBaseSectionStates((prev) => ({ ...prev, [key]: isOpen }));
  }, []);

  const toggleAdvancedSection = useCallback((key: SectionKey, isOpen: boolean) => {
    setAdvancedSectionStates((prev) => ({ ...prev, [key]: isOpen }));
  }, []);

  const expandAllBase = useCallback(() => {
    setBaseSectionStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as SectionKey[]) {
        next[key] = true;
      }
      return next;
    });
  }, []);

  const collapseAllBase = useCallback(() => {
    setBaseSectionStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as SectionKey[]) {
        next[key] = false;
      }
      return next;
    });
  }, []);

  const expandAllAdvanced = useCallback(() => {
    setAdvancedSectionStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as SectionKey[]) {
        next[key] = true;
      }
      return next;
    });
  }, []);

  const collapseAllAdvanced = useCallback(() => {
    setAdvancedSectionStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as SectionKey[]) {
        next[key] = false;
      }
      return next;
    });
  }, []);

  // Check if any section is collapsed (for "Espandi tutto" visibility)
  const hasCollapsedBase = Object.values(baseSectionStates).some((v) => !v);
  const hasExpandedBase = Object.values(baseSectionStates).some((v) => v);
  const hasCollapsedAdvanced = Object.values(advancedSectionStates).some((v) => !v);
  const hasExpandedAdvanced = Object.values(advancedSectionStates).some((v) => v);

  // Sidebar layout (compact)
  if (isSidebar) {
    return (
      <div className="space-y-4">
        {/* Source Toggle */}
        <FilterSourceToggle
          selected={(filters.sources ?? []) as ReleaseSource[]}
          onChange={(next) => onChange({ sources: next })}
        />
        <div className="text-xs text-muted-foreground">
          Attive: {activeSources.map((source) => RELEASE_SOURCE_LABELS[source]).join(', ')}
        </div>

        {/* Base Section Header with Expand/Collapse */}
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Base</span>
          <ExpandCollapseButtons
            onExpandAll={expandAllBase}
            onCollapseAll={collapseAllBase}
            hasCollapsed={hasCollapsedBase}
            hasExpanded={hasExpandedBase}
          />
        </div>

        {/* Search */}
        {isFilterVisible('query') && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Cerca
            </div>
            <input
              className="ul-input mt-2 text-xs"
              placeholder="Cerca aggiornamenti"
              value={localQuery}
              onChange={(event) => setLocalQuery(event.target.value)}
            />
          </div>
        )}

        {/* Products */}
        {isFilterVisible('productOrApp') && hasOptionsForSources(metadata.products) && (
          <>
            {showProductSplit ? (
              <>
                {microsoftProducts.length > 0 && (
                  <FilterListSection
                    title="Prodotti (Microsoft)"
                    options={microsoftProducts}
                    selected={filters.products ?? []}
                    onChange={(next) => updateProductsForSource('Microsoft', next)}
                    activeSources={['Microsoft']}
                    open={baseSectionStates.microsoftProducts}
                    onToggle={(isOpen) => toggleBaseSection('microsoftProducts', isOpen)}
                    isActive={isSectionActive('microsoftProducts', filters, productSourceMap)}
                  />
                )}
                {eosProducts.length > 0 && (
                  <FilterListSection
                    title="App (EOS)"
                    options={eosProducts}
                    selected={filters.products ?? []}
                    onChange={(next) => updateProductsForSource('EOS', next)}
                    activeSources={['EOS']}
                    open={baseSectionStates.eosProducts}
                    onToggle={(isOpen) => toggleBaseSection('eosProducts', isOpen)}
                    isActive={isSectionActive('eosProducts', filters, productSourceMap)}
                  />
                )}
                {fabricProducts.length > 0 && (
                  <FilterListSection
                    title="Workload (Fabric)"
                    options={fabricProducts}
                    selected={filters.products ?? []}
                    onChange={(next) => updateProductsForSource('Fabric', next)}
                    activeSources={['Fabric']}
                    open={baseSectionStates.fabricProducts}
                    onToggle={(isOpen) => toggleBaseSection('fabricProducts', isOpen)}
                    isActive={isSectionActive('fabricProducts', filters, productSourceMap)}
                  />
                )}
                {m365RoadmapProducts.length > 0 && (
                  <FilterListSection
                    title="Prodotti (Microsoft 365)"
                    options={m365RoadmapProducts}
                    selected={filters.products ?? []}
                    onChange={(next) => updateProductsForSource('MICROSOFT 365', next)}
                    activeSources={['MICROSOFT 365']}
                    open={baseSectionStates.m365Products}
                    onToggle={(isOpen) => toggleBaseSection('m365Products', isOpen)}
                    isActive={isSectionActive('m365Products', filters, productSourceMap)}
                  />
                )}
              </>
            ) : (
              <FilterListSection
                title={
                  activeSources[0] === 'EOS' ? 'App' :
                  activeSources[0] === 'Fabric' ? 'Workload' :
                  'Prodotti'
                }
                options={metadata.products}
                selected={filters.products ?? []}
                onChange={(next) => onChange({ products: next })}
                activeSources={activeSources}
                sourceTag={sourceTagFor('productOrApp', sourcesFromOptions(metadata.products))}
                matchAllSources={matchAllSources}
                open={baseSectionStates.products}
                onToggle={(isOpen) => toggleBaseSection('products', isOpen)}
                isActive={isSectionActive('products', filters)}
              />
            )}
          </>
        )}

        {/* Status */}
        {isFilterVisible('status') && hasOptionsForSources(metadata.statuses) && (
          <FilterListSection
            title="Stato"
            options={metadata.statuses}
            selected={filters.statuses ?? []}
            onChange={(next) => onChange({ statuses: next })}
            searchable={false}
            activeSources={activeSources}
            sourceTag={sourceTagFor('status', sourcesFromOptions(metadata.statuses))}
            matchAllSources={matchAllSources}
            open={baseSectionStates.status}
            onToggle={(isOpen) => toggleBaseSection('status', isOpen)}
            isActive={isSectionActive('status', filters)}
          />
        )}

        {/* BC Version */}
        {isFilterVisible('bcMinVersion') && hasOptionsForSources(resolvedBcOptions) && (
          <FilterListSection
            title="BC Version"
            options={resolvedBcOptions}
            selected={filters.bcVersions ?? []}
            onChange={(next) => onChange({ bcVersions: next })}
            activeSources={activeSources}
            sourceTag={sourceTagFor('bcMinVersion', ['EOS'])}
            matchAllSources={matchAllSources}
            maxVisible={12}
            open={baseSectionStates.bcVersion}
            onToggle={(isOpen) => toggleBaseSection('bcVersion', isOpen)}
            isActive={isSectionActive('bcVersion', filters)}
          />
        )}

        {/* Months */}
        {isFilterVisible('months') && hasOptionsForSources(metadata.months) && (
          <FilterListSection
            title="Mese"
            options={metadata.months}
            selected={filters.months ?? []}
            onChange={(next) => onChange({ months: next })}
            searchable={false}
            maxVisible={12}
            activeSources={activeSources}
            sourceTag={sourceTagFor('months', sourcesFromOptions(metadata.months))}
            matchAllSources={matchAllSources}
            open={baseSectionStates.months}
            onToggle={(isOpen) => toggleBaseSection('months', isOpen)}
            isActive={isSectionActive('months', filters)}
          />
        )}

        {/* Tags */}
        {isFilterVisible('tags') && hasOptionsForSources(metadata.tags) && (
          <FilterListSection
            title="Tag"
            options={metadata.tags}
            selected={filters.tags ?? []}
            onChange={(next) => onChange({ tags: next })}
            activeSources={activeSources}
            sourceTag={sourceTagFor('tags', sourcesFromOptions(metadata.tags))}
            matchAllSources={matchAllSources}
            open={baseSectionStates.tags}
            onToggle={(isOpen) => toggleBaseSection('tags', isOpen)}
            isActive={isSectionActive('tags', filters)}
          />
        )}

        {/* Avanzati Section (collapsible) */}
        <details
          ref={avanzatiDetailsRef}
          open={advancedSectionStates.avanzati}
          onToggle={(e) => toggleAdvancedSection('avanzati', (e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className={`cursor-pointer text-xs font-semibold uppercase text-muted-foreground ${
            isAdvancedSectionActive(filters) ? 'marker:text-primary' : ''
          }`}>
            Avanzati
          </summary>
          <div className="mt-2 space-y-3">
            {/* Expand/Collapse All for Advanced sections */}
            <div className="flex justify-end">
              <ExpandCollapseButtons
                onExpandAll={expandAllAdvanced}
                onCollapseAll={collapseAllAdvanced}
                hasCollapsed={hasCollapsedAdvanced}
                hasExpanded={hasExpandedAdvanced}
              />
            </div>

            {/* Categories */}
            {isFilterVisible('categories') && hasOptionsForSources(metadata.categories) && (
              <FilterListSection
                title="Categorie"
                options={metadata.categories}
                selected={filters.categories ?? []}
                onChange={(next) => onChange({ categories: next })}
                activeSources={activeSources}
                sourceTag={sourceTagFor('categories', sourcesFromOptions(metadata.categories))}
                matchAllSources={matchAllSources}
                open={advancedSectionStates.categories}
                onToggle={(isOpen) => toggleAdvancedSection('categories', isOpen)}
                isActive={isSectionActive('categories', filters)}
              />
            )}

            {/* Waves */}
            {isFilterVisible('wave') && hasOptionsForSources(metadata.waves) && (
              <FilterListSection
                title="Wave"
                options={metadata.waves}
                selected={filters.waves ?? []}
                onChange={(next) => onChange({ waves: next })}
                activeSources={activeSources}
                sourceTag={sourceTagFor('wave', sourcesFromOptions(metadata.waves))}
                matchAllSources={matchAllSources}
                open={advancedSectionStates.waves}
                onToggle={(isOpen) => toggleAdvancedSection('waves', isOpen)}
                isActive={isSectionActive('waves', filters)}
              />
            )}

            {/* Availability Type */}
            {isFilterVisible('availabilityType') &&
              hasOptionsForSources(metadata.availabilityTypes) && (
                <FilterListSection
                  title="Availability type"
                  options={metadata.availabilityTypes}
                  selected={filters.availabilityTypes ?? []}
                  onChange={(next) => onChange({ availabilityTypes: next })}
                  activeSources={activeSources}
                  sourceTag={sourceTagFor(
                    'availabilityType',
                    sourcesFromOptions(metadata.availabilityTypes)
                  )}
                  matchAllSources={matchAllSources}
                  open={advancedSectionStates.availabilityType}
                  onToggle={(isOpen) => toggleAdvancedSection('availabilityType', isOpen)}
                  isActive={isSectionActive('availabilityType', filters)}
                />
              )}

            {/* Enabled For */}
            {isFilterVisible('enabledFor') && hasOptionsForSources(metadata.enabledFor) && (
              <FilterListSection
                title="Enabled for"
                options={metadata.enabledFor}
                selected={filters.enabledFor ?? []}
                onChange={(next) => onChange({ enabledFor: next })}
                activeSources={activeSources}
                sourceTag={sourceTagFor('enabledFor', sourcesFromOptions(metadata.enabledFor))}
                matchAllSources={matchAllSources}
                open={advancedSectionStates.enabledFor}
                onToggle={(isOpen) => toggleAdvancedSection('enabledFor', isOpen)}
                isActive={isSectionActive('enabledFor', filters)}
              />
            )}

            {/* Geography */}
            {isFilterVisible('geography') && hasOptionsForSources(metadata.geography) && (
              <FilterListSection
                title="Geografia"
                options={metadata.geography}
                selected={filters.geography ?? []}
                onChange={(next) => onChange({ geography: next })}
                activeSources={activeSources}
                sourceTag={sourceTagFor('geography', sourcesFromOptions(metadata.geography))}
                matchAllSources={matchAllSources}
                open={advancedSectionStates.geography}
                onToggle={(isOpen) => toggleAdvancedSection('geography', isOpen)}
                isActive={isSectionActive('geography', filters)}
              />
            )}

            {/* Language */}
            {isFilterVisible('language') && hasOptionsForSources(metadata.language) && (
              <FilterListSection
                title="Lingua"
                options={metadata.language}
                selected={filters.language ?? []}
                onChange={(next) => onChange({ language: next })}
                activeSources={activeSources}
                sourceTag={sourceTagFor('language', sourcesFromOptions(metadata.language))}
                matchAllSources={matchAllSources}
                open={advancedSectionStates.language}
                onToggle={(isOpen) => toggleAdvancedSection('language', isOpen)}
                isActive={isSectionActive('language', filters)}
              />
            )}
          </div>
        </details>

        {/* Periods */}
        {(isFilterVisible('periodNewDays') ||
          isFilterVisible('periodChangedDays') ||
          isFilterVisible('releaseInDays') ||
          isFilterVisible('releaseDateRange')) && (
          <details
            ref={periodsDetailsRef}
            open={advancedSectionStates.periods}
            onToggle={(e) => {
              e.stopPropagation();
              toggleAdvancedSection('periods', (e.target as HTMLDetailsElement).open);
            }}
          >
            <summary className={`cursor-pointer text-xs uppercase text-muted-foreground ${
              isSectionActive('periods', filters) ? 'marker:text-primary' : ''
            }`}>
              Periodi
              {sourceTagFor('periodNewDays') && (
                <span className="ml-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                  {sourceTagFor('periodNewDays')}
                </span>
              )}
            </summary>
            <div className="mt-2 space-y-3 text-xs">
              {isFilterVisible('periodNewDays') && (
                <label className="flex items-center gap-2 text-muted-foreground">
                  <span className="min-w-[110px]">Nuovi</span>
                  <select
                    className="ul-input text-xs"
                    value={filters.periodNewDays ?? 0}
                    onChange={(event) =>
                      onChange({ periodNewDays: Number(event.target.value) })
                    }
                  >
                    <option value={0}>Tutti</option>
                    <option value={7}>Ultimi 7 giorni</option>
                    <option value={30}>Ultimi 30 giorni</option>
                    <option value={60}>Ultimi 60 giorni</option>
                  </select>
                </label>
              )}
              {isFilterVisible('periodChangedDays') && (
                <label className="flex items-center gap-2 text-muted-foreground">
                  <span className="min-w-[110px]">Modificati</span>
                  <select
                    className="ul-input text-xs"
                    value={filters.periodChangedDays ?? 0}
                    onChange={(event) =>
                      onChange({ periodChangedDays: Number(event.target.value) })
                    }
                  >
                    <option value={0}>Tutti</option>
                    <option value={7}>Ultimi 7 giorni</option>
                    <option value={30}>Ultimi 30 giorni</option>
                    <option value={60}>Ultimi 60 giorni</option>
                  </select>
                </label>
              )}
              {isFilterVisible('releaseInDays') && (
                <label className="flex items-center gap-2 text-muted-foreground">
                  <span className="min-w-[110px]">Release entro</span>
                  <select
                    className="ul-input text-xs"
                    value={filters.releaseInDays ?? 0}
                    onChange={(event) =>
                      onChange({ releaseInDays: Number(event.target.value) })
                    }
                  >
                    <option value={0}>Tutte</option>
                    <option value={7}>7 giorni</option>
                    <option value={14}>14 giorni</option>
                    <option value={30}>30 giorni</option>
                    <option value={60}>60 giorni</option>
                    <option value={90}>90 giorni</option>
                  </select>
                </label>
              )}
              {isFilterVisible('releaseDateRange') && (
                <>
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <span className="min-w-[110px]">Da</span>
                    <input
                      type="date"
                      className="ul-input text-xs"
                      value={filters.releaseDateFrom ?? ''}
                      onChange={(event) =>
                        onChange({ releaseDateFrom: event.target.value })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <span className="min-w-[110px]">A</span>
                    <input
                      type="date"
                      className="ul-input text-xs"
                      value={filters.releaseDateTo ?? ''}
                      onChange={(event) =>
                        onChange({ releaseDateTo: event.target.value })
                      }
                    />
                  </label>
                </>
              )}
            </div>
          </details>
        )}

        {/* Sort Order */}
        {isFilterVisible('sortOrder') && (
          <div>
            <div className="text-xs uppercase text-muted-foreground">Ordinamento</div>
            <select
              className="ul-input mt-2 text-xs"
              value={filters.sortOrder ?? 'newest'}
              onChange={(event) =>
                onChange({ sortOrder: event.target.value as 'newest' | 'oldest' })
              }
            >
              <option value="newest">Dal piu recente</option>
              <option value="oldest">Dal piu vecchio</option>
            </select>
          </div>
        )}

        {/* Orizzonte temporale (Horizon + History) */}
        {isFilterVisible('horizonMonths') && (
          <details className="mt-4">
            <summary className={`cursor-pointer text-xs uppercase text-muted-foreground ${
              isSectionActive('timeHorizon', filters) ? 'marker:text-primary' : ''
            }`}>
              Orizzonte temporale
            </summary>
            <div className="mt-2">
              <TimeHorizonFilter
                historyMonths={filters.historyMonths ?? 12}
                horizonMonths={filters.horizonMonths ?? 12}
                onChange={(values) => onChange(values)}
                compact
              />
            </div>
          </details>
        )}
      </div>
    );
  }

  // Full layout (GlobalFiltersPage style)
  return (
    <div className="space-y-6">
      {/* Owner CSS Section */}
      {!hideSections.ownerCss && cssOwnerOptions.length > 0 && (
        <section className="ul-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Owner CSS</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Seleziona uno o piu Owner CSS per restringere l'impatto sui clienti.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">Scope: CSS</div>
          </div>
          <div className="mt-4">
            <FilterListSection
              title="Owner CSS"
              options={cssOwnerOptions}
              selected={filters.targetCssOwners ?? []}
              onChange={onChangeCssOwnerIds ?? ((next) => onChange({ targetCssOwners: next }))}
              defaultOpen
              activeSources={ALL_RELEASE_SOURCES}
              maxVisible={12}
              disabled={isOwnerDisabled}
              isActive={isSectionActive('ownerCss', filters)}
            />
            {isOwnerDisabled && (
              <div className="mt-2 text-xs text-amber-400">
                {filterScope === 'customer'
                  ? 'Owner CSS non modificabile in modalità Cliente (Overdrive)'
                  : 'Owner CSS disabilitato: è attivo il filtro Gruppi clienti.'}
              </div>
            )}
            <div className="mt-3 text-xs text-muted-foreground">
              Regola combinazione: Owner CSS usa logica OR. Il filtro Gruppi clienti
              è mutuamente esclusivo con Owner CSS.
            </div>
            {ownerCssStats && (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="ul-surface px-3 py-2">
                  <div className="text-xs uppercase text-muted-foreground">Clienti inclusi</div>
                  <div className="mt-1 text-lg font-semibold">
                    {ownerCssStats.customersCount}
                  </div>
                </div>
                <div className="ul-surface px-3 py-2">
                  <div className="text-xs uppercase text-muted-foreground">
                    Prodotti assegnati (totale)
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {ownerCssStats.totalProductsCount}
                  </div>
                  {ownerCssStats.overridesCount > 0 && (
                    <div className="text-[11px] text-muted-foreground">
                      {ownerCssStats.overridesCount} clienti con override
                    </div>
                  )}
                </div>
                <div className="ul-surface px-3 py-2">
                  <div className="text-xs uppercase text-muted-foreground">
                    Media prodotti per cliente
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {ownerCssStats.avgProductsPerCustomer}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Fonte dati: release items filtrati (snapshot)
                  </div>
                </div>
              </div>
            )}
          </div>
          {customerPreviewSlot}
        </section>
      )}

      {/* Target Customers Section */}
      {!hideSections.targetCustomers && (customerOptions.length > 0 || groupOptions.length > 0) && (
        <section className="ul-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Target clienti</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Seleziona clienti o gruppi per limitare il set di destinazione.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">Scope: CSS</div>
          </div>
          <div className="mt-4">
            <FilterListSection
              title="Clienti"
              options={customerOptions}
              selected={filters.targetCustomerIds ?? []}
              onChange={(next) => onChange({ targetCustomerIds: next })}
              defaultOpen
              activeSources={ALL_RELEASE_SOURCES}
              maxVisible={12}
              isActive={isSectionActive('targetCustomers', filters)}
            />
            {groupOptions.length > 0 ? (
              <>
                <FilterListSection
                  title="Gruppi clienti"
                  options={groupOptions}
                  selected={filters.targetGroupIds ?? []}
                  onChange={onChangeGroupIds ?? ((next) => onChange({ targetGroupIds: next }))}
                  defaultOpen
                  activeSources={ALL_RELEASE_SOURCES}
                  maxVisible={12}
                  disabled={isGroupDisabled}
                  isActive={isSectionActive('targetGroups', filters)}
                />
                {isGroupDisabled && (
                  <div className="mt-2 text-xs text-amber-400">
                    {filterScope === 'customer'
                      ? 'Gruppi clienti non modificabili in modalità Cliente (Overdrive)'
                      : 'Gruppi clienti disabilitati: è attivo il filtro Owner CSS.'}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4">
                <div className="text-xs uppercase text-muted-foreground">
                  Gruppi clienti
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Nessun gruppo creato
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Source Toggle Section */}
      <section className="ul-surface p-6">
        <h2 className="text-lg font-semibold">Fonte dati</h2>
        <div className="mt-3 space-y-3">
          <FilterSourceToggle
            selected={(filters.sources ?? []) as ReleaseSource[]}
            onChange={(next) => onChange({ sources: next })}
          />
          <div className="text-xs text-muted-foreground">
            Attive: {activeSources.map((source) => RELEASE_SOURCE_LABELS[source]).join(', ')}
          </div>
        </div>
      </section>

      {/* Base + Advanced Filters */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Base Column */}
        <div className="ul-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Base</h2>
            <ExpandCollapseButtons
              onExpandAll={expandAllBase}
              onCollapseAll={collapseAllBase}
              hasCollapsed={hasCollapsedBase}
              hasExpanded={hasExpandedBase}
            />
          </div>
          {isFilterVisible('status') && hasOptionsForSources(metadata.statuses) && (
            <FilterListSection
              title="Stato"
              options={metadata.statuses}
              selected={filters.statuses ?? []}
              onChange={(next) => onChange({ statuses: next })}
              searchable={false}
              activeSources={activeSources}
              sourceTag={sourceTagFor('status', sourcesFromOptions(metadata.statuses))}
              matchAllSources={matchAllSources}
              open={baseSectionStates.status}
              onToggle={(isOpen) => toggleBaseSection('status', isOpen)}
              isActive={isSectionActive('status', filters)}
            />
          )}
          {isFilterVisible('productOrApp') && hasOptionsForSources(metadata.products) && (
            <>
              {showProductSplit ? (
                <>
                  {microsoftProducts.length > 0 && (
                    <FilterListSection
                      title="Prodotti (Microsoft)"
                      options={microsoftProducts}
                      selected={filters.products ?? []}
                      onChange={(next) => updateProductsForSource('Microsoft', next)}
                      activeSources={['Microsoft']}
                      open={baseSectionStates.microsoftProducts}
                      onToggle={(isOpen) => toggleBaseSection('microsoftProducts', isOpen)}
                      isActive={isSectionActive('microsoftProducts', filters, productSourceMap)}
                    />
                  )}
                  {eosProducts.length > 0 && (
                    <FilterListSection
                      title="App (EOS)"
                      options={eosProducts}
                      selected={filters.products ?? []}
                      onChange={(next) => updateProductsForSource('EOS', next)}
                      activeSources={['EOS']}
                      open={baseSectionStates.eosProducts}
                      onToggle={(isOpen) => toggleBaseSection('eosProducts', isOpen)}
                      isActive={isSectionActive('eosProducts', filters, productSourceMap)}
                    />
                  )}
                  {fabricProducts.length > 0 && (
                    <FilterListSection
                      title="Workload (Fabric)"
                      options={fabricProducts}
                      selected={filters.products ?? []}
                      onChange={(next) => updateProductsForSource('Fabric', next)}
                      activeSources={['Fabric']}
                      open={baseSectionStates.fabricProducts}
                      onToggle={(isOpen) => toggleBaseSection('fabricProducts', isOpen)}
                      isActive={isSectionActive('fabricProducts', filters, productSourceMap)}
                    />
                  )}
                  {m365RoadmapProducts.length > 0 && (
                    <FilterListSection
                      title="Prodotti (Microsoft 365)"
                      options={m365RoadmapProducts}
                      selected={filters.products ?? []}
                      onChange={(next) => updateProductsForSource('MICROSOFT 365', next)}
                      activeSources={['MICROSOFT 365']}
                      open={baseSectionStates.m365Products}
                      onToggle={(isOpen) => toggleBaseSection('m365Products', isOpen)}
                      isActive={isSectionActive('m365Products', filters, productSourceMap)}
                    />
                  )}
                </>
              ) : (
                <FilterListSection
                  title={
                    activeSources[0] === 'EOS' ? 'App' :
                    activeSources[0] === 'Fabric' ? 'Workload' :
                    'Prodotti'
                  }
                  options={metadata.products}
                  selected={filters.products ?? []}
                  onChange={(next) => onChange({ products: next })}
                  activeSources={activeSources}
                  sourceTag={sourceTagFor('productOrApp', sourcesFromOptions(metadata.products))}
                  matchAllSources={matchAllSources}
                  open={baseSectionStates.products}
                  onToggle={(isOpen) => toggleBaseSection('products', isOpen)}
                  isActive={isSectionActive('products', filters)}
                />
              )}
            </>
          )}
          {isFilterVisible('bcMinVersion') && hasOptionsForSources(resolvedBcOptions) && (
            <FilterListSection
              title="BC Version"
              options={resolvedBcOptions}
              selected={filters.bcVersions ?? []}
              onChange={(next) => onChange({ bcVersions: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('bcMinVersion', ['EOS'])}
              matchAllSources={matchAllSources}
              maxVisible={12}
              open={baseSectionStates.bcVersion}
              onToggle={(isOpen) => toggleBaseSection('bcVersion', isOpen)}
              isActive={isSectionActive('bcVersion', filters)}
            />
          )}
          {isFilterVisible('months') && hasOptionsForSources(metadata.months) && (
            <FilterListSection
              title="Mese"
              options={metadata.months}
              selected={filters.months ?? []}
              onChange={(next) => onChange({ months: next })}
              searchable={false}
              maxVisible={24}
              activeSources={activeSources}
              sourceTag={sourceTagFor('months', sourcesFromOptions(metadata.months))}
              matchAllSources={matchAllSources}
              open={baseSectionStates.months}
              onToggle={(isOpen) => toggleBaseSection('months', isOpen)}
              isActive={isSectionActive('months', filters)}
            />
          )}
          {isFilterVisible('query') && (
            <div className="mt-4">
              <div className="text-xs uppercase text-muted-foreground">Ricerca</div>
              <input
                className="ul-input mt-2"
                value={localQuery}
                onChange={(event) => setLocalQuery(event.target.value)}
                placeholder="Ricerca"
              />
            </div>
          )}
        </div>

        {/* Advanced Column */}
        <div className="ul-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Avanzati</h2>
            <ExpandCollapseButtons
              onExpandAll={expandAllAdvanced}
              onCollapseAll={collapseAllAdvanced}
              hasCollapsed={hasCollapsedAdvanced}
              hasExpanded={hasExpandedAdvanced}
            />
          </div>
          {isFilterVisible('categories') && hasOptionsForSources(metadata.categories) && (
            <FilterListSection
              title="Categorie"
              options={metadata.categories}
              selected={filters.categories ?? []}
              onChange={(next) => onChange({ categories: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('categories', sourcesFromOptions(metadata.categories))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.categories}
              onToggle={(isOpen) => toggleAdvancedSection('categories', isOpen)}
              isActive={isSectionActive('categories', filters)}
            />
          )}
          {isFilterVisible('tags') && hasOptionsForSources(metadata.tags) && (
            <FilterListSection
              title="Tag"
              options={metadata.tags}
              selected={filters.tags ?? []}
              onChange={(next) => onChange({ tags: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('tags', sourcesFromOptions(metadata.tags))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.tags}
              onToggle={(isOpen) => toggleAdvancedSection('tags', isOpen)}
              isActive={isSectionActive('tags', filters)}
            />
          )}
          {isFilterVisible('wave') && hasOptionsForSources(metadata.waves) && (
            <FilterListSection
              title="Wave"
              options={metadata.waves}
              selected={filters.waves ?? []}
              onChange={(next) => onChange({ waves: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('wave', sourcesFromOptions(metadata.waves))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.waves}
              onToggle={(isOpen) => toggleAdvancedSection('waves', isOpen)}
              isActive={isSectionActive('waves', filters)}
            />
          )}
          {isFilterVisible('availabilityType') &&
            hasOptionsForSources(metadata.availabilityTypes) && (
              <FilterListSection
                title="Availability type"
                options={metadata.availabilityTypes}
                selected={filters.availabilityTypes ?? []}
                onChange={(next) => onChange({ availabilityTypes: next })}
                activeSources={activeSources}
                sourceTag={sourceTagFor(
                  'availabilityType',
                  sourcesFromOptions(metadata.availabilityTypes)
                )}
                matchAllSources={matchAllSources}
                open={advancedSectionStates.availabilityType}
                onToggle={(isOpen) => toggleAdvancedSection('availabilityType', isOpen)}
                isActive={isSectionActive('availabilityType', filters)}
              />
            )}
          {isFilterVisible('enabledFor') && hasOptionsForSources(metadata.enabledFor) && (
            <FilterListSection
              title="Enabled for"
              options={metadata.enabledFor}
              selected={filters.enabledFor ?? []}
              onChange={(next) => onChange({ enabledFor: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('enabledFor', sourcesFromOptions(metadata.enabledFor))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.enabledFor}
              onToggle={(isOpen) => toggleAdvancedSection('enabledFor', isOpen)}
              isActive={isSectionActive('enabledFor', filters)}
            />
          )}
          {isFilterVisible('geography') && hasOptionsForSources(metadata.geography) && (
            <FilterListSection
              title="Geografia"
              options={metadata.geography}
              selected={filters.geography ?? []}
              onChange={(next) => onChange({ geography: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('geography', sourcesFromOptions(metadata.geography))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.geography}
              onToggle={(isOpen) => toggleAdvancedSection('geography', isOpen)}
              isActive={isSectionActive('geography', filters)}
            />
          )}
          {isFilterVisible('language') && hasOptionsForSources(metadata.language) && (
            <FilterListSection
              title="Lingua"
              options={metadata.language}
              selected={filters.language ?? []}
              onChange={(next) => onChange({ language: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('language', sourcesFromOptions(metadata.language))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.language}
              onToggle={(isOpen) => toggleAdvancedSection('language', isOpen)}
              isActive={isSectionActive('language', filters)}
            />
          )}

          {(isFilterVisible('periodNewDays') ||
            isFilterVisible('periodChangedDays') ||
            isFilterVisible('releaseInDays') ||
            isFilterVisible('releaseDateRange')) && (
              <details
                ref={periodsDetailsRefFull}
                className="mt-4"
                open={advancedSectionStates.periods}
                onToggle={(e) => {
                  e.stopPropagation();
                  toggleAdvancedSection('periods', (e.target as HTMLDetailsElement).open);
                }}
              >
                <summary className={`cursor-pointer text-xs uppercase text-muted-foreground ${
                  isSectionActive('periods', filters) ? 'marker:text-primary' : ''
                }`}>
                  Periodi
                  {sourceTagFor('periodNewDays') && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {sourceTagFor('periodNewDays')}
                    </span>
                  )}
                </summary>
                <div className="mt-2 space-y-3 text-xs">
                  {isFilterVisible('periodNewDays') && (
                    <label className="flex items-center gap-2 text-muted-foreground">
                      <span className="min-w-[110px]">Nuovi</span>
                      <select
                        className="ul-input text-xs"
                        value={filters.periodNewDays ?? 0}
                        onChange={(event) =>
                          onChange({ periodNewDays: Number(event.target.value) })
                        }
                      >
                        <option value={0}>Tutti</option>
                        <option value={7}>Ultimi 7 giorni</option>
                        <option value={30}>Ultimi 30 giorni</option>
                        <option value={60}>Ultimi 60 giorni</option>
                      </select>
                    </label>
                  )}
                  {isFilterVisible('periodChangedDays') && (
                    <label className="flex items-center gap-2 text-muted-foreground">
                      <span className="min-w-[110px]">Modificati</span>
                      <select
                        className="ul-input text-xs"
                        value={filters.periodChangedDays ?? 0}
                        onChange={(event) =>
                          onChange({ periodChangedDays: Number(event.target.value) })
                        }
                      >
                        <option value={0}>Tutti</option>
                        <option value={7}>Ultimi 7 giorni</option>
                        <option value={30}>Ultimi 30 giorni</option>
                        <option value={60}>Ultimi 60 giorni</option>
                      </select>
                    </label>
                  )}
                  {isFilterVisible('releaseInDays') && (
                    <label className="flex items-center gap-2 text-muted-foreground">
                      <span className="min-w-[110px]">Rilascio entro</span>
                      <select
                        className="ul-input text-xs"
                        value={filters.releaseInDays ?? 0}
                        onChange={(event) =>
                          onChange({ releaseInDays: Number(event.target.value) })
                        }
                      >
                        <option value={0}>Tutti</option>
                        <option value={7}>7 giorni</option>
                        <option value={14}>14 giorni</option>
                        <option value={30}>30 giorni</option>
                        <option value={60}>60 giorni</option>
                        <option value={90}>90 giorni</option>
                      </select>
                    </label>
                  )}
                  {isFilterVisible('releaseDateRange') && (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-muted-foreground">
                        <span className="min-w-[110px]">Data rilascio (da)</span>
                        <input
                          type="date"
                          className="ul-input text-xs"
                          value={filters.releaseDateFrom ?? ''}
                          onChange={(event) =>
                            onChange({ releaseDateFrom: event.target.value })
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2 text-muted-foreground">
                        <span className="min-w-[110px]">Data rilascio (a)</span>
                        <input
                          type="date"
                          className="ul-input text-xs"
                          value={filters.releaseDateTo ?? ''}
                          onChange={(event) =>
                            onChange({ releaseDateTo: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  )}
                </div>
              </details>
            )}

          {isFilterVisible('horizonMonths') && (
            <details className="mt-4">
              <summary className={`cursor-pointer text-xs uppercase text-muted-foreground ${
                isSectionActive('timeHorizon', filters) ? 'marker:text-primary' : ''
              }`}>
                Orizzonte temporale
              </summary>
              <div className="mt-2">
                <TimeHorizonFilter
                  historyMonths={filters.historyMonths ?? 12}
                  horizonMonths={filters.horizonMonths ?? 12}
                  onChange={(values) => onChange(values)}
                />
              </div>
            </details>
          )}
        </div>
      </section>
    </div>
  );
};

export default FiltersPanel;
