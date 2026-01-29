import { useEffect, useMemo, useState, useRef } from 'react';
import { loadAllSnapshots, loadRulesConfig } from '../../services/DataLoader';
import { filterReleaseItems } from '../../services/FilterService';
import { buildMarkdown, downloadMarkdown } from '../../services/ExportService';
import type { ReleaseItem, ReleaseSource, ReleaseStatus } from '../../models/ReleaseItem';
import { useCustomerStore } from '../store/useCustomerStore';
import { useCustomerGroupStore } from '../store/useCustomerGroupStore';
import { useFilterStore, type FilterState } from '../store/useFilterStore';
import { usePresetStore } from '../store/usePresetStore';
import { computeDashboardKpis } from '../../services/KpiService';
import {
  buildBcVersionOptions,
  buildFilterMetadata,
  normalizeProductLabel
} from '../../services/FilterMetadata';
import { ALL_RELEASE_SOURCES } from '../../services/FilterDefinitions';
import {
  createDefaultFilters,
  buildNormalizationContext,
  selectEffectiveFilters,
  stripTargetingFields
} from '../../services/FilterNormalization';
import FiltersPanel from '../components/FiltersPanel';
import { isValidHttpUrl } from '../../utils/url';
import { getProductColor } from '../../utils/productColors';

type Chip = {
  label: string;
  onRemove: () => void;
};

type DrillSource = ReleaseSource | null;

const isEntryActive = (entry: { isActive?: boolean }): boolean => entry.isActive !== false;

