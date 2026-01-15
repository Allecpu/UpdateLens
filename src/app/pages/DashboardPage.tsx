import { useEffect, useMemo, useState } from 'react';
import { loadAllSnapshots, loadRulesConfig } from '../../services/DataLoader';
import { filterReleaseItems } from '../../services/FilterService';
import { buildMarkdown, downloadMarkdown } from '../../services/ExportService';
import type { ReleaseItem, ReleaseSource, ReleaseStatus } from '../../models/ReleaseItem';
import {
  RELEASE_SOURCE_LABELS,
  getActiveSupportedSources,
  resolveActiveSources
} from '../../services/FilterDefinitions';
import { useCustomerStore } from '../store/useCustomerStore';
import { useFilterStore, type FilterState } from '../store/useFilterStore';
import { buildFilterMetadata } from '../../services/FilterMetadata';
import {
  normalizeFilters,
  createDefaultFilters,
  buildNormalizationContext
} from '../../services/FilterNormalization';
import FilterListSection from '../components/FilterListSection';
import FilterSourceToggle from '../components/FilterSourceToggle';
import { isValidHttpUrl } from '../../utils/url';
import { isReleasePlansUrl, isValidGuid } from '../../utils/releaseplans';
import { getProductColor } from '../../utils/productColors';
import type { FilterKey } from '../../services/FilterDefinitions';

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

type Chip = {
  label: string;
  onRemove: () => void;
};

