import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAllSnapshots, loadRulesConfig } from '../../services/DataLoader';
import { buildFilterMetadata } from '../../services/FilterMetadata';
import { filterReleaseItems } from '../../services/FilterService';
import {
  ALL_RELEASE_SOURCES,
  RELEASE_SOURCE_LABELS,
  getActiveSupportedSources,
  resolveActiveSources
} from '../../services/FilterDefinitions';
import { useFilterStore, type FilterState } from '../store/useFilterStore';
import { useCustomerStore } from '../store/useCustomerStore';
import { useCustomerGroupStore } from '../store/useCustomerGroupStore';
import FilterListSection from '../components/FilterListSection';
import FilterSourceToggle from '../components/FilterSourceToggle';
import type { ReleaseItem, ReleaseSource } from '../../models/ReleaseItem';
import type { FilterKey } from '../../services/FilterDefinitions';

const normalizeSelection = (values: string[], options: string[]): string[] => {
  if (values.length === 0) {
    return [];
  }
  const valid = values.filter((value) => options.includes(value));
  return valid.length > 0 ? valid : options;
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

const normalizeSelectionForSources = (
  values: string[],
  options: { value: string; sources: ReleaseSource[] }[],
  sources: ReleaseSource[],
  matchAllSources: boolean
): string[] => normalizeSelection(values, optionValuesForSources(options, sources, matchAllSources));

const isEntryActive = (entry: { isActive?: boolean }): boolean => entry.isActive !== false;

const GlobalFiltersPage = () => {
  const [snapshotItems, setSnapshotItems] = useState<ReleaseItem[]>([]);
  const [snapshotErrors, setSnapshotErrors] = useState<string[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const rulesConfig = loadRulesConfig();
  const navigate = useNavigate();
  const {
    cssFilters,
    customerFilters,
    customerFilterMode,
    setCssFilters,
    ensureCssFilters
  } = useFilterStore();
  const { index } = useCustomerStore();
  const activeIndex = useMemo(() => index.filter((entry) => isEntryActive(entry)), [index]);
  const { groups } = useCustomerGroupStore();
  const [saveStatus, setSaveStatus] = useState<'saved' | 'pending'>('saved');
  const [pageIndex, setPageIndex] = useState(0);

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
  const productSourceMap = useMemo(() => {
    const map = new Map<string, ReleaseSource>();
    items.forEach((item) => {
      if (!map.has(item.productName)) {
        map.set(item.productName, item.source);
      }
    });
    return map;
  }, [items]);
  const productsBySource = useMemo(() => {
    const map = new Map<ReleaseSource, string[]>();
    items.forEach((item) => {
      const list = map.get(item.source) ?? [];
      if (!list.includes(item.productName)) {
        list.push(item.productName);
        map.set(item.source, list);
      }
    });
    return map;
  }, [items]);
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
  const cssOwnerOptions = useMemo(() => {
    const counts = new Map<string, number>();
    activeIndex.forEach((entry) => {
      if (!entry.ownerCss) {
        return;
      }
      counts.set(entry.ownerCss, (counts.get(entry.ownerCss) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([value, count]) => ({
        value,
        label: value,
        count,
        sources: ALL_RELEASE_SOURCES
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [activeIndex]);
  const customerOptions = useMemo(
    () =>
      activeIndex
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => ({
          value: entry.id,
          label: entry.name,
          count: 1,
          sources: ALL_RELEASE_SOURCES
        })),
    [activeIndex]
  );
  const groupOptions = useMemo(
    () =>
      groups
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((group) => ({
          value: group.id,
          label: group.name,
          count: group.customerIds.length,
          sources: ALL_RELEASE_SOURCES
        })),
    [groups]
  );

  const defaultFilters: FilterState = useMemo(
    () => ({
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
      horizonMonths: rulesConfig.defaults.horizonMonths,
      historyMonths: rulesConfig.defaults.historyMonths
    }),
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

  useEffect(() => {
    if (!cssFilters) {
      return;
    }
    if (cssFilters.targetCssOwners.length > 0 && cssFilters.targetGroupIds.length > 0) {
      setCssFilters({ ...cssFilters, targetCssOwners: [] });
    }
  }, [cssFilters, setCssFilters]);

  const normalizedGlobal = useMemo(() => {
    if (!cssFilters) {
      return defaultFilters;
    }
    const merged = { ...defaultFilters, ...cssFilters };
    const sources = normalizeSelection(merged.sources, sourceOptions) as ReleaseSource[];
    const matchAllSources = false;
    const productSelection = normalizeSelectionForSources(
      merged.products,
      metadata.products,
      sources,
      matchAllSources
    );
    const statuses = normalizeSelectionForSources(
      merged.statuses,
      metadata.statuses,
      sources,
      matchAllSources
    );
    const categories = normalizeSelectionForSources(
      merged.categories,
      metadata.categories,
      sources,
      matchAllSources
    );
    const tags = normalizeSelectionForSources(
      merged.tags,
      metadata.tags,
      sources,
      matchAllSources
    );
    const waves = normalizeSelectionForSources(
      merged.waves,
      metadata.waves,
      sources,
      matchAllSources
    );
    const months = normalizeSelectionForSources(
      merged.months,
      metadata.months,
      sources,
      matchAllSources
    );
    const availabilityTypes = normalizeSelectionForSources(
      merged.availabilityTypes,
      metadata.availabilityTypes,
      sources,
      matchAllSources
    );
    const enabledFor = normalizeSelectionForSources(
      merged.enabledFor,
      metadata.enabledFor,
      sources,
      matchAllSources
    );
    const geography = normalizeSelectionForSources(
      merged.geography,
      metadata.geography,
      sources,
      matchAllSources
    );
    const language = normalizeSelectionForSources(
      merged.language,
      metadata.language,
      sources,
      matchAllSources
    );
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
      statuses,
      categories,
      tags,
      waves,
      months,
      availabilityTypes,
      enabledFor,
      geography,
      language
    };
  }, [
    defaultFilters,
    cssFilters,
    productOptions,
    sourceOptions,
    statusOptions,
    metadata.products,
    metadata.statuses,
    metadata.categories,
    metadata.tags,
    metadata.waves,
    metadata.months,
    metadata.availabilityTypes,
    metadata.enabledFor,
    metadata.geography,
    metadata.language,
    productSourceMap,
    productsBySource
  ]);

  const updateFilters = (next: Partial<FilterState>) => {
    setSaveStatus('pending');
    setCssFilters({ ...normalizedGlobal, ...next });
    setTimeout(() => setSaveStatus('saved'), 200);
  };

  const onReset = () => {
    setSaveStatus('pending');
    setCssFilters(defaultFilters);
    setTimeout(() => setSaveStatus('saved'), 200);
  };

  const activeSources = resolveActiveSources(
    (normalizedGlobal.sources ?? []) as ReleaseSource[]
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
    const toKeep = normalizedGlobal.products.filter(
      (product) => productSourceMap.get(product) !== source
    );
    const merged = Array.from(new Set([...toKeep, ...next]));
    updateFilters({ products: merged });
  };
  const normalizeFiltersForOverrides = (raw: FilterState): FilterState => {
    const merged = { ...defaultFilters, ...raw };
    const sources = normalizeSelection(merged.sources, sourceOptions) as ReleaseSource[];
    const productSelection = normalizeSelectionForSources(
      merged.products,
      metadata.products,
      sources,
      matchAllSources
    );
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
      tags: normalizeSelectionForSources(merged.tags, metadata.tags, sources, matchAllSources),
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
  const targetCustomerIds = useMemo(() => {
    const selected = new Set<string>(normalizedGlobal.targetCustomerIds);
    const groupMap = new Map(groups.map((group) => [group.id, group.customerIds]));
    normalizedGlobal.targetGroupIds.forEach((groupId) => {
      (groupMap.get(groupId) ?? []).forEach((id) => selected.add(id));
    });
    return selected;
  }, [groups, normalizedGlobal.targetCustomerIds, normalizedGlobal.targetGroupIds]);
  const ownerCustomerIds = useMemo(() => {
    if (normalizedGlobal.targetCssOwners.length === 0) {
      return new Set<string>();
    }
    const owners = new Set(normalizedGlobal.targetCssOwners);
    const selected = new Set<string>();
    activeIndex.forEach((entry) => {
      if (entry.ownerCss && owners.has(entry.ownerCss)) {
        selected.add(entry.id);
      }
    });
    return selected;
  }, [activeIndex, normalizedGlobal.targetCssOwners]);
  const activeCustomerIds = useMemo(
    () => new Set(activeIndex.map((entry) => entry.id)),
    [activeIndex]
  );
  const includedCustomerIds = useMemo(() => {
    if (normalizedGlobal.targetCssOwners.length > 0 && targetCustomerIds.size > 0) {
      return new Set(
        Array.from(ownerCustomerIds).filter((id) => targetCustomerIds.has(id))
      );
    }
    if (normalizedGlobal.targetCssOwners.length > 0) {
      return ownerCustomerIds;
    }
    if (targetCustomerIds.size > 0) {
      return targetCustomerIds;
    }
    return new Set(activeIndex.map((entry) => entry.id));
  }, [
    activeIndex,
    normalizedGlobal.targetCssOwners.length,
    ownerCustomerIds,
    targetCustomerIds
  ]);
  const activeIncludedCustomerIds = useMemo(
    () =>
      new Set(
        Array.from(includedCustomerIds).filter((id) => activeCustomerIds.has(id))
      ),
    [activeCustomerIds, includedCustomerIds]
  );
  const groupNamesByCustomerId = useMemo(() => {
    const map = new Map<string, string[]>();
    groups.forEach((group) => {
      group.customerIds.forEach((id) => {
        const list = map.get(id) ?? [];
        if (!list.includes(group.name)) {
          list.push(group.name);
          map.set(id, list);
        }
      });
    });
    return map;
  }, [groups]);
  const customerPreview = useMemo(() => {
    const globalFilteredItems = filterReleaseItems(items, normalizedGlobal);
    const globalProductsCount = globalFilteredItems.length;
    const overrideCustomers = new Set(
      Object.entries(customerFilterMode)
        .filter(([id, mode]) => mode === 'custom' && customerFilters[id])
        .map(([id]) => id)
    );
    const overrideCounts = new Map<string, number>();
    overrideCustomers.forEach((id) => {
      const raw = customerFilters[id];
      if (!raw) {
        return;
      }
      const normalized = normalizeFiltersForOverrides(raw);
      overrideCounts.set(id, filterReleaseItems(items, normalized).length);
    });
    const entries = activeIndex
      .filter((entry) => activeIncludedCustomerIds.has(entry.id))
      .map((entry) => {
        const hasOverride =
          (customerFilterMode[entry.id] ?? 'inherit') === 'custom' &&
          Boolean(customerFilters[entry.id]);
        const productsCount = hasOverride
          ? overrideCounts.get(entry.id) ?? globalProductsCount
          : globalProductsCount;
        return {
          ...entry,
          groups: groupNamesByCustomerId.get(entry.id) ?? [],
          productsCount,
          hasOverride
        };
      })
      .sort((a, b) => {
        if (b.productsCount !== a.productsCount) {
          return b.productsCount - a.productsCount;
        }
        return a.name.localeCompare(b.name);
      });
    const totalProductsCount = entries.length > 0 ? globalProductsCount : 0;
    const avgProductsPerCustomer = entries.length > 0 ? globalProductsCount : 0;
    const overridesCount = entries.filter((entry) => entry.hasOverride).length;
    const inheritedSample = entries.find((entry) => !entry.hasOverride) ?? null;
    const overrideSample = entries.find((entry) => entry.hasOverride) ?? null;
    return {
      entries,
      totalProductsCount,
      avgProductsPerCustomer,
      overridesCount,
      globalProductsCount,
      inheritedSample,
      overrideSample
    };
  }, [
    customerFilters,
    customerFilterMode,
    groupNamesByCustomerId,
    activeIncludedCustomerIds,
    activeIndex,
    items,
    normalizedGlobal
  ]);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(customerPreview.entries.length / pageSize));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const visibleCustomers = useMemo(() => {
    const start = clampedPageIndex * pageSize;
    return customerPreview.entries.slice(start, start + pageSize);
  }, [clampedPageIndex, customerPreview.entries]);
  const avgProductsValue = customerPreview.avgProductsPerCustomer;
  const avgProductsLabel = Number.isInteger(avgProductsValue)
    ? String(avgProductsValue)
    : avgProductsValue.toFixed(1);
  const hasGroupSelection = normalizedGlobal.targetGroupIds.length > 0;
  const hasOwnerSelection = normalizedGlobal.targetCssOwners.length > 0;
  const isOwnerDisabled = hasGroupSelection;
  const isGroupDisabled = hasOwnerSelection;
  const ownerBadgeLabel = isOwnerDisabled
    ? 'Owner CSS: disabilitato per conflitto'
    : normalizedGlobal.targetCssOwners.length === 0
      ? 'Owner CSS: Tutti'
      : `Owner CSS: ${normalizedGlobal.targetCssOwners.length} selezionati`;
  const groupBadgeLabel = isGroupDisabled
    ? 'Gruppi clienti: disabilitato per conflitto'
    : normalizedGlobal.targetGroupIds.length === 0
      ? 'Gruppi clienti: Tutti'
      : `Gruppi clienti: ${normalizedGlobal.targetGroupIds.length} selezionati`;

  const onChangeGroupIds = (next: string[]) => {
    updateFilters({
      targetGroupIds: next,
      targetCssOwners: next.length > 0 ? [] : normalizedGlobal.targetCssOwners
    });
  };
  const onChangeCssOwnerIds = (next: string[]) => {
    updateFilters({
      targetCssOwners: next,
      targetGroupIds: next.length > 0 ? [] : normalizedGlobal.targetGroupIds
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Filtri</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Questi filtri sono il default del sistema e vengono ereditati dai clienti.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
            {groupBadgeLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
            {ownerBadgeLabel}
          </span>
          <span>Salvataggio automatico: ON</span>
          <span>{saveStatus === 'saved' ? 'Salvato' : 'Non salvato'}</span>
          <button className="ul-button ul-button-ghost" onClick={onReset}>
            Ripristina filtri
          </button>
          <button
            className="ul-button ul-button-primary"
            onClick={() => navigate('/')}
          >
            Applica ora e torna alla dashboard
          </button>
        </div>
      </header>
      {snapshotErrors.length > 0 && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Errore caricamento dati: {snapshotErrors.join(' | ')}
        </div>
      )}

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
            selected={normalizedGlobal.targetCssOwners}
            onChange={onChangeCssOwnerIds}
            defaultOpen
            activeSources={ALL_RELEASE_SOURCES}
            maxVisible={12}
            disabled={isOwnerDisabled}
          />
          {isOwnerDisabled && (
            <div className="mt-2 text-xs text-amber-400">
              Owner CSS disabilitato: è attivo il filtro Gruppi clienti.
            </div>
          )}
          <div className="mt-3 text-xs text-muted-foreground">
            Regola combinazione: Owner CSS usa logica OR. Il filtro Gruppi clienti
            è mutuamente esclusivo con Owner CSS.
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="ul-surface px-3 py-2">
              <div className="text-xs uppercase text-muted-foreground">Clienti inclusi</div>
              <div className="mt-1 text-lg font-semibold">
                {customerPreview.entries.length}
              </div>
            </div>
            <div className="ul-surface px-3 py-2">
              <div className="text-xs uppercase text-muted-foreground">
                Prodotti assegnati (totale)
              </div>
              <div className="mt-1 text-lg font-semibold">
                {customerPreview.totalProductsCount}
              </div>
              {customerPreview.overridesCount > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  {customerPreview.overridesCount} clienti con override
                </div>
              )}
            </div>
            <div className="ul-surface px-3 py-2">
              <div className="text-xs uppercase text-muted-foreground">
                Media prodotti per cliente
              </div>
              <div className="mt-1 text-lg font-semibold">{avgProductsLabel}</div>
              <div className="text-[11px] text-muted-foreground">
                Fonte dati: release items filtrati (snapshot)
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Clienti inclusi</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Totale: {customerPreview.entries.length}
              </div>
            </div>
            {customerPreview.entries.length > pageSize && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <button
                  className="ul-button ul-button-ghost px-2 py-1 text-xs"
                  onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                  disabled={clampedPageIndex === 0}
                >
                  Precedente
                </button>
                <span>
                  Pagina {clampedPageIndex + 1} di {totalPages}
                </span>
                <button
                  className="ul-button ul-button-ghost px-2 py-1 text-xs"
                  onClick={() =>
                    setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))
                  }
                  disabled={clampedPageIndex >= totalPages - 1}
                >
                  Successiva
                </button>
              </div>
            )}
          </div>
          <div className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
            {visibleCustomers.map((customer) => (
              <div key={customer.id} className="ul-surface px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Prodotti: {customer.productsCount}
                    <span className="ml-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {customer.hasOverride ? 'Override' : 'Ereditato'}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Owner CSS: {customer.ownerCss || 'N/A'}
                  {customer.groups.length > 0 && ` - ${customer.groups.join(', ')}`}
                </div>
              </div>
            ))}
            {customerPreview.entries.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Nessun cliente incluso con i filtri correnti.
              </div>
            )}
          </div>
          <details className="mt-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer uppercase">Debug KPI</summary>
            <div className="mt-2 space-y-1">
              <div>GlobalProductSet: {customerPreview.globalProductsCount}</div>
              <div>CustomersIncluded: {customerPreview.entries.length}</div>
              <div>Customers with override: {customerPreview.overridesCount}</div>
              {customerPreview.inheritedSample && (
                <div>
                  Ereditato ({customerPreview.inheritedSample.name}):{' '}
                  {customerPreview.inheritedSample.productsCount}
                </div>
              )}
              {customerPreview.overrideSample && (
                <div>
                  Override ({customerPreview.overrideSample.name}):{' '}
                  {customerPreview.overrideSample.productsCount}
                </div>
              )}
            </div>
          </details>
        </div>
      </section>

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
            selected={normalizedGlobal.targetCustomerIds}
            onChange={(next) => updateFilters({ targetCustomerIds: next })}
            defaultOpen
            activeSources={ALL_RELEASE_SOURCES}
            maxVisible={12}
          />
          {groupOptions.length > 0 ? (
            <>
              <FilterListSection
                title="Gruppi clienti"
                options={groupOptions}
                selected={normalizedGlobal.targetGroupIds}
                onChange={onChangeGroupIds}
                defaultOpen
                activeSources={ALL_RELEASE_SOURCES}
                maxVisible={12}
                disabled={isGroupDisabled}
              />
              {isGroupDisabled && (
                <div className="mt-2 text-xs text-amber-400">
                  Gruppi clienti disabilitati: è attivo il filtro Owner CSS.
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

      <section className="ul-surface p-6">
        <h2 className="text-lg font-semibold">Fonte dati</h2>
        <div className="mt-3 space-y-3">
          <FilterSourceToggle
            selected={normalizedGlobal.sources as ReleaseSource[]}
            onChange={(next) => updateFilters({ sources: next })}
          />
          <div className="text-xs text-muted-foreground">
            Attive: {activeSources.map((source) => RELEASE_SOURCE_LABELS[source]).join(', ')}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="ul-surface p-6">
          <h2 className="text-lg font-semibold">Base</h2>
          {isFilterVisible('status') && hasOptionsForSources(metadata.statuses) && (
            <FilterListSection
              title="Stato"
              options={metadata.statuses}
              selected={normalizedGlobal.statuses}
              onChange={(next) => updateFilters({ statuses: next })}
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
                      selected={normalizedGlobal.products}
                      onChange={(next) => updateProductsForSource('Microsoft', next)}
                      defaultOpen
                      activeSources={['Microsoft']}
                    />
                  )}
                  {eosProducts.length > 0 && (
                    <FilterListSection
                      title="App (EOS)"
                      options={eosProducts}
                      selected={normalizedGlobal.products}
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
                  selected={normalizedGlobal.products}
                  onChange={(next) => updateFilters({ products: next })}
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
                  normalizedGlobal.minBcVersionMin !== null
                    ? String(normalizedGlobal.minBcVersionMin)
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
              selected={normalizedGlobal.months}
              onChange={(next) => updateFilters({ months: next })}
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
                value={normalizedGlobal.query}
                onChange={(event) => updateFilters({ query: event.target.value })}
                placeholder="Ricerca"
              />
            </div>
          )}
        </div>

        <div className="ul-surface p-6">
          <h2 className="text-lg font-semibold">Avanzati</h2>
          {isFilterVisible('categories') && hasOptionsForSources(metadata.categories) && (
            <FilterListSection
              title="Categorie"
              options={metadata.categories}
              selected={normalizedGlobal.categories}
              onChange={(next) => updateFilters({ categories: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('categories', sourcesFromOptions(metadata.categories))}
              matchAllSources={matchAllSources}
            />
          )}
          {isFilterVisible('tags') && hasOptionsForSources(metadata.tags) && (
            <FilterListSection
              title="Tag"
              options={metadata.tags}
              selected={normalizedGlobal.tags}
              onChange={(next) => updateFilters({ tags: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('tags', sourcesFromOptions(metadata.tags))}
              matchAllSources={matchAllSources}
            />
          )}
          {isFilterVisible('wave') && hasOptionsForSources(metadata.waves) && (
            <FilterListSection
              title="Wave"
              options={metadata.waves}
              selected={normalizedGlobal.waves}
              onChange={(next) => updateFilters({ waves: next })}
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
              selected={normalizedGlobal.availabilityTypes}
              onChange={(next) => updateFilters({ availabilityTypes: next })}
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
              selected={normalizedGlobal.enabledFor}
              onChange={(next) => updateFilters({ enabledFor: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('enabledFor', sourcesFromOptions(metadata.enabledFor))}
              matchAllSources={matchAllSources}
            />
          )}
          {isFilterVisible('geography') && hasOptionsForSources(metadata.geography) && (
            <FilterListSection
              title="Geografia"
              options={metadata.geography}
              selected={normalizedGlobal.geography}
              onChange={(next) => updateFilters({ geography: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('geography', sourcesFromOptions(metadata.geography))}
              matchAllSources={matchAllSources}
            />
          )}
          {isFilterVisible('language') && hasOptionsForSources(metadata.language) && (
            <FilterListSection
              title="Lingua"
              options={metadata.language}
              selected={normalizedGlobal.language}
              onChange={(next) => updateFilters({ language: next })}
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
                      value={normalizedGlobal.periodNewDays}
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
                      value={normalizedGlobal.periodChangedDays}
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
                      value={normalizedGlobal.releaseInDays}
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
                        value={normalizedGlobal.releaseDateFrom}
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
                        value={normalizedGlobal.releaseDateTo}
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
                value={normalizedGlobal.sortOrder}
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
              <div className="text-xs uppercase text-muted-foreground">
                Storico (mesi)
              </div>
              <select
                className="ul-input mt-2 text-xs"
                value={normalizedGlobal.historyMonths}
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
        </div>
      </section>
    </div>
  );
};

export default GlobalFiltersPage;
