import { useCallback } from 'react';
import type { FilterState } from '../../store/useFilterStore';
import type { FilterMetadata, FilterOption } from '../../../services/FilterMetadata';
import type { ReleaseSource } from '../../../models/ReleaseItem';
import type { FilterKey } from '../../../services/FilterDefinitions';
import { RELEASE_SOURCE_LABELS } from '../../../services/FilterDefinitions';
import {
  usePersistedSectionStates,
  STORAGE_KEYS
} from '../../../hooks/usePersistedSectionStates';
import {
  sourceTagFor,
  isFilterVisible,
  hasOptionsForSources,
  sourcesFromOptions,
  splitProductsBySource
} from '../../../utils/filterDisplayHelpers';
import FilterListSection from '../FilterListSection';
import TimeHorizonFilter from '../TimeHorizonFilter';
import { isSectionActive } from '../../../utils/filterSectionActive';
import { useDebouncedInput } from '../../../hooks/useDebouncedValue';

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
  | 'periods';

type Props = {
  currentFilters: FilterState;
  updateFilters: (patch: Partial<FilterState>) => void;
  metadata: FilterMetadata;
  activeSources: ReleaseSource[];
  bcVersionOptions: FilterOption[];
  productSourcesByValue: Map<string, ReleaseSource>;
};

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
      <button type="button" className="text-primary underline" onClick={onExpandAll}>
        Espandi tutto
      </button>
    )}
    {hasExpanded && (
      <button type="button" className="text-primary underline" onClick={onCollapseAll}>
        Comprimi tutto
      </button>
    )}
  </div>
);

const defaultBaseOpenStates: Record<SectionKey, boolean> = {
  products: true,
  microsoftProducts: true,
  eosProducts: true,
  fabricProducts: true,
  m365Products: true,
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
  periods: true
};

const defaultAdvancedOpenStates: Record<SectionKey, boolean> = {
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
  periods: true
};

