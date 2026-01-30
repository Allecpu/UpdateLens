import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';

import { loadAllSnapshots, loadRulesConfig } from '../../services/DataLoader';
import { useDebouncedInput } from '../../hooks/useDebouncedValue';
import {
  usePersistedSectionStates,
  STORAGE_KEYS
} from '../../hooks/usePersistedSectionStates';
import { buildBcVersionOptions, buildFilterMetadata } from '../../services/FilterMetadata';
import { filterReleaseItems } from '../../services/FilterService';
import {
  ALL_RELEASE_SOURCES,
  RELEASE_SOURCE_LABELS,
  getActiveSupportedSources,
  resolveActiveSources
} from '../../services/FilterDefinitions';
import {
  computeDashboardKpis,
  DASHBOARD_KPI_DEFINITIONS,
  type DashboardKpiKey
} from '../../services/KpiService';
import { useFilterStore, type FilterState } from '../store/useFilterStore';
import { useCustomerStore } from '../store/useCustomerStore';
import { useCustomerGroupStore } from '../store/useCustomerGroupStore';
import { usePresetStore } from '../store/usePresetStore';
import { useBootstrapPresets } from '../../hooks/useBootstrapPresets';
import FilterListSection from '../components/FilterListSection';
import FilterSourceToggle from '../components/FilterSourceToggle';
import PresetSelector from '../components/filters/PresetSelector';
import TimeHorizonFilter from '../components/TimeHorizonFilter';
import { isSectionActive } from '../../utils/filterSectionActive';
import type { ReleaseItem, ReleaseSource } from '../../models/ReleaseItem';
import type { FilterKey } from '../../services/FilterDefinitions';