const DashboardPage = () => {
  const [snapshotItems, setSnapshotItems] = useState<ReleaseItem[]>([]);
  const [snapshotErrors, setSnapshotErrors] = useState<string[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const rulesConfig = loadRulesConfig();
  const { activeCustomerId, customers } = useCustomerStore();
  const {
    cssFilters,
    customerFilters,
    customerFilterMode,
    setCssFilters,
    setCustomerFilters,
    setCustomerMode,
    ensureCssFilters
  } = useFilterStore();
  const activeCustomer = activeCustomerId ? customers[activeCustomerId] : null;

  useEffect(() => {
    let active = true;
    loadAllSnapshots().then((result) => {
      if (!active) {
        return;
      }
      setSnapshotItems(result.items);
      setSnapshotErrors(result.errors);
      setSnapshotsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const items = snapshotItems;
  const metadata = useMemo(() => buildFilterMetadata(items), [items]);

  const sourceOptions = useMemo(
    () =>
      metadata.sources.length
        ? metadata.sources.map((opt) => opt.value)
        : rulesConfig.defaults.sources,
    [metadata.sources, rulesConfig.defaults.sources]
  );
  const statusOptions = useMemo(
    () =>
      metadata.statuses.length
        ? metadata.statuses.map((opt) => opt.value)
        : rulesConfig.defaults.statuses,
    [metadata.statuses, rulesConfig.defaults.statuses]
  );
  const productOptions = useMemo(
    () => metadata.products.map((opt) => opt.value),
    [metadata.products]
  );
  const minBcVersions = useMemo(() => {
    const versions = Array.from(
      new Set(items.map((item) => item.minBcVersion).filter((value) => typeof value === 'number'))
    ) as number[];
    return versions.sort((a, b) => b - a);
  }, [items]);

  const normContext = useMemo(
    () => buildNormalizationContext(items, metadata, sourceOptions),
    [items, metadata, sourceOptions]
  );

  const productSourceMap = normContext.productSourceMap;

  const defaultFilters: FilterState = useMemo(
    () =>
      createDefaultFilters(
        productOptions,
        sourceOptions,
        statusOptions,
        rulesConfig.defaults.horizonMonths,
        rulesConfig.defaults.historyMonths
      ),
    [
      productOptions,
      sourceOptions,
      statusOptions,
      rulesConfig.defaults.horizonMonths,
      rulesConfig.defaults.historyMonths
    ]
  );

  useEffect(() => {
    if (!snapshotsLoaded) {
      return;
    }
    ensureCssFilters(defaultFilters);
  }, [ensureCssFilters, defaultFilters, snapshotsLoaded]);

  const activeMode =
    activeCustomerId ? customerFilterMode[activeCustomerId] ?? 'inherit' : 'inherit';

  // Usa la normalizzazione centralizzata - aspetta che i dati siano caricati
  const normalizedCssFilters = useMemo(() => {
    // Se i dati non sono ancora caricati, usa i default
    if (!snapshotsLoaded || items.length === 0) {
      return cssFilters ? { ...defaultFilters, ...cssFilters } : defaultFilters;
    }
    return normalizeFilters(cssFilters, defaultFilters, normContext);
  }, [cssFilters, defaultFilters, normContext, snapshotsLoaded, items.length]);

  const activeFilters = useMemo(() => {
    if (!activeCustomerId) {
      return normalizedCssFilters;
    }
    if (activeMode === 'inherit') {
      return normalizedCssFilters;
    }
    const custom = customerFilters[activeCustomerId];
    if (!custom) {
      return normalizedCssFilters;
    }
    // Se i dati non sono ancora caricati, usa i custom filters direttamente
    if (!snapshotsLoaded || items.length === 0) {
      return { ...defaultFilters, ...custom };
    }
    return normalizeFilters(custom, defaultFilters, normContext);
  }, [
    activeCustomerId,
    activeMode,
    customerFilters,
    defaultFilters,
    normalizedCssFilters,
    normContext,
    snapshotsLoaded,
    items.length
  ]);

  const activeSources = resolveActiveSources(
    (activeFilters?.sources ?? []) as ReleaseSource[]
  );
  const matchAllSources = false;
  const hasOptionsForSources = (
    options: { value: string; sources: ReleaseSource[] }[]
  ): boolean => optionValuesForSources(options, activeSources, matchAllSources).length > 0;
  const sourcesFromOptions = (options: { sources: ReleaseSource[] }[]): ReleaseSource[] => {
    const set = new Set<ReleaseSource>();
    options.forEach((option) => option.sources.forEach((source) => set.add(source)));
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
  const isFilterVisible = (key: FilterKey): boolean =>
    getActiveSupportedSources(activeSources, key).length > 0;
  const showProductSplit = activeSources.length > 1;
  const microsoftProducts = metadata.products.filter((option) =>
    option.sources.includes('Microsoft')
  );
  const eosProducts = metadata.products.filter((option) => option.sources.includes('EOS'));
  const updateProductsForSource = (source: ReleaseSource, next: string[]) => {
    const toKeep = (activeFilters?.products ?? []).filter(
      (product) => productSourceMap.get(product) !== source
    );
    updateFilters({ products: Array.from(new Set([...toKeep, ...next])) });
  };

  const updateFilters = (nextFilters: Partial<FilterState>) => {
    if (!activeCustomerId) {
      if (!normalizedCssFilters) {
        return;
      }
      setCssFilters({ ...normalizedCssFilters, ...nextFilters });
      return;
    }

    if (activeMode === 'inherit') {
      const base = normalizedCssFilters;
      if (!base) {
        return;
      }
      setCustomerMode(activeCustomerId, 'custom');
      setCustomerFilters(activeCustomerId, { ...base, ...nextFilters });
      return;
    }

    const current = customerFilters[activeCustomerId] ?? normalizedCssFilters;
    if (!current) {
      return;
    }
    setCustomerFilters(activeCustomerId, { ...current, ...nextFilters });
  };

  const setMode = (mode: 'inherit' | 'custom') => {
    if (!activeCustomerId) {
      return;
    }
    if (mode === 'custom' && !customerFilters[activeCustomerId]) {
      if (normalizedCssFilters) {
        setCustomerFilters(activeCustomerId, normalizedCssFilters);
      }
    }
    setCustomerMode(activeCustomerId, mode);
  };

  const filteredItems = useMemo(() => {
    if (!activeFilters) {
      return [];
    }
    return filterReleaseItems(items, {
      targetCustomerIds: activeFilters.targetCustomerIds,
      targetGroupIds: activeFilters.targetGroupIds,
      targetCssOwners: activeFilters.targetCssOwners,
      products: activeFilters.products,
      sources: activeFilters.sources as ReleaseSource[],
      statuses: activeFilters.statuses as ReleaseStatus[],
      categories: activeFilters.categories,
      tags: activeFilters.tags,
      waves: activeFilters.waves,
      months: activeFilters.months,
      availabilityTypes: activeFilters.availabilityTypes,
      enabledFor: activeFilters.enabledFor,
      geography: activeFilters.geography,
      language: activeFilters.language,
      periodNewDays: activeFilters.periodNewDays,
      periodChangedDays: activeFilters.periodChangedDays,
      releaseInDays: activeFilters.releaseInDays,
      minBcVersionMin: activeFilters.minBcVersionMin,
      releaseDateFrom: activeFilters.releaseDateFrom,
      releaseDateTo: activeFilters.releaseDateTo,
      sortOrder: activeFilters.sortOrder,
      query: activeFilters.query,
      horizonMonths: activeFilters.horizonMonths,
      historyMonths: activeFilters.historyMonths
    });
  }, [activeFilters, items]);

  const sortedItems = useMemo(() => {
    if (!activeFilters) {
      return filteredItems;
    }
    const order = activeFilters.sortOrder;
    const toDate = (item: ReleaseItem): number => {
      const parsed = new Date(item.releaseDate).getTime();
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
      const [year, month] = item.availabilityDate.split('-').map(Number);
      return new Date(year, (month || 1) - 1, 1).getTime();
    };
    return [...filteredItems].sort((a, b) =>
      order === 'oldest' ? toDate(a) - toDate(b) : toDate(b) - toDate(a)
    );
  }, [activeFilters, filteredItems]);

  const chips = useMemo<Chip[]>(() => {
    if (!activeFilters) {
      return [];
    }
    const entries: Chip[] = [];
    const removeFrom = (key: keyof FilterState, value: string) => {
      const current = activeFilters[key] as string[];
      updateFilters({ [key]: current.filter((item) => item !== value) });
    };
    const pushValues = (label: string, key: keyof FilterState, values: string[]) => {
      values.forEach((value) => {
        entries.push({
          label: `${label}: ${value}`,
          onRemove: () => removeFrom(key, value)
        });
      });
    };
    pushValues('Fonte', 'sources', activeFilters.sources);
    if (isFilterVisible('status')) {
      pushValues('Stato', 'statuses', activeFilters.statuses);
    }
    if (isFilterVisible('productOrApp')) {
      pushValues('Prodotto', 'products', activeFilters.products);
    }
    if (isFilterVisible('tags')) {
      pushValues('Tag', 'tags', activeFilters.tags);
    }
    if (isFilterVisible('months')) {
      pushValues('Mese', 'months', activeFilters.months);
    }
    if (isFilterVisible('query') && activeFilters.query) {
      entries.push({
        label: `Ricerca: ${activeFilters.query}`,
        onRemove: () => updateFilters({ query: '' })
      });
    }
    if (isFilterVisible('periodNewDays') && activeFilters.periodNewDays > 0) {
      entries.push({
        label: `Nuovi: ${activeFilters.periodNewDays} giorni`,
        onRemove: () => updateFilters({ periodNewDays: 0 })
      });
    }
    if (isFilterVisible('periodChangedDays') && activeFilters.periodChangedDays > 0) {
      entries.push({
        label: `Modificati: ${activeFilters.periodChangedDays} giorni`,
        onRemove: () => updateFilters({ periodChangedDays: 0 })
      });
    }
    if (isFilterVisible('releaseInDays') && activeFilters.releaseInDays > 0) {
      entries.push({
        label: `Release entro: ${activeFilters.releaseInDays} giorni`,
        onRemove: () => updateFilters({ releaseInDays: 0 })
      });
    }
    if (isFilterVisible('bcMinVersion') && activeFilters.minBcVersionMin !== null) {
      entries.push({
        label: `BC Min Version >= ${activeFilters.minBcVersionMin}`,
        onRemove: () => updateFilters({ minBcVersionMin: null })
      });
    }
    if (isFilterVisible('releaseDateRange') && activeFilters.releaseDateFrom) {
      entries.push({
        label: `Da: ${activeFilters.releaseDateFrom}`,
        onRemove: () => updateFilters({ releaseDateFrom: '' })
      });
    }
    if (isFilterVisible('releaseDateRange') && activeFilters.releaseDateTo) {
      entries.push({
        label: `A: ${activeFilters.releaseDateTo}`,
        onRemove: () => updateFilters({ releaseDateTo: '' })
      });
    }
    return entries;
  }, [activeFilters, updateFilters]);

  const onExport = () => {
    const name = activeCustomer?.name || 'Cliente';
    const content = buildMarkdown(sortedItems, name);
    downloadMarkdown(content, 'update-lens-export.md');
  };

  const visibleChips = chips.slice(0, 8);
  const hiddenCount = chips.length - visibleChips.length;

  return (
    <div className="flex min-h-[calc(100vh-140px)] gap-6">
      <aside className="w-64 rounded-3xl bg-sidebar px-4 py-5 text-sidebar-foreground shadow-soft">
        <div className="text-lg font-semibold text-sidebar-foreground">Filtri</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {activeCustomerId ? 'Filtri cliente' : 'Filtri CSS attivi'}
        </div>
        {activeCustomerId && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {activeMode === 'inherit'
                ? 'Eredita filtri CSS'
                : 'Filtri personalizzati per cliente'}
            </span>
            <div className="flex rounded-full bg-secondary p-1">
              <button
                className={`rounded-full px-2 py-1 ${
                  activeMode === 'inherit' ? 'bg-card text-foreground' : ''
                }`}
                onClick={() => setMode('inherit')}
              >
                Eredita
              </button>
              <button
                className={`rounded-full px-2 py-1 ${
                  activeMode === 'custom' ? 'bg-card text-foreground' : ''
                }`}
                onClick={() => setMode('custom')}
              >
                Personalizza
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 text-xs text-muted-foreground">
          {activeCustomerId
            ? `Scope: Cliente: ${activeCustomer?.name ?? 'Cliente'}`
            : 'Scope: CSS'}
        </div>

        <div className="mt-4 space-y-2">
          <FilterSourceToggle
            selected={(activeFilters?.sources ?? []) as ReleaseSource[]}
            onChange={(next) => updateFilters({ sources: next })}
          />
          <div className="text-xs text-muted-foreground">
            Attive: {activeSources.map((source) => RELEASE_SOURCE_LABELS[source]).join(', ')}
          </div>
        </div>

        <div className="mt-4 text-[10px] uppercase tracking-wide text-muted-foreground">
          Cerca
        </div>
        {isFilterVisible('query') && (
          <input
            className="ul-input mt-2 text-xs"
            placeholder="Cerca aggiornamenti"
            value={activeFilters?.query ?? ''}
            onChange={(event) => updateFilters({ query: event.target.value })}
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
                    selected={activeFilters?.products ?? []}
                    onChange={(next) => updateProductsForSource('Microsoft', next)}
                    activeSources={['Microsoft']}
                  />
                )}
                {eosProducts.length > 0 && (
                  <FilterListSection
                    title="App (EOS)"
                    options={eosProducts}
                    selected={activeFilters?.products ?? []}
                    onChange={(next) => updateProductsForSource('EOS', next)}
                    activeSources={['EOS']}
                  />
                )}
              </>
            ) : (
              <FilterListSection
                title={activeSources[0] === 'EOS' ? 'App' : 'Prodotti'}
                options={metadata.products}
                selected={activeFilters?.products ?? []}
                onChange={(next) => updateFilters({ products: next })}
                activeSources={activeSources}
                sourceTag={sourceTagFor('productOrApp', sourcesFromOptions(metadata.products))}
                matchAllSources={matchAllSources}
              />
            )}
          </>
        )}
        {isFilterVisible('status') && hasOptionsForSources(metadata.statuses) && (
          <FilterListSection
            title="Stato"
            options={metadata.statuses}
            selected={activeFilters?.statuses ?? []}
            onChange={(next) => updateFilters({ statuses: next })}
            defaultOpen
            searchable={false}
            activeSources={activeSources}
            sourceTag={sourceTagFor('status', sourcesFromOptions(metadata.statuses))}
            matchAllSources={matchAllSources}
          />
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
                activeFilters?.minBcVersionMin !== null &&
                activeFilters?.minBcVersionMin !== undefined
                  ? String(activeFilters.minBcVersionMin)
                  : ''
              }
              onChange={(event) =>
                updateFilters({
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
            selected={activeFilters?.months ?? []}
            onChange={(next) => updateFilters({ months: next })}
            searchable={false}
            maxVisible={12}
            activeSources={activeSources}
            sourceTag={sourceTagFor('months', sourcesFromOptions(metadata.months))}
            matchAllSources={matchAllSources}
          />
        )}
        {isFilterVisible('tags') && hasOptionsForSources(metadata.tags) && (
          <FilterListSection
            title="Tag"
            options={metadata.tags}
            selected={activeFilters?.tags ?? []}
            onChange={(next) => updateFilters({ tags: next })}
            activeSources={activeSources}
            sourceTag={sourceTagFor('tags', sourcesFromOptions(metadata.tags))}
            matchAllSources={matchAllSources}
          />
        )}
        {(isFilterVisible('periodNewDays') ||
          isFilterVisible('periodChangedDays') ||
          isFilterVisible('releaseInDays') ||
          isFilterVisible('releaseDateRange')) && (
          <details className="mt-4">
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
                    value={activeFilters?.periodNewDays ?? 0}
                    onChange={(event) =>
                      updateFilters({ periodNewDays: Number(event.target.value) })
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
                    value={activeFilters?.periodChangedDays ?? 0}
                    onChange={(event) =>
                      updateFilters({ periodChangedDays: Number(event.target.value) })
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
                    value={activeFilters?.releaseInDays ?? 0}
                    onChange={(event) =>
                      updateFilters({ releaseInDays: Number(event.target.value) })
                    }
                  >
                    <option value={0}>Tutte</option>
                    <option value={30}>30 giorni</option>
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
                      value={activeFilters?.releaseDateFrom ?? ''}
                      onChange={(event) =>
                        updateFilters({ releaseDateFrom: event.target.value })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <span className="min-w-[110px]">A</span>
                    <input
                      type="date"
                      className="ul-input text-xs"
                      value={activeFilters?.releaseDateTo ?? ''}
                      onChange={(event) =>
                        updateFilters({ releaseDateTo: event.target.value })
                      }
                    />
                  </label>
                </>
              )}
            </div>
          </details>
        )}

        {isFilterVisible('sortOrder') && (
          <div className="mt-4">
            <div className="text-xs uppercase text-muted-foreground">Ordinamento</div>
            <select
              className="ul-input mt-2 text-xs"
              value={activeFilters?.sortOrder ?? 'newest'}
              onChange={(event) =>
                updateFilters({ sortOrder: event.target.value as 'newest' | 'oldest' })
              }
            >
              <option value="newest">Dal piu recente</option>
              <option value="oldest">Dal piu vecchio</option>
            </select>
          </div>
        )}

        {isFilterVisible('historyMonths') && (
          <div className="mt-4">
            <div className="text-xs uppercase text-muted-foreground">Storico (mesi)</div>
            <select
              className="ul-input mt-2 text-xs"
              value={activeFilters?.historyMonths ?? rulesConfig.defaults.historyMonths}
              onChange={(event) =>
                updateFilters({ historyMonths: Number(event.target.value) })
              }
            >
              {[6, 12, 24, 60, 120].map((value) => (
                <option key={value} value={value}>
                  Ultimi {value} mesi
                </option>
              ))}
            </select>
          </div>
        )}
      </aside>

      <main className="flex-1">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Analisi rapida degli aggiornamenti Microsoft ed EOS.
            </p>
            {activeCustomer && (
              <div className="mt-1 text-xs text-muted-foreground">
                Cliente in focus: {activeCustomer.name}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button className="ul-button ul-button-primary" onClick={onExport}>
              Esporta Markdown
            </button>
          </div>
        </header>

        {snapshotErrors.length > 0 && (
          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Errore caricamento dati: {snapshotErrors.join(' | ')}
          </div>
        )}

        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {visibleChips.map((chip) => (
              <button
                key={chip.label}
                className="ul-chip"
                onClick={chip.onRemove}
              >
                {chip.label}
              </button>
            ))}
            {hiddenCount > 0 && (
              <div className="text-xs text-muted-foreground">+{hiddenCount}</div>
            )}
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="ul-surface p-5">
            <div className="text-xs uppercase text-muted-foreground">Totale</div>
            <div className="mt-3 text-3xl font-semibold">{filteredItems.length}</div>
          </div>
          <div className="ul-surface p-5">
            <div className="text-xs uppercase text-muted-foreground">Microsoft</div>
            <div className="mt-3 text-3xl font-semibold">
              {filteredItems.filter((item) => item.source === 'Microsoft').length}
            </div>
          </div>
          <div className="ul-surface p-5">
            <div className="text-xs uppercase text-muted-foreground">EOS</div>
            <div className="mt-3 text-3xl font-semibold">
              {filteredItems.filter((item) => item.source === 'EOS').length}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4">
          {sortedItems.length === 0 ? (
            <div className="ul-surface p-8 text-center text-sm text-muted-foreground">
              Nessun aggiornamento corrisponde ai filtri selezionati.
            </div>
          ) : (
            sortedItems.map((item: ReleaseItem) => {
              const productColor = getProductColor(item.productName);
              return (
                <article
                  key={item.id}
                  className="ul-surface relative overflow-hidden p-5 pl-6"
                >
                  <span
                    className={`absolute left-0 top-0 h-full w-1.5 ${productColor.barClass}`}
                    aria-hidden="true"
                  />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${productColor.badgeClass}`}
                      >
                        {item.productName}
                      </span>
                      <h2 className="mt-2 text-lg font-semibold">{item.title}</h2>
                    </div>
                    <span className="ul-chip">{item.status}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
                  <div className="mt-4 text-xs text-muted-foreground">
                    Rilascio: {item.releaseDate}
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    {item.source === 'Microsoft' &&
                    item.sourceUrl &&
                    item.sourcePlanId &&
                    isValidGuid(item.sourcePlanId) &&
                    isReleasePlansUrl(item.sourceUrl) ? (
                      <a
                        className="text-primary underline-offset-4 hover:underline"
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Vai alla fonte di ${item.title}`}
                      >
                        Vai alla fonte
                      </a>
                    ) : item.source !== 'Microsoft' &&
                      item.sourceUrl &&
                      isValidHttpUrl(item.sourceUrl) ? (
                      <a
                        className="text-primary underline-offset-4 hover:underline"
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Vai alla fonte di ${item.title}`}
                      >
                        Vai alla fonte
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Fonte non disponibile</span>
                    )}
                    {item.learnUrl && isValidHttpUrl(item.learnUrl) && (
                      <a
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        href={item.learnUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Apri documentazione per ${item.title}`}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z" />
                          <path d="M20 3v16" />
                          <path d="M7 7h8" />
                          <path d="M7 10h8" />
                        </svg>
                        Documentazione
                      </a>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;