const FilterSectionsGrid = ({
  currentFilters,
  updateFilters,
  metadata,
  activeSources,
  bcVersionOptions,
  productSourcesByValue
}: Props) => {
  const matchAllSources = false;
  const showProductSplit = activeSources.length > 1;

  const { microsoftProducts, eosProducts, fabricProducts, m365RoadmapProducts } =
    splitProductsBySource(metadata.products);

  const isVisible = (key: FilterKey) => isFilterVisible(activeSources, key);
  const hasOptions = (options: { value: string; sources: ReleaseSource[] }[]) =>
    hasOptionsForSources(options, activeSources, matchAllSources);
  const getSourceTag = (key: FilterKey, availableSources?: ReleaseSource[]) =>
    sourceTagFor(activeSources, key, availableSources);

  const updateProductsForSource = (source: ReleaseSource, next: string[]) => {
    const toKeep = currentFilters.products.filter(
      (product) => productSourcesByValue.get(product) !== source
    );
    const merged = Array.from(new Set([...toKeep, ...next]));
    updateFilters({ products: merged });
  };

  const [localQuery, setLocalQuery] = useDebouncedInput(
    currentFilters.query,
    (value) => updateFilters({ query: value }),
    300
  );

  const [baseSectionStates, setBaseSectionStates] = usePersistedSectionStates<Record<SectionKey, boolean>>(
    STORAGE_KEYS.GLOBAL_FILTERS_BASE,
    defaultBaseOpenStates
  );
  const [advancedSectionStates, setAdvancedSectionStates] = usePersistedSectionStates<Record<SectionKey, boolean>>(
    STORAGE_KEYS.GLOBAL_FILTERS_ADVANCED,
    defaultAdvancedOpenStates
  );

  const toggleBaseSection = useCallback((key: SectionKey, isOpen: boolean) => {
    setBaseSectionStates((prev) => ({ ...prev, [key]: isOpen }));
  }, []);
  const toggleAdvancedSection = useCallback((key: SectionKey, isOpen: boolean) => {
    setAdvancedSectionStates((prev) => ({ ...prev, [key]: isOpen }));
  }, []);

  const toggleAll = (setter: typeof setBaseSectionStates, value: boolean) => () => {
    setter((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as SectionKey[]) next[key] = value;
      return next;
    });
  };

  const hasCollapsedBase = Object.values(baseSectionStates).some((v) => !v);
  const hasExpandedBase = Object.values(baseSectionStates).some((v) => v);
  const hasCollapsedAdvanced = Object.values(advancedSectionStates).some((v) => !v);
  const hasExpandedAdvanced = Object.values(advancedSectionStates).some((v) => v);

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="ul-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Base</h2>
          <ExpandCollapseButtons
            onExpandAll={toggleAll(setBaseSectionStates, true)}
            onCollapseAll={toggleAll(setBaseSectionStates, false)}
            hasCollapsed={hasCollapsedBase}
            hasExpanded={hasExpandedBase}
          />
        </div>
        {isVisible('status') && hasOptions(metadata.statuses) && (
          <FilterListSection
            title="Stato"
            options={metadata.statuses}
            selected={currentFilters.statuses}
            onChange={(next) => updateFilters({ statuses: next })}
            searchable={false}
            activeSources={activeSources}
            sourceTag={getSourceTag('status', sourcesFromOptions(metadata.statuses))}
            matchAllSources={matchAllSources}
            open={baseSectionStates.status}
            onToggle={(isOpen) => toggleBaseSection('status', isOpen)}
            isActive={isSectionActive('status', currentFilters)}
          />
        )}
        {isVisible('productOrApp') && hasOptions(metadata.products) && (
          <>
            {showProductSplit ? (
              <>
                {microsoftProducts.length > 0 && (
                  <FilterListSection
                    title="Prodotti (Microsoft)"
                    options={microsoftProducts}
                    selected={currentFilters.products}
                    onChange={(next) => updateProductsForSource('Microsoft', next)}
                    activeSources={['Microsoft']}
                    sourceTag={RELEASE_SOURCE_LABELS.Microsoft}
                    open={baseSectionStates.microsoftProducts}
                    onToggle={(isOpen) => toggleBaseSection('microsoftProducts', isOpen)}
                    isActive={isSectionActive('microsoftProducts', currentFilters, productSourcesByValue)}
                  />
                )}
                {eosProducts.length > 0 && (
                  <FilterListSection
                    title="App (EOS)"
                    options={eosProducts}
                    selected={currentFilters.products}
                    onChange={(next) => updateProductsForSource('EOS', next)}
                    activeSources={['EOS']}
                    sourceTag={RELEASE_SOURCE_LABELS.EOS}
                    open={baseSectionStates.eosProducts}
                    onToggle={(isOpen) => toggleBaseSection('eosProducts', isOpen)}
                    isActive={isSectionActive('eosProducts', currentFilters, productSourcesByValue)}
                  />
                )}
                {fabricProducts.length > 0 && (
                  <FilterListSection
                    title="Workload (Fabric)"
                    options={fabricProducts}
                    selected={currentFilters.products}
                    onChange={(next) => updateProductsForSource('Fabric', next)}
                    activeSources={['Fabric']}
                    sourceTag={RELEASE_SOURCE_LABELS.Fabric}
                    open={baseSectionStates.fabricProducts}
                    onToggle={(isOpen) => toggleBaseSection('fabricProducts', isOpen)}
                    isActive={isSectionActive('fabricProducts', currentFilters, productSourcesByValue)}
                  />
                )}
                {m365RoadmapProducts.length > 0 && (
                  <FilterListSection
                    title="Prodotti (Microsoft 365)"
                    options={m365RoadmapProducts}
                    selected={currentFilters.products}
                    onChange={(next) => updateProductsForSource('MICROSOFT 365', next)}
                    activeSources={['MICROSOFT 365']}
                    sourceTag={RELEASE_SOURCE_LABELS['MICROSOFT 365']}
                    open={baseSectionStates.m365Products}
                    onToggle={(isOpen) => toggleBaseSection('m365Products', isOpen)}
                    isActive={isSectionActive('m365Products', currentFilters, productSourcesByValue)}
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
                selected={currentFilters.products}
                onChange={(next) => updateFilters({ products: next })}
                activeSources={activeSources}
                sourceTag={getSourceTag('productOrApp', sourcesFromOptions(metadata.products))}
                matchAllSources={matchAllSources}
                open={baseSectionStates.products}
                onToggle={(isOpen) => toggleBaseSection('products', isOpen)}
                isActive={isSectionActive('products', currentFilters)}
              />
            )}
          </>
        )}
        {isVisible('bcMinVersion') && hasOptions(bcVersionOptions) && (
          <FilterListSection
            title="BC Version"
            options={bcVersionOptions}
            selected={currentFilters.bcVersions}
            onChange={(next) => updateFilters({ bcVersions: next })}
            activeSources={activeSources}
            sourceTag={getSourceTag('bcMinVersion', ['EOS'])}
            matchAllSources={matchAllSources}
            maxVisible={12}
            open={baseSectionStates.bcVersion}
            onToggle={(isOpen) => toggleBaseSection('bcVersion', isOpen)}
            isActive={isSectionActive('bcVersion', currentFilters)}
          />
        )}
        {isVisible('months') && hasOptions(metadata.months) && (
          <FilterListSection
            title="Mese"
            options={metadata.months}
            selected={currentFilters.months}
            onChange={(next) => updateFilters({ months: next })}
            searchable={false}
            maxVisible={24}
            activeSources={activeSources}
            sourceTag={getSourceTag('months', sourcesFromOptions(metadata.months))}
            matchAllSources={matchAllSources}
            open={baseSectionStates.months}
            onToggle={(isOpen) => toggleBaseSection('months', isOpen)}
            isActive={isSectionActive('months', currentFilters)}
          />
        )}
        {isVisible('query') && (
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

      <div className="ul-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Avanzati</h2>
          <ExpandCollapseButtons
            onExpandAll={toggleAll(setAdvancedSectionStates, true)}
            onCollapseAll={toggleAll(setAdvancedSectionStates, false)}
            hasCollapsed={hasCollapsedAdvanced}
            hasExpanded={hasExpandedAdvanced}
          />
        </div>
        {isVisible('categories') && hasOptions(metadata.categories) && (
          <FilterListSection
            title="Categorie"
            options={metadata.categories}
            selected={currentFilters.categories}
            onChange={(next) => updateFilters({ categories: next })}
            activeSources={activeSources}
            sourceTag={getSourceTag('categories', sourcesFromOptions(metadata.categories))}
            matchAllSources={matchAllSources}
            open={advancedSectionStates.categories}
            onToggle={(isOpen) => toggleAdvancedSection('categories', isOpen)}
            isActive={isSectionActive('categories', currentFilters)}
          />
        )}
        {isVisible('tags') && hasOptions(metadata.tags) && (
          <FilterListSection
            title="Tag"
            options={metadata.tags}
            selected={currentFilters.tags}
            onChange={(next) => updateFilters({ tags: next })}
            activeSources={activeSources}
            sourceTag={getSourceTag('tags', sourcesFromOptions(metadata.tags))}
            matchAllSources={matchAllSources}
            open={advancedSectionStates.tags}
            onToggle={(isOpen) => toggleAdvancedSection('tags', isOpen)}
            isActive={isSectionActive('tags', currentFilters)}
          />
        )}
        {isVisible('wave') && hasOptions(metadata.waves) && (
          <FilterListSection
            title="Wave"
            options={metadata.waves}
            selected={currentFilters.waves}
            onChange={(next) => updateFilters({ waves: next })}
            activeSources={activeSources}
            sourceTag={getSourceTag('wave', sourcesFromOptions(metadata.waves))}
            matchAllSources={matchAllSources}
            open={advancedSectionStates.waves}
            onToggle={(isOpen) => toggleAdvancedSection('waves', isOpen)}
            isActive={isSectionActive('waves', currentFilters)}
          />
        )}
        {isVisible('availabilityType') && hasOptions(metadata.availabilityTypes) && (
          <FilterListSection
            title="Availability type"
            options={metadata.availabilityTypes}
            selected={currentFilters.availabilityTypes}
            onChange={(next) => updateFilters({ availabilityTypes: next })}
            activeSources={activeSources}
            sourceTag={getSourceTag('availabilityType', sourcesFromOptions(metadata.availabilityTypes))}
            matchAllSources={matchAllSources}
            open={advancedSectionStates.availabilityType}
            onToggle={(isOpen) => toggleAdvancedSection('availabilityType', isOpen)}
            isActive={isSectionActive('availabilityType', currentFilters)}
          />
        )}
        {isVisible('enabledFor') && hasOptions(metadata.enabledFor) && (
          <FilterListSection
            title="Enabled for"
            options={metadata.enabledFor}
            selected={currentFilters.enabledFor}
            onChange={(next) => updateFilters({ enabledFor: next })}
            activeSources={activeSources}
            sourceTag={getSourceTag('enabledFor', sourcesFromOptions(metadata.enabledFor))}
            matchAllSources={matchAllSources}
            open={advancedSectionStates.enabledFor}
            onToggle={(isOpen) => toggleAdvancedSection('enabledFor', isOpen)}
            isActive={isSectionActive('enabledFor', currentFilters)}
          />
        )}
        {isVisible('geography') && hasOptions(metadata.geography) && (
          <FilterListSection
            title="Geografia"
            options={metadata.geography}
            selected={currentFilters.geography}
            onChange={(next) => updateFilters({ geography: next })}
            activeSources={activeSources}
            sourceTag={getSourceTag('geography', sourcesFromOptions(metadata.geography))}
            matchAllSources={matchAllSources}
            open={advancedSectionStates.geography}
            onToggle={(isOpen) => toggleAdvancedSection('geography', isOpen)}
            isActive={isSectionActive('geography', currentFilters)}
          />
        )}
        {isVisible('language') && hasOptions(metadata.language) && (
          <FilterListSection
            title="Lingua"
            options={metadata.language}
            selected={currentFilters.language}
            onChange={(next) => updateFilters({ language: next })}
            activeSources={activeSources}
            sourceTag={getSourceTag('language', sourcesFromOptions(metadata.language))}
            matchAllSources={matchAllSources}
            open={advancedSectionStates.language}
            onToggle={(isOpen) => toggleAdvancedSection('language', isOpen)}
            isActive={isSectionActive('language', currentFilters)}
          />
        )}

        {(isVisible('periodNewDays') ||
          isVisible('periodChangedDays') ||
          isVisible('releaseInDays') ||
          isVisible('releaseDateRange')) && (
          <details
            className="mt-4"
            open={advancedSectionStates.periods}
            onToggle={(e) => toggleAdvancedSection('periods', (e.target as HTMLDetailsElement).open)}
          >
            <summary className={`cursor-pointer text-xs uppercase text-muted-foreground ${
              isSectionActive('periods', currentFilters) ? 'marker:text-primary' : ''
            }`}>
              Periodi
              {getSourceTag('periodNewDays') && (
                <span className="ml-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                  {getSourceTag('periodNewDays')}
                </span>
              )}
            </summary>
            <div className="mt-2 space-y-3 text-xs">
              {isVisible('periodNewDays') && (
                <label className="flex items-center gap-2 text-muted-foreground">
                  <span className="min-w-[110px]">Nuovi</span>
                  <select className="ul-input text-xs" value={currentFilters.periodNewDays}
                    onChange={(e) => updateFilters({ periodNewDays: Number(e.target.value) })}>
                    <option value={0}>Tutti</option>
                    <option value={7}>Ultimi 7 giorni</option>
                    <option value={30}>Ultimi 30 giorni</option>
                    <option value={60}>Ultimi 60 giorni</option>
                  </select>
                </label>
              )}
              {isVisible('periodChangedDays') && (
                <label className="flex items-center gap-2 text-muted-foreground">
                  <span className="min-w-[110px]">Modificati</span>
                  <select className="ul-input text-xs" value={currentFilters.periodChangedDays}
                    onChange={(e) => updateFilters({ periodChangedDays: Number(e.target.value) })}>
                    <option value={0}>Tutti</option>
                    <option value={7}>Ultimi 7 giorni</option>
                    <option value={30}>Ultimi 30 giorni</option>
                    <option value={60}>Ultimi 60 giorni</option>
                  </select>
                </label>
              )}
              {isVisible('releaseInDays') && (
                <label className="flex items-center gap-2 text-muted-foreground">
                  <span className="min-w-[110px]">Rilascio entro</span>
                  <select className="ul-input text-xs" value={currentFilters.releaseInDays}
                    onChange={(e) => updateFilters({ releaseInDays: Number(e.target.value) })}>
                    <option value={0}>Tutti</option>
                    <option value={7}>7 giorni</option>
                    <option value={14}>14 giorni</option>
                    <option value={30}>30 giorni</option>
                    <option value={60}>60 giorni</option>
                    <option value={90}>90 giorni</option>
                  </select>
                </label>
              )}
              {isVisible('releaseDateRange') && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <span className="min-w-[110px]">Data rilascio (da)</span>
                    <input type="date" className="ul-input text-xs" value={currentFilters.releaseDateFrom}
                      onChange={(e) => updateFilters({ releaseDateFrom: e.target.value })} />
                  </label>
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <span className="min-w-[110px]">Data rilascio (a)</span>
                    <input type="date" className="ul-input text-xs" value={currentFilters.releaseDateTo}
                      onChange={(e) => updateFilters({ releaseDateTo: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          </details>
        )}

        {isVisible('horizonMonths') && (
          <details className="mt-4">
            <summary className={`cursor-pointer text-xs uppercase text-muted-foreground ${
              isSectionActive('timeHorizon', currentFilters) ? 'marker:text-primary' : ''
            }`}>
              Orizzonte temporale
            </summary>
            <div className="mt-2">
              <TimeHorizonFilter
                historyMonths={currentFilters.historyMonths}
                horizonMonths={currentFilters.horizonMonths}
                onChange={(values) => updateFilters(values)}
              />
            </div>
          </details>
        )}
      </div>
    </section>
  );
};

export default FilterSectionsGrid;