const normalizeSelection = (values: string[], options: string[]): string[] => {
  if (values.length === 0) {
    return [];
  }
  // If options is empty (metadata not loaded yet), preserve the original values
  if (options.length === 0) {
    return values;
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

const DASHBOARD_KPI_VALUE_CLASSES: Record<DashboardKpiKey, string> = {
  total: '',
  Microsoft: 'text-blue-600',
  EOS: 'text-amber-600',
  Fabric: 'text-teal-600',
  'MICROSOFT 365': 'text-purple-600'
};

const GlobalFiltersPage = () => {
  const [snapshotItems, setSnapshotItems] = useState<ReleaseItem[]>([]);
  const [snapshotErrors, setSnapshotErrors] = useState<string[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const rulesConfig = loadRulesConfig();

  const {
    cssFilters,
    customerFilters,
    customerFilterMode,
    setCssFilters,
    setCssFiltersInMemory,
    setCustomerFilters,
    setCustomerMode,
    resetCustomerFilters,
    ensureCssFilters,
    applyGlobalToCustomers,
    autoSaveEnabled,
    setAutoSaveUserPreference,
    disableAutoSaveForPreset,
    restoreAutoSaveForDefault
  } = useFilterStore();
  const { index, activeCustomerId, customers, updateCustomer } = useCustomerStore();
  const activeIndex = useMemo(() => index.filter((entry) => isEntryActive(entry)), [index]);
  const { groups } = useCustomerGroupStore();

  // Preset management
  const { ready: presetsReady } = useBootstrapPresets();
  const {
    presets,
    activePresetId,
    getDefaultPreset,
    applyPresetToFilters,
    setActivePreset,
    isActivePresetDefault,
    updatePreset
  } = usePresetStore();

  const [saveStatus, setSaveStatus] = useState<'saved' | 'pending'>('saved');
  const [filterScope, setFilterScope] = useState<'global' | 'customer'>('global');
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (activeCustomerId) {
      setFilterScope('customer');
    } else {
      setFilterScope('global');
    }
  }, [activeCustomerId]);

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

  // Load Default preset on mount (after snapshots are loaded)
  useEffect(() => {
    if (!snapshotsLoaded) return;
    if (presets.length === 0) return;

    const defaultPreset = getDefaultPreset();
    const activeId = activePresetId;

    if (!activeId && defaultPreset) {
      applyPresetToFilters(defaultPreset.id);
      setActivePreset(defaultPreset.id);
      restoreAutoSaveForDefault(); // Default preset: restore user's auto-save preference
    } else if (activeId) {
      applyPresetToFilters(activeId);
      // Check if active preset is default and set auto-save accordingly
      const activePreset = presets.find(p => p.id === activeId);
      if (activePreset?.isDefault) {
        restoreAutoSaveForDefault();
      } else {
        disableAutoSaveForPreset();
      }
    } else if (presets.length > 0) {
      applyPresetToFilters(presets[0].id);
      setActivePreset(presets[0].id);
      // First preset might not be default
      if (presets[0].isDefault) {
        restoreAutoSaveForDefault();
      } else {
        disableAutoSaveForPreset();
      }
    }
  }, [snapshotsLoaded, presets.length]);

  const items = snapshotItems;
  const metadata = useMemo(() => buildFilterMetadata(items), [items]);
  const productSourcesByValue = useMemo(() => {
    const map = new Map<string, Set<ReleaseSource>>();
    metadata.products.forEach((option) => {
      if (!map.has(option.value)) {
        map.set(option.value, new Set(option.sources));
      } else {
        const existing = map.get(option.value);
        option.sources.forEach((source) => existing?.add(source));
      }
    });
    return map;
  }, [metadata.products]);
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
  const bcVersionValues = useMemo(
    () => bcVersionOptions.map((option) => option.value),
    [bcVersionOptions]
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
      bcVersions: [],
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

  // Normalization logic helper
  const normalizeFiltersInternal = (raw: FilterState): FilterState => {
    const merged = { ...defaultFilters, ...raw };
    const sources = normalizeSelection(merged.sources, sourceOptions) as ReleaseSource[];
    const matchAllSources = false;
    const productSelection = normalizeSelectionForSources(
      merged.products,
      metadata.products,
      sources,
      matchAllSources
    );
    return {
      ...merged,
      products: productSelection,
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
      bcVersions: normalizeSelection(merged.bcVersions, bcVersionValues),
      language: normalizeSelectionForSources(
        merged.language,
        metadata.language,
        sources,
        matchAllSources
      )
    };
  };

  const normalizedGlobal = useMemo(() => {
    if (!cssFilters) {
      return defaultFilters;
    }
    return normalizeFiltersInternal(cssFilters);
  }, [
    defaultFilters,
    cssFilters,
    productOptions,
    sourceOptions,
    statusOptions,
    metadata,
    bcVersionValues
  ]);
  const deferredNormalizedGlobal = useDeferredValue(normalizedGlobal);

  const currentFilters = useMemo(() => {
    if (filterScope === 'customer' && activeCustomerId) {
      const activeMode = customerFilterMode[activeCustomerId] ?? 'inherit';
      const activeFilters = customerFilters[activeCustomerId];
      if (activeMode === 'custom' && activeFilters) {
        return normalizeFiltersInternal(activeFilters);
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
    defaultFilters,
    sourceOptions,
    metadata,
    bcVersionValues
  ]);

  // Deferred filters for expensive computations (filterReleaseItems)
  const deferredCurrentFilters = useDeferredValue(currentFilters);

  const kpiItems = useMemo(
    () => filterReleaseItems(items, deferredCurrentFilters),
    [items, deferredCurrentFilters]
  );
  const dashboardKpis = useMemo(
    () => computeDashboardKpis(kpiItems),
    [kpiItems]
  );

  const updateFilters = (next: Partial<FilterState>) => {
    if (filterScope === 'customer' && activeCustomerId) {
      // Customer Scope: ALWAYS write to override, setting mode to custom
      // STRIP TARGETING FIELDS: they are not part of customer override
      setSaveStatus('pending');
      const safeNext = { ...next };
      delete safeNext.targetCustomerIds;
      delete safeNext.targetGroupIds;
      delete safeNext.targetCssOwners;

      // We merge with currentFilters (which might be inherited or already overridden)
      const nextFilters = { ...currentFilters, ...safeNext };
      setCustomerMode(activeCustomerId, 'custom');
      setCustomerFilters(activeCustomerId, nextFilters);
      setTimeout(() => setSaveStatus('saved'), 200);
    } else {
      // Global Scope
      // Auto-save behavior:
      // - ON (Default preset): persist changes immediately AND update the Default preset
      // - OFF (non-default preset): changes are visible but NOT persisted
      //   until user clicks "Salva modifiche" on the preset
      const nextFilters = { ...normalizedGlobal, ...next };
      if (autoSaveEnabled && isActivePresetDefault()) {
        setSaveStatus('pending');
        setCssFilters(nextFilters);
        // Also auto-update the Default preset
        const defaultPreset = getDefaultPreset();
        if (defaultPreset) {
          updatePreset(defaultPreset.id, { filters: nextFilters });
        }
        setTimeout(() => setSaveStatus('saved'), 200);
      } else {
        // Non-persistent update: only update in-memory state
        // User must explicitly save to preset via "Salva modifiche"
        setCssFiltersInMemory(nextFilters);
        // Show "non salvato" status to indicate changes need explicit save
        setSaveStatus('pending');
      }
    }
  };

  const onRevertToInherit = () => {
    if (activeCustomerId) {
      resetCustomerFilters(activeCustomerId);
      // We stay in 'customer' scope, but now it will show inherited values
    }
  };

  const onResetGlobal = () => {
    setSaveStatus('pending');
    setCssFilters(defaultFilters);
    // If on Default preset with auto-save ON, also update the preset
    if (autoSaveEnabled && isActivePresetDefault()) {
      const defaultPreset = getDefaultPreset();
      if (defaultPreset) {
        updatePreset(defaultPreset.id, { filters: defaultFilters });
      }
    }
    setTimeout(() => setSaveStatus('saved'), 200);
  };

  const onResetCustomerProducts = () => {
    if (!activeCustomerId) return;
    const confirmMessage =
      'Attenzione: questa azione resetterà i prodotti e le configurazioni del cliente selezionato, allineandolo ai filtri globali attuali. Gli override specifici verranno rimossi. Vuoi procedere con il reset del SOLO cliente corrente?';
    if (!window.confirm(confirmMessage)) {
      return;
    }

    // 1. Reset overrides for filters (inherit mode)
    resetCustomerFilters(activeCustomerId);

    // 2. Destructively reset Customer record fields
    const customer = customers[activeCustomerId];
    if (customer) {
      const resetCustomer = {
        ...customer,
        selectedProducts: normalizedGlobal.products, // or defaultFilters.products depending on requirement. using normalizedGlobal baseline
        overrides: {
          sources: normalizedGlobal.sources as ReleaseSource[],
          statuses: normalizedGlobal.statuses,
          horizonMonths: normalizedGlobal.horizonMonths,
          historyMonths: normalizedGlobal.historyMonths
        }
      };
      updateCustomer(resetCustomer);
    }
    setSaveStatus('pending');
    setTimeout(() => setSaveStatus('saved'), 500);
  };

  const handlePresetChange = (presetId: string) => {
    // CRITICAL: Always apply to cssFilters, NEVER to customerFilters
    // Even if in customer scope, preset modifies global filters only
    applyPresetToFilters(presetId);
    setActivePreset(presetId);

    // Auto-save management: disable for non-default presets, restore for default
    const targetPreset = presets.find(p => p.id === presetId);
    if (targetPreset?.isDefault) {
      restoreAutoSaveForDefault();
    } else {
      disableAutoSaveForPreset();
    }

    setSaveStatus('saved');
  };

  const activeSources = useMemo(
    () => resolveActiveSources((currentFilters.sources ?? []) as ReleaseSource[]),
    [currentFilters.sources]
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
  const isFilterVisible = (key: FilterKey): boolean =>
    getActiveSupportedSources(activeSources, key).length > 0;
  const showProductSplit = activeSources.length > 1;
  const { microsoftProducts, eosProducts, fabricProducts, m365RoadmapProducts } = useMemo(() => {
    return {
      microsoftProducts: metadata.products.filter((option) => option.sources.includes('Microsoft')),
      eosProducts: metadata.products.filter((option) => option.sources.includes('EOS')),
      fabricProducts: metadata.products.filter((option) => option.sources.includes('Fabric')),
      m365RoadmapProducts: metadata.products.filter((option) =>
        option.sources.includes('MICROSOFT 365')
      )
    };
  }, [metadata.products]);

  const updateProductsForSource = (source: ReleaseSource, next: string[]) => {
    const toKeep = currentFilters.products.filter((product) => {
      const sources = productSourcesByValue.get(product);
      return sources ? !sources.has(source) : true;
    });
    const merged = Array.from(new Set([...toKeep, ...next]));
    updateFilters({ products: merged });
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
    // CONSTRAINT: In Customer Scope, we ONLY operate on the active customer.
    // This prevents accidental preview/actions on other customers while editing an override.
    if (filterScope === 'customer' && activeCustomerId) {
      return new Set([activeCustomerId]);
    }

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
    filterScope,
    activeCustomerId,
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
  const globalProductsCount = useMemo(
    () => filterReleaseItems(items, deferredNormalizedGlobal).length,
    [items, deferredNormalizedGlobal]
  );
  const overrideCounts = useMemo(() => {
    const overrideCustomers = new Set(
      Object.entries(customerFilterMode)
        .filter(([id, mode]) => mode === 'custom' && customerFilters[id])
        .map(([id]) => id)
    );
    const counts = new Map<string, number>();
    overrideCustomers.forEach((id) => {
      const raw = customerFilters[id];
      if (!raw) {
        return;
      }
      const normalized = normalizeFiltersInternal(raw);
      counts.set(id, filterReleaseItems(items, normalized).length);
    });
    return counts;
  }, [
    customerFilters,
    customerFilterMode,
    items,
    // dependencies for normalizeFiltersInternal
    defaultFilters,
    sourceOptions,
    metadata
  ]);
  const customerPreview = useMemo(() => {
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
    overrideCounts,
    globalProductsCount
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
  const hasGroupSelection = currentFilters.targetGroupIds.length > 0;
  const hasOwnerSelection = currentFilters.targetCssOwners.length > 0;
  // Symmetrical disabling for Customer Scope or Mutual Exclusion
  const isGroupDisabled = hasOwnerSelection || (filterScope === 'customer');
  const isOwnerDisabled = hasGroupSelection || (filterScope === 'customer');

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
    | 'periods';

  // Main sections (Presets, Owner CSS, Target clienti, Fonte dati, KPIs)
  type MainSectionKey = 'presets' | 'ownerCss' | 'targetCustomers' | 'dataSources' | 'dashboardKpis';

  const defaultMainSectionStates: Record<MainSectionKey, boolean> = {
    presets: true,
    ownerCss: true,
    targetCustomers: true,
    dataSources: true,
    dashboardKpis: true
  };

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

  // Use persisted states for GlobalFiltersPage (independent from Dashboard)
  const [mainSectionStates, setMainSectionStates] = usePersistedSectionStates<Record<MainSectionKey, boolean>>(
    STORAGE_KEYS.GLOBAL_FILTERS_MAIN,
    defaultMainSectionStates
  );
  const [baseSectionStates, setBaseSectionStates] = usePersistedSectionStates<Record<SectionKey, boolean>>(
    STORAGE_KEYS.GLOBAL_FILTERS_BASE,
    defaultBaseOpenStates
  );
  const [advancedSectionStates, setAdvancedSectionStates] = usePersistedSectionStates<Record<SectionKey, boolean>>(
    STORAGE_KEYS.GLOBAL_FILTERS_ADVANCED,
    defaultAdvancedOpenStates
  );

  const toggleMainSection = useCallback((key: MainSectionKey, isOpen: boolean) => {
    setMainSectionStates((prev) => ({ ...prev, [key]: isOpen }));
  }, []);

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

  // Global expand/collapse all sections (main + base + advanced)
  const expandAllSections = useCallback(() => {
    setMainSectionStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as MainSectionKey[]) {
        next[key] = true;
      }
      return next;
    });
    setBaseSectionStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as SectionKey[]) {
        next[key] = true;
      }
      return next;
    });
    setAdvancedSectionStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as SectionKey[]) {
        next[key] = true;
      }
      return next;
    });
  }, []);

  const collapseAllSections = useCallback(() => {
    setMainSectionStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as MainSectionKey[]) {
        next[key] = false;
      }
      return next;
    });
    setBaseSectionStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as SectionKey[]) {
        next[key] = false;
      }
      return next;
    });
    setAdvancedSectionStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as SectionKey[]) {
        next[key] = false;
      }
      return next;
    });
  }, []);

  // Check if any section is collapsed (for "Espandi tutto" visibility)
  const hasCollapsedMain = Object.values(mainSectionStates).some((v) => !v);
  const hasExpandedMain = Object.values(mainSectionStates).some((v) => v);
  const hasCollapsedBase = Object.values(baseSectionStates).some((v) => !v);
  const hasExpandedBase = Object.values(baseSectionStates).some((v) => v);
  const hasCollapsedAdvanced = Object.values(advancedSectionStates).some((v) => !v);
  const hasExpandedAdvanced = Object.values(advancedSectionStates).some((v) => v);

  // Global check across all sections
  const hasAnyCollapsed = hasCollapsedMain || hasCollapsedBase || hasCollapsedAdvanced;
  const hasAnyExpanded = hasExpandedMain || hasExpandedBase || hasExpandedAdvanced;

  // Expand/Collapse All button component
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

  const ownerBadgeLabel = isOwnerDisabled
    ? (filterScope === 'customer' ? 'Owner CSS: Disabilitato (Scope cliente)' : 'Owner CSS: disabilitato per conflitto')
    : currentFilters.targetCssOwners.length === 0
      ? 'Owner CSS: Tutti'
      : `Owner CSS: ${currentFilters.targetCssOwners.length} selezionati`;
  const groupBadgeLabel = isGroupDisabled
    ? (filterScope === 'customer' ? 'Gruppi clienti: Disabilitato (Scope cliente)' : 'Gruppi clienti: disabilitato per conflitto')
    : currentFilters.targetGroupIds.length === 0
      ? 'Gruppi clienti: Tutti'
      : `Gruppi clienti: ${currentFilters.targetGroupIds.length} selezionati`;

  const onChangeGroupIds = (next: string[]) => {
    updateFilters({
      targetGroupIds: next,
      targetCssOwners: next.length > 0 ? [] : currentFilters.targetCssOwners
    });
  };
  const onChangeCssOwnerIds = (next: string[]) => {
    updateFilters({
      targetCssOwners: next,
      targetGroupIds: next.length > 0 ? [] : currentFilters.targetGroupIds
    });
  };

  // Debounced query input (300ms delay to prevent excessive filtering)
  const [localQuery, setLocalQuery] = useDebouncedInput(
    currentFilters.query,
    (value) => updateFilters({ query: value }),
    300
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-semibold">Filtri</h1>
            <div className="flex gap-2 text-xs">
              {hasAnyCollapsed && (
                <button
                  type="button"
                  className="rounded-md bg-secondary px-3 py-1.5 text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
                  onClick={expandAllSections}
                  title="Espandi tutte le sezioni"
                >
                  Espandi tutto
                </button>
              )}
              {hasAnyExpanded && (
                <button
                  type="button"
                  className="rounded-md bg-secondary px-3 py-1.5 text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
                  onClick={collapseAllSections}
                  title="Comprimi tutte le sezioni"
                >
                  Comprimi tutto
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Questi filtri sono il default del sistema e vengono ereditati dai clienti.
          </p>
          {activeCustomerId && (
            <div className="mt-4 flex items-center rounded-lg border bg-surface p-1">
              <button
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${filterScope === 'global'
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:bg-muted'
                  }`}
                onClick={() => setFilterScope('global')}
              >
                Globale
              </button>
              <button
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${filterScope === 'customer'
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:bg-muted'
                  }`}
                onClick={() => setFilterScope('customer')}
              >
                Cliente: {customers[activeCustomerId]?.name ?? '...'} (Overdrive)
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {filterScope === 'customer' && activeCustomerId && (
            (customerFilterMode[activeCustomerId] === 'custom') ? (
              <button
                className="ul-button ul-button-secondary text-xs"
                onClick={onRevertToInherit}
              >
                Torna a ereditare
              </button>
            ) : (
              <span className="text-xs italic text-muted-foreground">
                (Eredita da Global)
              </span>
            )
          )}
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
            {groupBadgeLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
            {ownerBadgeLabel}
          </span>
          <label
            className={`inline-flex items-center gap-2 ${!isActivePresetDefault() ? 'opacity-60' : ''}`}
            title={!isActivePresetDefault() ? 'Auto-save disponibile solo sul preset Default' : ''}
          >
            <input
              type="checkbox"
              className="ul-checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => {
                if (isActivePresetDefault()) {
                  setAutoSaveUserPreference(e.target.checked);
                }
              }}
              disabled={!isActivePresetDefault()}
            />
            <span>Auto-save</span>
            {!isActivePresetDefault() && (
              <span className="text-[10px] text-amber-500">(solo Default)</span>
            )}
          </label>
          <span className={saveStatus === 'saved' ? 'text-green-600' : 'text-amber-500'}>
            {saveStatus === 'saved' ? 'Salvato' : 'Non salvato'}
          </span>

          {filterScope === 'global' && (
            <button className="ul-button ul-button-ghost" onClick={onResetGlobal}>
              Ripristina filtri globali
            </button>
          )}

          {filterScope === 'customer' && activeCustomerId && (
            <button className="ul-button ul-button-ghost text-red-500 hover:bg-red-50 hover:text-red-600" onClick={onResetCustomerProducts}>
              Reset prodotti cliente
            </button>
          )}

          {filterScope !== 'customer' && (
            <button
              className="ul-button ul-button-secondary"
              disabled={activeIncludedCustomerIds.size === 0}
              onClick={() => {
                applyGlobalToCustomers(Array.from(activeIncludedCustomerIds), normalizedGlobal);
                alert(`Filtri applicati a ${activeIncludedCustomerIds.size} clienti.`);
              }}
            >
              Applica ai clienti inclusi
            </button>
          )}
        </div>
      </header>
      {snapshotErrors.length > 0 && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Errore caricamento dati: {snapshotErrors.join(' | ')}
        </div>
      )}

      {presets.length > 0 && (
        <PresetSelector
          currentFilters={normalizedGlobal}
          onPresetChange={handlePresetChange}
          disabled={!snapshotsLoaded}
          loading={!presetsReady}
          open={mainSectionStates.presets}
          onToggle={(isOpen) => toggleMainSection('presets', isOpen)}
        />
      )}

      <details
        className="ul-surface"
        open={mainSectionStates.ownerCss}
        onToggle={(e) => toggleMainSection('ownerCss', (e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-4 p-6 select-none">
          <div className="flex items-center gap-3">
            <svg
              className={`h-4 w-4 text-muted-foreground transition-transform ${mainSectionStates.ownerCss ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <div>
              <h2 className="text-lg font-semibold">Owner CSS</h2>
              {!mainSectionStates.ownerCss && (
                <p className="text-xs text-muted-foreground">
                  {currentFilters.targetCssOwners.length === 0
                    ? 'Tutti gli owner'
                    : `${currentFilters.targetCssOwners.length} selezionati`}
                </p>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Scope: CSS</div>
        </summary>
        <div className="px-6 pb-6">
          <p className="text-sm text-muted-foreground">
            Seleziona uno o piu Owner CSS per restringere l'impatto sui clienti.
          </p>
        <div className="mt-4">
          <FilterListSection
            title="Owner CSS"
            options={cssOwnerOptions}
            selected={currentFilters.targetCssOwners}
            onChange={onChangeCssOwnerIds}
            defaultOpen
            activeSources={ALL_RELEASE_SOURCES}
            maxVisible={12}
            disabled={isOwnerDisabled}
            isActive={isSectionActive('ownerCss', currentFilters)}
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
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="ul-surface px-3 py-2">
              <div className="text-xs uppercase text-muted-foreground">Clienti inclusi</div>
              <div className="mt-1 text-lg font-semibold">
                {customerPreview.entries.length}
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
        </div>
      </details>

      <details
        className="ul-surface"
        open={mainSectionStates.targetCustomers}
        onToggle={(e) => toggleMainSection('targetCustomers', (e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-4 p-6 select-none">
          <div className="flex items-center gap-3">
            <svg
              className={`h-4 w-4 text-muted-foreground transition-transform ${mainSectionStates.targetCustomers ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <div>
              <h2 className="text-lg font-semibold">Target clienti</h2>
              {!mainSectionStates.targetCustomers && (
                <p className="text-xs text-muted-foreground">
                  {currentFilters.targetGroupIds.length === 0
                    ? 'Tutti i gruppi'
                    : `${currentFilters.targetGroupIds.length} gruppi selezionati`}
                </p>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Scope: CSS</div>
        </summary>
        <div className="px-6 pb-6">
          <p className="text-sm text-muted-foreground">
            Seleziona clienti o gruppi per limitare il set di destinazione.
          </p>
        <div className="mt-4">
          {groupOptions.length > 0 ? (
            <>
              <FilterListSection
                title="Gruppi clienti"
                options={groupOptions}
                selected={currentFilters.targetGroupIds}
                onChange={onChangeGroupIds}
                defaultOpen
                activeSources={ALL_RELEASE_SOURCES}
                maxVisible={12}
                disabled={isGroupDisabled}
                isActive={isSectionActive('targetGroups', currentFilters)}
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
        </div>
      </details>

      <details
        className="ul-surface"
        open={mainSectionStates.dashboardKpis}
        onToggle={(e) => toggleMainSection('dashboardKpis', (e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer items-center gap-3 p-5 select-none">
          <svg
            className={`h-4 w-4 text-muted-foreground transition-transform ${mainSectionStates.dashboardKpis ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="text-lg font-semibold">KPI Dashboard</h2>
          {!mainSectionStates.dashboardKpis && (
            <span className="text-xs text-muted-foreground">
              Totale: {dashboardKpis.total}
            </span>
          )}
        </summary>
        <div className="grid gap-4 px-5 pb-5 md:grid-cols-4">
          {DASHBOARD_KPI_DEFINITIONS.map((definition) => (
            <div key={definition.key} className="ul-surface p-5">
              <div className="text-xs uppercase text-muted-foreground">
                {definition.label}
              </div>
              <div
                className={`mt-3 text-3xl font-semibold ${DASHBOARD_KPI_VALUE_CLASSES[definition.key]}`}
              >
                {dashboardKpis[definition.key]}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details
        className="ul-surface"
        open={mainSectionStates.dataSources}
        onToggle={(e) => toggleMainSection('dataSources', (e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer items-center gap-3 p-6 select-none">
          <svg
            className={`h-4 w-4 text-muted-foreground transition-transform ${mainSectionStates.dataSources ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="text-lg font-semibold">Fonte dati</h2>
          {!mainSectionStates.dataSources && (
            <span className="text-xs text-muted-foreground">
              Attive: {activeSources.map((source) => RELEASE_SOURCE_LABELS[source]).join(', ')}
            </span>
          )}
        </summary>
        <div className="space-y-3 px-6 pb-6">
          <FilterSourceToggle
            selected={currentFilters.sources as ReleaseSource[]}
            onChange={(next) => updateFilters({ sources: next })}
          />
          <div className="text-xs text-muted-foreground">
            Attive: {activeSources.map((source) => RELEASE_SOURCE_LABELS[source]).join(', ')}
          </div>
        </div>
      </details>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
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
              selected={currentFilters.statuses}
              onChange={(next) => updateFilters({ statuses: next })}
              searchable={false}
              activeSources={activeSources}
              sourceTag={sourceTagFor('status', sourcesFromOptions(metadata.statuses))}
              matchAllSources={matchAllSources}
              open={baseSectionStates.status}
              onToggle={(isOpen) => toggleBaseSection('status', isOpen)}
              isActive={isSectionActive('status', currentFilters)}
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
                      selected={currentFilters.products}
                      onChange={(next) => updateProductsForSource('Microsoft', next)}
                      activeSources={['Microsoft']}
                      open={baseSectionStates.microsoftProducts}
                      onToggle={(isOpen) => toggleBaseSection('microsoftProducts', isOpen)}
                      isActive={isSectionActive('products', currentFilters)}
                    />
                  )}
                  {eosProducts.length > 0 && (
                    <FilterListSection
                      title="App (EOS)"
                      options={eosProducts}
                      selected={currentFilters.products}
                      onChange={(next) => updateProductsForSource('EOS', next)}
                      activeSources={['EOS']}
                      open={baseSectionStates.eosProducts}
                      onToggle={(isOpen) => toggleBaseSection('eosProducts', isOpen)}
                      isActive={isSectionActive('products', currentFilters)}
                    />
                  )}
                  {fabricProducts.length > 0 && (
                    <FilterListSection
                      title="Workload (Fabric)"
                      options={fabricProducts}
                      selected={currentFilters.products}
                      onChange={(next) => updateProductsForSource('Fabric', next)}
                      activeSources={['Fabric']}
                      open={baseSectionStates.fabricProducts}
                      onToggle={(isOpen) => toggleBaseSection('fabricProducts', isOpen)}
                      isActive={isSectionActive('products', currentFilters)}
                    />
                  )}
                  {m365RoadmapProducts.length > 0 && (
                    <FilterListSection
                      title="Prodotti (Microsoft 365)"
                      options={m365RoadmapProducts}
                      selected={currentFilters.products}
                      onChange={(next) => updateProductsForSource('MICROSOFT 365', next)}
                      activeSources={['MICROSOFT 365']}
                      open={baseSectionStates.m365Products}
                      onToggle={(isOpen) => toggleBaseSection('m365Products', isOpen)}
                      isActive={isSectionActive('products', currentFilters)}
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
                  sourceTag={sourceTagFor('productOrApp', sourcesFromOptions(metadata.products))}
                  matchAllSources={matchAllSources}
                  open={baseSectionStates.products}
                  onToggle={(isOpen) => toggleBaseSection('products', isOpen)}
                  isActive={isSectionActive('products', currentFilters)}
                />
              )}
            </>
          )}
          {isFilterVisible('bcMinVersion') && hasOptionsForSources(bcVersionOptions) && (
            <FilterListSection
              title="BC Version"
              options={bcVersionOptions}
              selected={currentFilters.bcVersions}
              onChange={(next) => updateFilters({ bcVersions: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('bcMinVersion', ['EOS'])}
              matchAllSources={matchAllSources}
              maxVisible={12}
              open={baseSectionStates.bcVersion}
              onToggle={(isOpen) => toggleBaseSection('bcVersion', isOpen)}
              isActive={isSectionActive('bcVersion', currentFilters)}
            />
          )}
          {isFilterVisible('months') && hasOptionsForSources(metadata.months) && (
            <FilterListSection
              title="Mese"
              options={metadata.months}
              selected={currentFilters.months}
              onChange={(next) => updateFilters({ months: next })}
              searchable={false}
              maxVisible={24}
              activeSources={activeSources}
              sourceTag={sourceTagFor('months', sourcesFromOptions(metadata.months))}
              matchAllSources={matchAllSources}
              open={baseSectionStates.months}
              onToggle={(isOpen) => toggleBaseSection('months', isOpen)}
              isActive={isSectionActive('months', currentFilters)}
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
              selected={currentFilters.categories}
              onChange={(next) => updateFilters({ categories: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('categories', sourcesFromOptions(metadata.categories))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.categories}
              onToggle={(isOpen) => toggleAdvancedSection('categories', isOpen)}
              isActive={isSectionActive('categories', currentFilters)}
            />
          )}
          {isFilterVisible('tags') && hasOptionsForSources(metadata.tags) && (
            <FilterListSection
              title="Tag"
              options={metadata.tags}
              selected={currentFilters.tags}
              onChange={(next) => updateFilters({ tags: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('tags', sourcesFromOptions(metadata.tags))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.tags}
              onToggle={(isOpen) => toggleAdvancedSection('tags', isOpen)}
              isActive={isSectionActive('tags', currentFilters)}
            />
          )}
          {isFilterVisible('wave') && hasOptionsForSources(metadata.waves) && (
            <FilterListSection
              title="Wave"
              options={metadata.waves}
              selected={currentFilters.waves}
              onChange={(next) => updateFilters({ waves: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('wave', sourcesFromOptions(metadata.waves))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.waves}
              onToggle={(isOpen) => toggleAdvancedSection('waves', isOpen)}
              isActive={isSectionActive('waves', currentFilters)}
            />
          )}
          {isFilterVisible('availabilityType') &&
            hasOptionsForSources(metadata.availabilityTypes) && (
              <FilterListSection
                title="Availability type"
                options={metadata.availabilityTypes}
                selected={currentFilters.availabilityTypes}
                onChange={(next) => updateFilters({ availabilityTypes: next })}
                activeSources={activeSources}
                sourceTag={sourceTagFor(
                  'availabilityType',
                  sourcesFromOptions(metadata.availabilityTypes)
                )}
                matchAllSources={matchAllSources}
                open={advancedSectionStates.availabilityType}
                onToggle={(isOpen) => toggleAdvancedSection('availabilityType', isOpen)}
                isActive={isSectionActive('availabilityType', currentFilters)}
              />
            )}
          {isFilterVisible('enabledFor') && hasOptionsForSources(metadata.enabledFor) && (
            <FilterListSection
              title="Enabled for"
              options={metadata.enabledFor}
              selected={currentFilters.enabledFor}
              onChange={(next) => updateFilters({ enabledFor: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('enabledFor', sourcesFromOptions(metadata.enabledFor))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.enabledFor}
              onToggle={(isOpen) => toggleAdvancedSection('enabledFor', isOpen)}
              isActive={isSectionActive('enabledFor', currentFilters)}
            />
          )}
          {isFilterVisible('geography') && hasOptionsForSources(metadata.geography) && (
            <FilterListSection
              title="Geografia"
              options={metadata.geography}
              selected={currentFilters.geography}
              onChange={(next) => updateFilters({ geography: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('geography', sourcesFromOptions(metadata.geography))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.geography}
              onToggle={(isOpen) => toggleAdvancedSection('geography', isOpen)}
              isActive={isSectionActive('geography', currentFilters)}
            />
          )}
          {isFilterVisible('language') && hasOptionsForSources(metadata.language) && (
            <FilterListSection
              title="Lingua"
              options={metadata.language}
              selected={currentFilters.language}
              onChange={(next) => updateFilters({ language: next })}
              activeSources={activeSources}
              sourceTag={sourceTagFor('language', sourcesFromOptions(metadata.language))}
              matchAllSources={matchAllSources}
              open={advancedSectionStates.language}
              onToggle={(isOpen) => toggleAdvancedSection('language', isOpen)}
              isActive={isSectionActive('language', currentFilters)}
            />
          )}

          {(isFilterVisible('periodNewDays') ||
            isFilterVisible('periodChangedDays') ||
            isFilterVisible('releaseInDays') ||
            isFilterVisible('releaseDateRange')) && (
              <details
                className="mt-4"
                open={advancedSectionStates.periods}
                onToggle={(e) => toggleAdvancedSection('periods', (e.target as HTMLDetailsElement).open)}
              >
                <summary className={`cursor-pointer text-xs uppercase text-muted-foreground ${
                  isSectionActive('periods', currentFilters) ? 'marker:text-primary' : ''
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
                        value={currentFilters.periodNewDays}
                        onChange={(event) =>
                          updateFilters({ periodNewDays: Number(event.target.value) })
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
                        value={currentFilters.periodChangedDays}
                        onChange={(event) =>
                          updateFilters({ periodChangedDays: Number(event.target.value) })
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
                        value={currentFilters.releaseInDays}
                        onChange={(event) =>
                          updateFilters({ releaseInDays: Number(event.target.value) })
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
                          value={currentFilters.releaseDateFrom}
                          onChange={(event) =>
                            updateFilters({ releaseDateFrom: event.target.value })
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2 text-muted-foreground">
                        <span className="min-w-[110px]">Data rilascio (a)</span>
                        <input
                          type="date"
                          className="ul-input text-xs"
                          value={currentFilters.releaseDateTo}
                          onChange={(event) =>
                            updateFilters({ releaseDateTo: event.target.value })
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
    </div>
  );
};

export default GlobalFiltersPage;
