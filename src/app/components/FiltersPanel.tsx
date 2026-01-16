import type React from 'react';
import type { ReleaseSource } from '../../models/ReleaseItem';
import type { FilterState } from '../store/useFilterStore';
import type { FilterMetadata, FilterOption } from '../../services/FilterMetadata';
import type { FilterKey } from '../../services/FilterDefinitions';
import {
  ALL_RELEASE_SOURCES,
  RELEASE_SOURCE_LABELS,
  getActiveSupportedSources,
  getSupportedSourcesForFilter,
  resolveActiveSources
} from '../../services/FilterDefinitions';
import FilterListSection from './FilterListSection';
import FilterSourceToggle from './FilterSourceToggle';

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
  const {
    cssOwnerOptions = [],
    customerOptions = [],
    groupOptions = [],
    minBcVersions = []
  } = options;

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
    const ordered = (['Microsoft', 'EOS'] as ReleaseSource[]).filter((source) =>
      sources.includes(source)
    );
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

  const updateProductsForSource = (source: ReleaseSource, next: string[]) => {
    const toKeep = (filters.products ?? []).filter(
      (product) => productSourceMap.get(product) !== source
    );
    const merged = Array.from(new Set([...toKeep, ...next]));
    onChange({ products: merged });
  };

  const isSidebar = variant === 'sidebar';

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

        {/* Search */}
        {isFilterVisible('query') && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Cerca
            </div>
            <input
              className="ul-input mt-2 text-xs"
              placeholder="Cerca aggiornamenti"
              value={filters.query ?? ''}
              onChange={(event) => onChange({ query: event.target.value })}
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
                  />
                )}
                {eosProducts.length > 0 && (
                  <FilterListSection
                    title="App (EOS)"
                    options={eosProducts}
                    selected={filters.products ?? []}
                    onChange={(next) => updateProductsForSource('EOS', next)}
                    activeSources={['EOS']}
                  />
                )}
              </>
            ) : (
              <FilterListSection
                title={activeSources[0] === 'EOS' ? 'App' : 'Prodotti'}
                options={metadata.products}
                selected={filters.products ?? []}
                onChange={(next) => onChange({ products: next })}
                activeSources={activeSources}
                sourceTag={sourceTagFor('productOrApp', sourcesFromOptions(metadata.products))}
                matchAllSources={matchAllSources}
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
            defaultOpen
            searchable={false}
            activeSources={activeSources}
            sourceTag={sourceTagFor('status', sourcesFromOptions(metadata.statuses))}
            matchAllSources={matchAllSources}
          />
        )}

        {/* BC Version */}
        {isFilterVisible('bcMinVersion') && minBcVersions.length > 0 && (
          <div>
            <div className="text-xs uppercase text-muted-foreground">
              BC Version
              {sourceTagFor('bcMinVersion', ['EOS']) && (
                <span className="ml-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                  {sourceTagFor('bcMinVersion', ['EOS'])}
                </span>
              )}
            </div>
            <select
              className="ul-input mt-2 text-xs"
              value={
                filters.minBcVersionMin !== null && filters.minBcVersionMin !== undefined
                  ? String(filters.minBcVersionMin)
                  : ''
              }
              onChange={(event) =>
                onChange({
                  minBcVersionMin: event.target.value ? Number(event.target.value) : null
                })
              }
            >
              <option value="">Tutte</option>
              {minBcVersions.map((value) => (
                <option key={value} value={value}>
                  BC {value}
                </option>
              ))}
            </select>
          </div>
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
          />
        )}

        {/* Avanzati Section (collapsible) */}
        <details>
          <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
            Avanzati
          </summary>
          <div className="mt-2 space-y-3">
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
              />
            )}

            {/* Waves */}
            {isFilterVisible('wave') && hasOptionsForSources(metadata.waves) && (
              <FilterListSection
                title="Wave"
                options={metadata.waves}
                selected={filters.waves ?? []}
                onChange={(next) => onChange({ waves: next })}
                searchable={false}
                activeSources={activeSources}
                sourceTag={sourceTagFor('wave', sourcesFromOptions(metadata.waves))}
                matchAllSources={matchAllSources}
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
              />
            )}
          </div>
        </details>

        {/* Periods */}
        {(isFilterVisible('periodNewDays') ||
          isFilterVisible('periodChangedDays') ||
          isFilterVisible('releaseInDays') ||
          isFilterVisible('releaseDateRange')) && (
          <details>
            <summary className="cursor-pointer text-xs uppercase text-muted-foreground">
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
          <div>
            <div className="text-xs uppercase text-muted-foreground">Orizzonte temporale</div>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="min-w-[80px]">Horizon</span>
                <input
                  type="number"
                  className="ul-input text-xs"
                  value={filters.horizonMonths ?? 12}
                  onChange={(event) =>
                    onChange({ horizonMonths: Number(event.target.value) })
                  }
                />
                <span>mesi</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="min-w-[80px]">History</span>
                <input
                  type="number"
                  className="ul-input text-xs"
                  value={filters.historyMonths ?? 12}
                  onChange={(event) =>
                    onChange({ historyMonths: Number(event.target.value) })
                  }
                />
                <span>mesi</span>
              </label>
            </div>
          </div>
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
          <h2 className="text-lg font-semibold">Base</h2>
          {isFilterVisible('status') && hasOptionsForSources(metadata.statuses) && (
            <FilterListSection
              title="Stato"
              options={metadata.statuses}
              selected={filters.statuses ?? []}
              onChange={(next) => onChange({ statuses: next })}
              defaultOpen
              searchable={false}
              activeSources={activeSources}
              sourceTag={sourceTagFor('status', sourcesFromOptions(metadata.statuses))}
              matchAllSources={matchAllSources}
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
                      defaultOpen
                      activeSources={['Microsoft']}
                    />
                  )}
                  {eosProducts.length > 0 && (
                    <FilterListSection
                      title="App (EOS)"
                      options={eosProducts}
                      selected={filters.products ?? []}
                      onChange={(next) => updateProductsForSource('EOS', next)}
                      defaultOpen
                      activeSources={['EOS']}
                    />
                  )}
                </>
              ) : (
                <FilterListSection
                  title={activeSources[0] === 'EOS' ? 'App' : 'Prodotti'}
                  options={metadata.products}
                  selected={filters.products ?? []}
                  onChange={(next) => onChange({ products: next })}
                  defaultOpen
                  activeSources={activeSources}
                  sourceTag={sourceTagFor('productOrApp', sourcesFromOptions(metadata.products))}
                  matchAllSources={matchAllSources}
                />
              )}
            </>
          )}
          {isFilterVisible('bcMinVersion') && minBcVersions.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase text-muted-foreground">
                BC Version
                {sourceTagFor('bcMinVersion', ['EOS']) && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                    {sourceTagFor('bcMinVersion', ['EOS'])}
                  </span>
                )}
              </div>
              <select
                className="ul-input mt-2 text-xs"
                value={
                  filters.minBcVersionMin !== null
                    ? String(filters.minBcVersionMin)
                    : ''
                }
                onChange={(event) =>
                  onChange({
                    minBcVersionMin: event.target.value ? Number(event.target.value) : null
                  })
                }
              >
                <option value="">Tutte</option>
                {minBcVersions.map((value) => (
                  <option key={value} value={value}>
                    BC {value}
                  </option>
                ))}
              </select>
            </div>
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
            />
          )}
          {isFilterVisible('query') && (
            <div className="mt-4">
              <div className="text-xs uppercase text-muted-foreground">Ricerca</div>
              <input
                className="ul-input mt-2"
                value={filters.query ?? ''}
                onChange={(event) => onChange({ query: event.target.value })}
                placeholder="Ricerca"
              />
            </div>
          )}
        </div>

        {/* Advanced Column */}
        <div className="ul-surface p-6">
          <h2 className="text-lg font-semibold">Avanzati</h2>
          {isFilterVisible('categories') && hasOptionsForSources(metadata.categories) && (
            <FilterListSection
              title="Categorie"
              options={metadata.categories}
              selected={filters.categories ?? []}
              onChange={(next) => onChange({ categories: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('categories', sourcesFromOptions(metadata.categories))}
              matchAllSources={matchAllSources}
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
            />
          )}
          {isFilterVisible('wave') && hasOptionsForSources(metadata.waves) && (
            <FilterListSection
              title="Wave"
              options={metadata.waves}
              selected={filters.waves ?? []}
              onChange={(next) => onChange({ waves: next })}
              searchable={false}
              activeSources={activeSources}
              sourceTag={sourceTagFor('wave', sourcesFromOptions(metadata.waves))}
              matchAllSources={matchAllSources}
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
            />
          )}

          {(isFilterVisible('periodNewDays') ||
            isFilterVisible('periodChangedDays') ||
            isFilterVisible('releaseInDays') ||
            isFilterVisible('releaseDateRange')) && (
              <details className="mt-4" open>
                <summary className="cursor-pointer text-xs uppercase text-muted-foreground">
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
            <div className="mt-4">
              <div className="text-xs uppercase text-muted-foreground">Orizzonte temporale</div>
              <div className="mt-2 space-y-3 text-xs">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <span className="min-w-[110px]">Horizon (mesi)</span>
                  <input
                    type="number"
                    className="ul-input text-xs"
                    value={filters.horizonMonths ?? 12}
                    onChange={(event) =>
                      onChange({ horizonMonths: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-muted-foreground">
                  <span className="min-w-[110px]">History (mesi)</span>
                  <input
                    type="number"
                    className="ul-input text-xs"
                    value={filters.historyMonths ?? 12}
                    onChange={(event) =>
                      onChange({ historyMonths: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default FiltersPanel;
