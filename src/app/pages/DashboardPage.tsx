import { useEffect, useMemo, useState, useRef } from 'react';
import { loadAllSnapshots, loadRulesConfig } from '../../services/DataLoader';
import { filterReleaseItems } from '../../services/FilterService';
import { buildMarkdown, downloadMarkdown } from '../../services/ExportService';
import type { ReleaseItem, ReleaseSource, ReleaseStatus } from '../../models/ReleaseItem';
import { useCustomerStore } from '../store/useCustomerStore';
import { useFilterStore, type FilterState } from '../store/useFilterStore';
import { buildFilterMetadata, normalizeProductLabel } from '../../services/FilterMetadata';
import {
  createDefaultFilters,
  buildNormalizationContext,
  selectEffectiveFilters,
  stripTargetingFields
} from '../../services/FilterNormalization';
import FiltersPanel from '../components/FiltersPanel';
import { isValidHttpUrl } from '../../utils/url';
import { isReleasePlansUrl, isValidGuid } from '../../utils/releaseplans';
import { getProductColor } from '../../utils/productColors';

type Chip = {
  label: string;
  onRemove: () => void;
};

type DrillSource = ReleaseSource | null;

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
    ensureCssFilters
  } = useFilterStore();
  const [tempFilters, setTempFilters] = useState<Partial<FilterState>>({});
  const activeCustomer = activeCustomerId ? customers[activeCustomerId] : null;
  const debugLoggedRef = useRef(false);

  // =====================================================================
  // DRILL-DOWN STATE (UI only, no persistence)
  // =====================================================================
  const [drillSource, setDrillSource] = useState<DrillSource>(null);
  const [drillProduct, setDrillProduct] = useState<string | null>(null);

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

  // Ensure cssFilters are initialized (only once when data is ready)
  useEffect(() => {
    if (!snapshotsLoaded) {
      return;
    }
    ensureCssFilters(defaultFilters);
  }, [ensureCssFilters, defaultFilters, snapshotsLoaded]);

  const activeMode =
    activeCustomerId ? customerFilterMode[activeCustomerId] ?? 'inherit' : 'inherit';

  // Check if context is ready for filtering
  const contextReady =
    normContext.sourceOptions.length > 0 && normContext.metadata.products.length > 0;
  const filtersReady = snapshotsLoaded && contextReady && cssFilters !== null;

  // =====================================================================
  // SINGLE SOURCE OF TRUTH: Use selectEffectiveFilters
  // This is the SAME function used by GlobalFiltersPage
  // =====================================================================
  const persistentBaseFilters = useMemo(() => {
    if (!filtersReady) {
      return null;
    }
    return selectEffectiveFilters(
      activeCustomerId,
      cssFilters,
      customerFilters,
      customerFilterMode,
      defaultFilters,
      normContext
    );
  }, [
    filtersReady,
    activeCustomerId,
    cssFilters,
    customerFilters,
    customerFilterMode,
    defaultFilters,
    normContext
  ]);

  // Reset tempFilters and drill state when activeCustomerId changes
  useEffect(() => {
    setTempFilters({});
    setDrillSource(null);
    setDrillProduct(null);
  }, [activeCustomerId]);

  // =====================================================================
  // Dashboard filters (REGOLA 1, 2, 3, 5):
  // - "Tutti clienti" → exact copy of cssFilters (global filters)
  // - Cliente inherit → exact copy of cssFilters
  // - Cliente custom → exact copy of customerFilters[id]
  // - tempFilters overlaid for temporary view changes only
  // - Targeting fields always stripped (REGOLA 5)
  // =====================================================================
  const dashboardFilters = useMemo(() => {
    if (!persistentBaseFilters) {
      return null;
    }
    // Merge with tempFilters (temporary view changes only, no persistence)
    const merged = Object.keys(tempFilters).length > 0
      ? { ...persistentBaseFilters, ...tempFilters }
      : persistentBaseFilters;
    // Strip targeting fields - Dashboard ignores customer targeting (REGOLA 5)
    return stripTargetingFields(merged);
  }, [persistentBaseFilters, tempFilters]);


  // updateFilters: local-only, does NOT persist to store
  // NEVER calls setCssFilters/setCustomerFilters/setCustomerMode/applyGlobalToCustomers
  const updateFilters = (nextFilters: Partial<FilterState>) => {
    setTempFilters((prev) => ({ ...prev, ...nextFilters }));
  };

  // Reset temporary filters to baseline
  const resetTempFilters = () => {
    setTempFilters({});
  };

  // =====================================================================
  // Filter items using dashboardFilters (with targeting fields stripped)
  // =====================================================================
  const filteredItems = useMemo(() => {
    if (!dashboardFilters) {
      // Pass-through: if filters not ready, show all items
      return items;
    }
    return filterReleaseItems(items, {
      targetCustomerIds: dashboardFilters.targetCustomerIds,
      targetGroupIds: dashboardFilters.targetGroupIds,
      targetCssOwners: dashboardFilters.targetCssOwners,
      products: dashboardFilters.products,
      sources: dashboardFilters.sources as ReleaseSource[],
      statuses: dashboardFilters.statuses as ReleaseStatus[],
      categories: dashboardFilters.categories,
      tags: dashboardFilters.tags,
      waves: dashboardFilters.waves,
      months: dashboardFilters.months,
      availabilityTypes: dashboardFilters.availabilityTypes,
      enabledFor: dashboardFilters.enabledFor,
      geography: dashboardFilters.geography,
      language: dashboardFilters.language,
      periodNewDays: dashboardFilters.periodNewDays,
      periodChangedDays: dashboardFilters.periodChangedDays,
      releaseInDays: dashboardFilters.releaseInDays,
      minBcVersionMin: dashboardFilters.minBcVersionMin,
      releaseDateFrom: dashboardFilters.releaseDateFrom,
      releaseDateTo: dashboardFilters.releaseDateTo,
      sortOrder: dashboardFilters.sortOrder,
      query: dashboardFilters.query,
      horizonMonths: dashboardFilters.horizonMonths,
      historyMonths: dashboardFilters.historyMonths
    });
  }, [dashboardFilters, items]);

  // =====================================================================
  // MANDATORY DEBUG LOG - one-shot per customer change (per specification)
  // =====================================================================
  useEffect(() => {
    if (!filtersReady || !persistentBaseFilters || !dashboardFilters) {
      return;
    }
    if (debugLoggedRef.current) {
      return;
    }
    debugLoggedRef.current = true;

    console.log('[Dashboard] FILTER_DEBUG', {
      // Core context
      activeCustomerId,
      customerFilterMode: activeCustomerId ? customerFilterMode[activeCustomerId] ?? 'inherit' : null,
      // Filter sources
      'cssFilters.products.length': cssFilters?.products?.length ?? 0,
      'baseFilters.products.length': persistentBaseFilters.products.length,
      'dashboardFilters.products.length': dashboardFilters.products.length,
      'tempFilters.keys': Object.keys(tempFilters),
      // Results
      'items.length': items.length,
      'filteredItems.length': filteredItems.length,
      // Secondary filters (the ones that might eliminate items)
      'dashboardFilters.categories.length': dashboardFilters.categories.length,
      'dashboardFilters.months.length': dashboardFilters.months.length,
      'dashboardFilters.waves.length': dashboardFilters.waves.length,
      'dashboardFilters.availabilityTypes.length': dashboardFilters.availabilityTypes.length,
      'dashboardFilters.enabledFor.length': dashboardFilters.enabledFor.length,
      'dashboardFilters.geography.length': dashboardFilters.geography.length,
      'dashboardFilters.horizonMonths': dashboardFilters.horizonMonths,
      'dashboardFilters.historyMonths': dashboardFilters.historyMonths
    });
  }, [filtersReady, persistentBaseFilters, dashboardFilters, activeCustomerId, customerFilterMode, cssFilters, tempFilters, items.length, filteredItems.length]);

  // Reset debug flag when customer changes
  useEffect(() => {
    debugLoggedRef.current = false;
  }, [activeCustomerId]);

  const sortedItems = useMemo(() => {
    const order = dashboardFilters?.sortOrder ?? 'newest';
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
  }, [dashboardFilters, filteredItems]);

  // =====================================================================
  // DRILL-DOWN PIPELINE
  // baseItems = filteredItems (already filtered by sidebar)
  // drilledItems = baseItems filtered by drillSource and drillProduct
  // =====================================================================
  const drilledItems = useMemo(() => {
    let result = filteredItems;
    if (drillSource) {
      result = result.filter((item) => item.source === drillSource);
    }
    if (drillProduct) {
      result = result.filter(
        (item) => normalizeProductLabel(item.productName) === drillProduct
      );
    }
    return result;
  }, [filteredItems, drillSource, drillProduct]);

  // Sort drilled items (same logic as sortedItems)
  const sortedDrilledItems = useMemo(() => {
    const order = dashboardFilters?.sortOrder ?? 'newest';
    const toDate = (item: ReleaseItem): number => {
      const parsed = new Date(item.releaseDate).getTime();
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
      const [year, month] = item.availabilityDate.split('-').map(Number);
      return new Date(year, (month || 1) - 1, 1).getTime();
    };
    return [...drilledItems].sort((a, b) =>
      order === 'oldest' ? toDate(a) - toDate(b) : toDate(b) - toDate(a)
    );
  }, [dashboardFilters, drilledItems]);

  // Product breakdown for drill-down (Top products with count)
  const drillProductBreakdown = useMemo(() => {
    const sourceItems = drillSource
      ? filteredItems.filter((item) => item.source === drillSource)
      : filteredItems;

    const counts = new Map<string, { count: number; byStatus: Map<string, number> }>();
    sourceItems.forEach((item) => {
      const normalizedName = normalizeProductLabel(item.productName);
      const existing = counts.get(normalizedName);
      if (existing) {
        existing.count += 1;
        existing.byStatus.set(item.status, (existing.byStatus.get(item.status) ?? 0) + 1);
      } else {
        const byStatus = new Map<string, number>();
        byStatus.set(item.status, 1);
        counts.set(normalizedName, { count: 1, byStatus });
      }
    });

    return Array.from(counts.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        byStatus: Array.from(data.byStatus.entries()).map(([status, cnt]) => ({ status, count: cnt }))
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 products
  }, [filteredItems, drillSource]);

  // Drill-down handlers
  const handleDrillSource = (source: ReleaseSource) => {
    if (drillSource === source) {
      // Toggle off
      setDrillSource(null);
      setDrillProduct(null);
    } else {
      setDrillSource(source);
      setDrillProduct(null); // Reset product when changing source
    }
  };

  const handleDrillProduct = (productName: string) => {
    if (drillProduct === productName) {
      setDrillProduct(null); // Toggle off
    } else {
      setDrillProduct(productName);
    }
  };

  const resetDrill = () => {
    setDrillSource(null);
    setDrillProduct(null);
  };

  const isDrillActive = drillSource !== null || drillProduct !== null;

  const chips = useMemo<Chip[]>(() => {
    if (!dashboardFilters) {
      return [];
    }
    const entries: Chip[] = [];
    const removeFrom = (key: keyof FilterState, value: string) => {
      const current = dashboardFilters[key] as string[];
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
    pushValues('Fonte', 'sources', dashboardFilters.sources);
    pushValues('Stato', 'statuses', dashboardFilters.statuses);
    pushValues('Prodotto', 'products', dashboardFilters.products);
    pushValues('Tag', 'tags', dashboardFilters.tags);
    pushValues('Mese', 'months', dashboardFilters.months);
    if (dashboardFilters.query) {
      entries.push({
        label: `Ricerca: ${dashboardFilters.query}`,
        onRemove: () => updateFilters({ query: '' })
      });
    }
    if (dashboardFilters.periodNewDays > 0) {
      entries.push({
        label: `Nuovi: ${dashboardFilters.periodNewDays} giorni`,
        onRemove: () => updateFilters({ periodNewDays: 0 })
      });
    }
    if (dashboardFilters.periodChangedDays > 0) {
      entries.push({
        label: `Modificati: ${dashboardFilters.periodChangedDays} giorni`,
        onRemove: () => updateFilters({ periodChangedDays: 0 })
      });
    }
    if (dashboardFilters.releaseInDays > 0) {
      entries.push({
        label: `Release entro: ${dashboardFilters.releaseInDays} giorni`,
        onRemove: () => updateFilters({ releaseInDays: 0 })
      });
    }
    if (dashboardFilters.minBcVersionMin !== null) {
      entries.push({
        label: `BC Min Version >= ${dashboardFilters.minBcVersionMin}`,
        onRemove: () => updateFilters({ minBcVersionMin: null })
      });
    }
    if (dashboardFilters.releaseDateFrom) {
      entries.push({
        label: `Da: ${dashboardFilters.releaseDateFrom}`,
        onRemove: () => updateFilters({ releaseDateFrom: '' })
      });
    }
    if (dashboardFilters.releaseDateTo) {
      entries.push({
        label: `A: ${dashboardFilters.releaseDateTo}`,
        onRemove: () => updateFilters({ releaseDateTo: '' })
      });
    }
    return entries;
  }, [dashboardFilters, updateFilters]);

  const onExport = () => {
    const name = activeCustomer?.name || 'Cliente';
    const content = buildMarkdown(sortedItems, name);
    downloadMarkdown(content, 'update-lens-export.md');
  };

  const asChip = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined) {
      return null;
    }
    const text = typeof value === 'string' ? value.trim() : value;
    if (text === '') {
      return null;
    }
    return (
      <span className="ul-chip">
        {label}: {text}
      </span>
    );
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
          <div className="mt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  activeMode === 'inherit' ? 'bg-blue-500' : 'bg-amber-500'
                }`}
              />
              {activeMode === 'inherit'
                ? 'Eredita filtri CSS'
                : 'Filtri personalizzati'}
            </span>
          </div>
        )}

        <div className="mt-3 text-xs text-muted-foreground">
          {activeCustomerId
            ? `Scope: Cliente: ${activeCustomer?.name ?? 'Cliente'}`
            : 'Scope: CSS'}
        </div>

        {/* Reset filtri Dashboard button */}
        {Object.keys(tempFilters).length > 0 && (
          <button
            className="mt-3 w-full rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
            onClick={resetTempFilters}
          >
            Reset filtri Dashboard
          </button>
        )}

        <div className="mt-4">
          {dashboardFilters && (
            <FiltersPanel
              filters={dashboardFilters}
              onChange={updateFilters}
              metadata={metadata}
              options={{
                minBcVersions
              }}
              hideSections={{
                ownerCss: true,
                includedCustomers: true,
                targetCustomers: true
              }}
              productSourceMap={productSourceMap}
              variant="sidebar"
            />
          )}
        </div>
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

        {/* Drill-down badge */}
        {isDrillActive && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Drill attivo:</span>
            {drillSource && (
              <button
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                onClick={() => setDrillSource(null)}
              >
                {drillSource}
                <span className="ml-1">&times;</span>
              </button>
            )}
            {drillProduct && (
              <button
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                onClick={() => setDrillProduct(null)}
              >
                {drillProduct}
                <span className="ml-1">&times;</span>
              </button>
            )}
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={resetDrill}
            >
              Reset tutto
            </button>
          </div>
        )}

        {/* KPI Cards - Clickable for drill-down */}
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <button
            className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-primary/50 ${
              !isDrillActive ? 'ring-2 ring-primary' : ''
            }`}
            onClick={resetDrill}
          >
            <div className="text-xs uppercase text-muted-foreground">Totale</div>
            <div className="mt-3 text-3xl font-semibold">{filteredItems.length}</div>
            {isDrillActive && (
              <div className="mt-1 text-xs text-muted-foreground">
                Drilled: {drilledItems.length}
              </div>
            )}
          </button>
          <button
            className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-blue-500/50 ${
              drillSource === 'Microsoft' ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleDrillSource('Microsoft')}
          >
            <div className="text-xs uppercase text-muted-foreground">Microsoft</div>
            <div className="mt-3 text-3xl font-semibold text-blue-600">
              {filteredItems.filter((item) => item.source === 'Microsoft').length}
            </div>
            {drillSource === 'Microsoft' && drillProduct && (
              <div className="mt-1 text-xs text-muted-foreground">
                Prodotto: {drilledItems.length}
              </div>
            )}
          </button>
          <button
            className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-amber-500/50 ${
              drillSource === 'EOS' ? 'ring-2 ring-amber-500' : ''
            }`}
            onClick={() => handleDrillSource('EOS')}
          >
            <div className="text-xs uppercase text-muted-foreground">EOS</div>
            <div className="mt-3 text-3xl font-semibold text-amber-600">
              {filteredItems.filter((item) => item.source === 'EOS').length}
            </div>
            {drillSource === 'EOS' && drillProduct && (
              <div className="mt-1 text-xs text-muted-foreground">
                Prodotto: {drilledItems.length}
              </div>
            )}
          </button>
        </section>

        {/* Product breakdown (shown when drill source is active) */}
        {drillSource && (
          <section className="mt-4 ul-surface p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Top prodotti {drillSource}
              </h3>
              <span className="text-xs text-muted-foreground">
                {drillProductBreakdown.length} prodotti
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {drillProductBreakdown.map((product) => (
                <button
                  key={product.name}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all hover:bg-secondary/50 ${
                    drillProduct === product.name
                      ? 'bg-primary/10 ring-1 ring-primary'
                      : 'bg-secondary/30'
                  }`}
                  onClick={() => handleDrillProduct(product.name)}
                >
                  <span className="truncate font-medium">{product.name}</span>
                  <span className="ml-2 flex-shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {product.count}
                  </span>
                </button>
              ))}
            </div>
            {drillProduct && (
              <div className="mt-3 text-xs text-muted-foreground">
                Filtro prodotto attivo: {drillProduct} ({drilledItems.length} items)
              </div>
            )}
          </section>
        )}

        {/* Card list - uses drilledItems when drill is active */}
        <section className="mt-6 grid gap-4">
          {sortedDrilledItems.length === 0 ? (
            <div className="ul-surface p-8 text-sm text-muted-foreground">
              <div className="text-center font-medium">
                {isDrillActive
                  ? 'Nessun aggiornamento corrisponde al drill-down selezionato.'
                  : 'Nessun aggiornamento corrisponde ai filtri selezionati.'}
              </div>
              {isDrillActive && (
                <div className="mt-4 text-center">
                  <button
                    className="text-primary hover:underline"
                    onClick={resetDrill}
                  >
                    Reset drill-down
                  </button>
                </div>
              )}
              {!isDrillActive && dashboardFilters && (
                <div className="mt-4 rounded-lg bg-amber-50 p-4 text-xs text-amber-800">
                  <div className="font-semibold">Diagnostica filtri:</div>
                  <ul className="mt-2 space-y-1">
                    <li>Sources: {dashboardFilters.sources?.join(', ') || 'nessuna'}</li>
                    <li>Statuses: {dashboardFilters.statuses?.join(', ') || 'nessuno'}</li>
                    <li>Prodotti selezionati: {dashboardFilters.products?.length ?? 0} / {productOptions.length} disponibili</li>
                    <li>Items totali: {items.length}</li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            sortedDrilledItems.map((item: ReleaseItem) => {
              const productColor = getProductColor(item.productName);
              const availabilityTypes = (item.availabilityTypes ?? [])
                .map((value) => value.trim())
                .filter((value) => value.length > 0);
              const availabilityTypeValues = availabilityTypes.filter((value) =>
                /preview/i.test(value)
              );
              const releaseTypeValues = availabilityTypes.filter(
                (value) => !/preview/i.test(value)
              );
              const infoChips = [
                asChip('Wave', item.wave),
                ...availabilityTypeValues.map((value) => asChip('Availability', value)),
                ...releaseTypeValues.map((value) => asChip('Release', value)),
                asChip('BC', item.minBcVersion)
              ].filter(Boolean);
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
                      {infoChips.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {infoChips}
                        </div>
                      )}
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