const DashboardPage = () => {
  const [snapshotItems, setSnapshotItems] = useState<ReleaseItem[]>([]);
  const [snapshotErrors, setSnapshotErrors] = useState<string[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const rulesConfig = loadRulesConfig();
  const { index, activeCustomerId, customers } = useCustomerStore();
  const { groups } = useCustomerGroupStore();
  const {
    cssFilters,
    customerFilters,
    customerFilterMode,
    ensureCssFilters,
    chatFilters,
    clearChatFilters
  } = useFilterStore();

  // Preset management (session-only in Dashboard)
  const { presets, getPreset, applyPresetToFilters, activePresetId, getDefaultPreset } = usePresetStore();
  const [sessionPresetId, setSessionPresetId] = useState<string | null>(null);

  const [tempFilters, setTempFilters] = useState<Partial<FilterState>>({});
  const activeCustomer = activeCustomerId ? customers[activeCustomerId] : null;
  const debugLoggedRef = useRef(false);

  // Sync session preset with active preset from store on mount
  useEffect(() => {
    // Only when no customer is selected (global scope)
    if (activeCustomerId) {
      return;
    }

    // If there's an active preset in the store (from GlobalFiltersPage), use it
    if (activePresetId) {
      console.log('[Dashboard] Syncing with active preset from store:', activePresetId);
      setSessionPresetId(activePresetId);
      return;
    }

    // Otherwise, use the Default preset if available
    const defaultPreset = getDefaultPreset();
    if (defaultPreset) {
      console.log('[Dashboard] No active preset, using Default preset:', defaultPreset.id);
      setSessionPresetId(defaultPreset.id);
    }
  }, []); // Run once on mount

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
  const bcVersionOptions = useMemo(() => buildBcVersionOptions(items), [items]);
  const activeIndex = useMemo(() => index.filter((entry) => isEntryActive(entry)), [index]);
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
    const result = selectEffectiveFilters(
      activeCustomerId,
      cssFilters,
      customerFilters,
      customerFilterMode,
      defaultFilters,
      normContext
    );
    console.log('[Dashboard] persistentBaseFilters recomputed:', {
      products: result?.products.length,
      sources: result?.sources.length,
      statuses: result?.statuses.length
    });
    return result;
  }, [
    filtersReady,
    activeCustomerId,
    cssFilters,
    customerFilters,
    customerFilterMode,
    defaultFilters,
    normContext
  ]);

  // Reset tempFilters, chatFilters and drill state when activeCustomerId changes
  useEffect(() => {
    setTempFilters({});
    clearChatFilters();
    setDrillSource(null);
    setDrillProduct(null);

    // When switching back to global scope, resync with active preset
    if (!activeCustomerId) {
      const currentActivePreset = activePresetId || getDefaultPreset()?.id;
      if (currentActivePreset) {
        setSessionPresetId(currentActivePreset);
      }
    } else {
      // Clear session preset when customer is selected (preset selector will be hidden anyway)
      setSessionPresetId(null);
    }
  }, [activeCustomerId, clearChatFilters, activePresetId, getDefaultPreset]);

  // =====================================================================
  // Dashboard filters (REGOLA 1, 2, 3, 5):
  // - "Tutti clienti" → exact copy of cssFilters (global filters)
  // - Cliente inherit → exact copy of cssFilters
  // - Cliente custom → exact copy of customerFilters[id]
  // - chatFilters from chatbot overlaid (temporary, NOT persisted)
  // - tempFilters overlaid for temporary view changes only
  // - Targeting fields always stripped (REGOLA 5)
  // =====================================================================
  const dashboardFilters = useMemo(() => {
    if (!persistentBaseFilters) {
      return null;
    }
    // Priority: persistentBaseFilters < tempFilters < chatFilters
    let merged = persistentBaseFilters;
    if (Object.keys(tempFilters).length > 0) {
      merged = { ...merged, ...tempFilters };
    }
    if (chatFilters && Object.keys(chatFilters).length > 0) {
      merged = { ...merged, ...chatFilters };
    }
    return stripTargetingFields(merged);
  }, [persistentBaseFilters, tempFilters, chatFilters]);

  // updateFilters: local-only, does NOT persist to store
  // Also clears chatFilters when user manually changes filters
  const updateFilters = (nextFilters: Partial<FilterState>) => {
    if (chatFilters) {
      clearChatFilters();
    }
    setTempFilters((prev) => ({ ...prev, ...nextFilters }));
  };

  // Preset selection handler (Dashboard only, session-only)
  const handlePresetSelect = (presetId: string) => {
    console.log('[Dashboard] handlePresetSelect called with presetId:', presetId);
    setSessionPresetId(presetId);
    applyPresetToFilters(presetId);
    setTempFilters({}); // Clear temp filters to show pure preset effect
    console.log('[Dashboard] handlePresetSelect completed');
  };

  const filterScope = activeCustomerId ? 'customer' : 'global';
  const hasOwnerSelection = (dashboardFilters?.targetCssOwners.length ?? 0) > 0;
  const hasGroupSelection = (dashboardFilters?.targetGroupIds.length ?? 0) > 0;
  const isGroupDisabled = hasOwnerSelection || filterScope === 'customer';
  const isOwnerDisabled = hasGroupSelection || filterScope === 'customer';

  const onChangeGroupIds = (next: string[]) => {
    updateFilters({
      targetGroupIds: next,
      targetCssOwners: next.length > 0 ? [] : (dashboardFilters?.targetCssOwners ?? [])
    });
  };

  const onChangeCssOwnerIds = (next: string[]) => {
    updateFilters({
      targetCssOwners: next,
      targetGroupIds: next.length > 0 ? [] : (dashboardFilters?.targetGroupIds ?? [])
    });
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
      bcVersions: dashboardFilters.bcVersions,
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
  const dashboardKpis = useMemo(() => {
    const kpis = computeDashboardKpis(filteredItems);
    console.log('[Dashboard] dashboardKpis recomputed:', kpis);
    return kpis;
  }, [filteredItems]);

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

    console.log('[Dashboard] FILTER_STATE', {
      'baseline.availabilityTypes': persistentBaseFilters.availabilityTypes,
      'temp.availabilityTypes': tempFilters.availabilityTypes ?? null,
      'effective.availabilityTypes': dashboardFilters.availabilityTypes,
      itemsBefore: items.length,
      itemsAfter: filteredItems.length
    });

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

  // Track cssFilters changes for preset debugging
  useEffect(() => {
    if (cssFilters) {
      console.log('[Dashboard] cssFilters changed:', {
        products: cssFilters.products.length,
        sources: cssFilters.sources.length,
        statuses: cssFilters.statuses.length
      });
    }
  }, [cssFilters]);

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
    if (dashboardFilters.bcVersions.length > 0) {
      pushValues('BC', 'bcVersions', dashboardFilters.bcVersions);
    } else if (dashboardFilters.minBcVersionMin !== null) {
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

  const asChip = (
    label: string,
    value: string | number | null | undefined,
    key: string
  ) => {
    if (value === null || value === undefined) {
      return null;
    }
    const text = typeof value === 'string' ? value.trim() : value;
    if (text === '') {
      return null;
    }
    return (
      <span className="ul-chip" key={key}>
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

        {!activeCustomerId && presets.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-xs uppercase text-muted-foreground">Preset</div>
            <select
              value={sessionPresetId || ''}
              onChange={(e) => e.target.value && handlePresetSelect(e.target.value)}
              className="w-full rounded-md border-border bg-sidebar text-sidebar-foreground px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Seleziona preset...</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} {preset.isDefault ? '⭐' : ''}
                </option>
              ))}
            </select>
            {sessionPresetId && (
              <div className="mt-1 text-[10px] text-muted-foreground">
                Preset attivo: {getPreset(sessionPresetId)?.name}
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          {dashboardFilters && (
            <FiltersPanel
              filters={dashboardFilters}
              onChange={updateFilters}
              metadata={metadata}
              options={{
                bcVersionOptions,
                cssOwnerOptions,
                customerOptions,
                groupOptions
              }}
              hideSections={{
                includedCustomers: true
              }}
              onChangeCssOwnerIds={onChangeCssOwnerIds}
              onChangeGroupIds={onChangeGroupIds}
              isOwnerDisabled={isOwnerDisabled}
              isGroupDisabled={isGroupDisabled}
              filterScope={filterScope}
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
            {chatFilters && Object.keys(chatFilters).length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Filtri da chat attivi
                </span>
                <button
                  type="button"
                  onClick={clearChatFilters}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Rimuovi filtri chat"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
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
        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <button
            className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-primary/50 ${
              !isDrillActive ? 'ring-2 ring-primary' : ''
            }`}
            onClick={resetDrill}
          >
            <div className="text-xs uppercase text-muted-foreground">Totale</div>
            <div className="mt-3 text-3xl font-semibold">{dashboardKpis.total}</div>
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
              {dashboardKpis.Microsoft}
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
              {dashboardKpis.EOS}
            </div>
            {drillSource === 'EOS' && drillProduct && (
              <div className="mt-1 text-xs text-muted-foreground">
                Prodotto: {drilledItems.length}
              </div>
            )}
          </button>
          <button
            className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-teal-500/50 ${
              drillSource === 'Fabric' ? 'ring-2 ring-teal-500' : ''
            }`}
            onClick={() => handleDrillSource('Fabric')}
          >
            <div className="text-xs uppercase text-muted-foreground">Fabric</div>
            <div className="mt-3 text-3xl font-semibold text-teal-600">
              {dashboardKpis.Fabric}
            </div>
            {drillSource === 'Fabric' && drillProduct && (
              <div className="mt-1 text-xs text-muted-foreground">
                Prodotto: {drilledItems.length}
              </div>
            )}
          </button>
          <button
            className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-purple-500/50 ${
              drillSource === 'MICROSOFT 365' ? 'ring-2 ring-purple-500' : ''
            }`}
            onClick={() => handleDrillSource('MICROSOFT 365')}
          >
            <div className="text-xs uppercase text-muted-foreground">
              MICROSOFT 365
            </div>
            <div className="mt-3 text-3xl font-semibold text-purple-600">
              {dashboardKpis['MICROSOFT 365']}
            </div>
            {drillSource === 'MICROSOFT 365' && drillProduct && (
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
                asChip('Wave', item.wave, `wave-${item.wave ?? 'none'}`),
                ...availabilityTypeValues.map((value, index) =>
                  asChip('Availability', value, `availability-${value}-${index}`)
                ),
                ...releaseTypeValues.map((value, index) =>
                  asChip('Release', value, `release-${value}-${index}`)
                ),
                asChip('BC', item.minBcVersion, `bc-${item.minBcVersion ?? 'none'}`)
              ].filter(Boolean);
              const sourceLink = item.sourceUrl ?? item.url;
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
                    {sourceLink && isValidHttpUrl(sourceLink) ? (
                      <a
                        className="text-primary underline-offset-4 hover:underline"
                        href={sourceLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Vai alla fonte di ${item.title}`}
                      >
                        Vai alla fonte
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Fonte non disponibile</span>
                    )}
                    {item.learnUrl &&
                      isValidHttpUrl(item.learnUrl) &&
                      item.learnUrl !== sourceLink && (
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
