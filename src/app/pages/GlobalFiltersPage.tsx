import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';

import { loadAllSnapshots, loadRulesConfig } from '../../services/DataLoader';
import {
  usePersistedSectionStates,
  STORAGE_KEYS
} from '../../hooks/usePersistedSectionStates';
import { buildBcVersionOptions, buildFilterMetadata } from '../../services/FilterMetadata';
import { filterReleaseItems } from '../../services/FilterService';
import {
  ALL_RELEASE_SOURCES,
  resolveActiveSources
} from '../../services/FilterDefinitions';
import { computeDashboardKpis } from '../../services/KpiService';
import { useFilterStore, type FilterState } from '../store/useFilterStore';
import { useCustomerStore } from '../store/useCustomerStore';
import { useCustomerGroupStore } from '../store/useCustomerGroupStore';
import { usePresetStore } from '../store/usePresetStore';
import { useBootstrapPresets } from '../../hooks/useBootstrapPresets';
import { useNormalizedFilters } from '../../hooks/useNormalizedFilters';
import PresetSelector from '../components/filters/PresetSelector';
import FilterScopeHeader from '../components/filters/FilterScopeHeader';
import OwnerCssSection from '../components/filters/OwnerCssSection';
import TargetCustomersSection from '../components/filters/TargetCustomersSection';
import KpiDashboardSection from '../components/filters/KpiDashboardSection';
import DataSourceSection from '../components/filters/DataSourceSection';
import FilterSectionsGrid from '../components/filters/FilterSectionsGrid';
import type { ReleaseItem, ReleaseSource } from '../../models/ReleaseItem';

const isEntryActive = (entry: { isActive?: boolean }): boolean => entry.isActive !== false;

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
    clearDashboardOverride,
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
    const sourcePriority: ReleaseSource[] = ['Microsoft', 'EOS', 'Fabric', 'MICROSOFT 365'];
    const map = new Map<string, ReleaseSource>();
    metadata.products.forEach((option) => {
      const primarySource =
        sourcePriority.find((source) => option.sources.includes(source)) ?? option.sources[0];
      if (primarySource) {
        map.set(option.value, primarySource);
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

  const {
    normalizedGlobal,
    currentFilters,
    defaultFilters,
    normalizeRaw: normalizeFiltersInternal
  } = useNormalizedFilters(
    {
      items,
      metadata,
      sourceOptions,
      statusOptions,
      productOptions,
      rulesDefaults: rulesConfig.defaults
    },
    filterScope,
    activeCustomerId
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

  const deferredNormalizedGlobal = useDeferredValue(normalizedGlobal);

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
    // Discard any ad-hoc Dashboard override for the global scope so the Dashboard
    // returns to the freshly reset defaults instead of showing stale tweaks.
    clearDashboardOverride('global');
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

    // Also discard the ad-hoc Dashboard override for this customer's scope.
    clearDashboardOverride(`customer:${activeCustomerId}`);

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
    // Switching preset redefines the global baseline: drop the global Dashboard
    // override so the new preset is shown cleanly on the Dashboard.
    clearDashboardOverride('global');

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
  const sourceScopedItems = useMemo(
    () => items.filter((item) => activeSources.includes(item.source)),
    [items, activeSources]
  );
  const facetedBaseFilters = useMemo(
    () => ({ ...currentFilters, sources: activeSources }),
    [currentFilters, activeSources]
  );
  const statusFacetItems = useMemo(
    () => filterReleaseItems(sourceScopedItems, { ...facetedBaseFilters, statuses: [] }),
    [sourceScopedItems, facetedBaseFilters]
  );
  const productFacetItems = useMemo(
    () => filterReleaseItems(sourceScopedItems, { ...facetedBaseFilters, products: [] }),
    [sourceScopedItems, facetedBaseFilters]
  );
  const categoriesFacetItems = useMemo(
    () => filterReleaseItems(sourceScopedItems, { ...facetedBaseFilters, categories: [] }),
    [sourceScopedItems, facetedBaseFilters]
  );
  const tagsFacetItems = useMemo(
    () => filterReleaseItems(sourceScopedItems, { ...facetedBaseFilters, tags: [] }),
    [sourceScopedItems, facetedBaseFilters]
  );
  const wavesFacetItems = useMemo(
    () => filterReleaseItems(sourceScopedItems, { ...facetedBaseFilters, waves: [] }),
    [sourceScopedItems, facetedBaseFilters]
  );
  const monthsFacetItems = useMemo(
    () => filterReleaseItems(sourceScopedItems, { ...facetedBaseFilters, months: [] }),
    [sourceScopedItems, facetedBaseFilters]
  );
  const availabilityTypesFacetItems = useMemo(
    () => filterReleaseItems(sourceScopedItems, { ...facetedBaseFilters, availabilityTypes: [] }),
    [sourceScopedItems, facetedBaseFilters]
  );
  const enabledForFacetItems = useMemo(
    () => filterReleaseItems(sourceScopedItems, { ...facetedBaseFilters, enabledFor: [] }),
    [sourceScopedItems, facetedBaseFilters]
  );
  const geographyFacetItems = useMemo(
    () => filterReleaseItems(sourceScopedItems, { ...facetedBaseFilters, geography: [] }),
    [sourceScopedItems, facetedBaseFilters]
  );
  const languageFacetItems = useMemo(
    () => filterReleaseItems(sourceScopedItems, { ...facetedBaseFilters, language: [] }),
    [sourceScopedItems, facetedBaseFilters]
  );
  const bcVersionFacetItems = useMemo(
    () =>
      filterReleaseItems(sourceScopedItems, {
        ...facetedBaseFilters,
        bcVersions: [],
        minBcVersionMin: null
      }),
    [sourceScopedItems, facetedBaseFilters]
  );
  const sourceScopedMetadata = useMemo(
    () => buildFilterMetadata(sourceScopedItems),
    [sourceScopedItems]
  );
  const statusFacetMetadata = useMemo(
    () => buildFilterMetadata(statusFacetItems),
    [statusFacetItems]
  );
  const productFacetMetadata = useMemo(
    () => buildFilterMetadata(productFacetItems),
    [productFacetItems]
  );
  const categoriesFacetMetadata = useMemo(
    () => buildFilterMetadata(categoriesFacetItems),
    [categoriesFacetItems]
  );
  const tagsFacetMetadata = useMemo(
    () => buildFilterMetadata(tagsFacetItems),
    [tagsFacetItems]
  );
  const wavesFacetMetadata = useMemo(
    () => buildFilterMetadata(wavesFacetItems),
    [wavesFacetItems]
  );
  const monthsFacetMetadata = useMemo(
    () => buildFilterMetadata(monthsFacetItems),
    [monthsFacetItems]
  );
  const availabilityTypesFacetMetadata = useMemo(
    () => buildFilterMetadata(availabilityTypesFacetItems),
    [availabilityTypesFacetItems]
  );
  const enabledForFacetMetadata = useMemo(
    () => buildFilterMetadata(enabledForFacetItems),
    [enabledForFacetItems]
  );
  const geographyFacetMetadata = useMemo(
    () => buildFilterMetadata(geographyFacetItems),
    [geographyFacetItems]
  );
  const languageFacetMetadata = useMemo(
    () => buildFilterMetadata(languageFacetItems),
    [languageFacetItems]
  );
  const displayMetadata = useMemo(
    () => ({
      ...sourceScopedMetadata,
      products: productFacetMetadata.products,
      statuses: statusFacetMetadata.statuses,
      categories: categoriesFacetMetadata.categories,
      tags: tagsFacetMetadata.tags,
      waves: wavesFacetMetadata.waves,
      months: monthsFacetMetadata.months,
      availabilityTypes: availabilityTypesFacetMetadata.availabilityTypes,
      enabledFor: enabledForFacetMetadata.enabledFor,
      geography: geographyFacetMetadata.geography,
      language: languageFacetMetadata.language
    }),
    [
      sourceScopedMetadata,
      productFacetMetadata.products,
      statusFacetMetadata.statuses,
      categoriesFacetMetadata.categories,
      tagsFacetMetadata.tags,
      wavesFacetMetadata.waves,
      monthsFacetMetadata.months,
      availabilityTypesFacetMetadata.availabilityTypes,
      enabledForFacetMetadata.enabledFor,
      geographyFacetMetadata.geography,
      languageFacetMetadata.language
    ]
  );
  const displayBcVersionOptions = useMemo(
    () => buildBcVersionOptions(bcVersionFacetItems),
    [bcVersionFacetItems]
  );

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
  const globalKpiItems = useMemo(
    () => filterScope === 'global'
      ? kpiItems
      : filterReleaseItems(items, deferredNormalizedGlobal),
    [filterScope, kpiItems, items, deferredNormalizedGlobal]
  );
  const globalProductsCount = globalKpiItems.length;
  // Step A: customerPreviewBase without expensive counts (cheap)
  const customerPreviewBase = useMemo(() => {
    return activeIndex
      .filter((entry) => activeIncludedCustomerIds.has(entry.id))
      .map((entry) => ({
        ...entry,
        groups: groupNamesByCustomerId.get(entry.id) ?? [],
        hasOverride: (customerFilterMode[entry.id] ?? 'inherit') === 'custom' && Boolean(customerFilters[entry.id])
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customerFilters, customerFilterMode, groupNamesByCustomerId, activeIncludedCustomerIds, activeIndex]);

  // Step B: Paginate BEFORE expensive count computation
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(customerPreviewBase.length / pageSize));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const visibleCustomerIds = useMemo(() => {
    const start = clampedPageIndex * pageSize;
    return customerPreviewBase.slice(start, start + pageSize).map((e) => e.id);
  }, [clampedPageIndex, customerPreviewBase]);

  // Step C: overrideCounts only for visible page (max 20 instead of ALL)
  const overrideCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of visibleCustomerIds) {
      const mode = customerFilterMode[id] ?? 'inherit';
      const raw = customerFilters[id];
      if (mode !== 'custom' || !raw) continue;
      const normalized = normalizeFiltersInternal(raw);
      counts.set(id, filterReleaseItems(items, normalized).length);
    }
    return counts;
  }, [visibleCustomerIds, customerFilters, customerFilterMode, items, normalizeFiltersInternal]);

  // Step D: visibleCustomers with counts and local sort
  const visibleCustomers = useMemo(() => {
    const start = clampedPageIndex * pageSize;
    return customerPreviewBase.slice(start, start + pageSize)
      .map((entry) => ({
        ...entry,
        productsCount: entry.hasOverride
          ? overrideCounts.get(entry.id) ?? globalProductsCount
          : globalProductsCount
      }))
      .sort((a, b) => {
        if (b.productsCount !== a.productsCount) return b.productsCount - a.productsCount;
        return a.name.localeCompare(b.name);
      });
  }, [clampedPageIndex, customerPreviewBase, overrideCounts, globalProductsCount]);

  // Step E: Stats without expensive counts
  const customerPreviewStats = useMemo(() => ({
    totalEntries: customerPreviewBase.length,
    overridesCount: customerPreviewBase.filter((e) => e.hasOverride).length,
    globalProductsCount,
    totalProductsCount: customerPreviewBase.length > 0 ? globalProductsCount : 0,
    avgProductsPerCustomer: customerPreviewBase.length > 0 ? globalProductsCount : 0,
    inheritedSample: customerPreviewBase.find((e) => !e.hasOverride) ?? null,
    overrideSample: customerPreviewBase.find((e) => e.hasOverride) ?? null
  }), [customerPreviewBase, globalProductsCount]);
  const avgProductsValue = customerPreviewStats.avgProductsPerCustomer;
  const avgProductsLabel = Number.isInteger(avgProductsValue)
    ? String(avgProductsValue)
    : avgProductsValue.toFixed(1);
  const hasGroupSelection = currentFilters.targetGroupIds.length > 0;
  const hasOwnerSelection = currentFilters.targetCssOwners.length > 0;
  // Symmetrical disabling for Customer Scope or Mutual Exclusion
  const isGroupDisabled = hasOwnerSelection || (filterScope === 'customer');
  const isOwnerDisabled = hasGroupSelection || (filterScope === 'customer');

  // Main section open states (Presets, Owner CSS, Target clienti, Fonte dati, KPIs)
  type MainSectionKey = 'presets' | 'ownerCss' | 'targetCustomers' | 'dataSources' | 'dashboardKpis';

  const defaultMainSectionStates: Record<MainSectionKey, boolean> = {
    presets: true,
    ownerCss: true,
    targetCustomers: true,
    dataSources: true,
    dashboardKpis: true
  };

  const [mainSectionStates, setMainSectionStates] = usePersistedSectionStates<Record<MainSectionKey, boolean>>(
    STORAGE_KEYS.GLOBAL_FILTERS_MAIN,
    defaultMainSectionStates
  );

  const toggleMainSection = useCallback((key: MainSectionKey, isOpen: boolean) => {
    setMainSectionStates((prev) => ({ ...prev, [key]: isOpen }));
  }, []);

  const expandAllSections = useCallback(() => {
    setMainSectionStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as MainSectionKey[]) {
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
  }, []);

  const hasAnyCollapsed = Object.values(mainSectionStates).some((v) => !v);
  const hasAnyExpanded = Object.values(mainSectionStates).some((v) => v);

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

  return (
    <div className="space-y-6">
      <FilterScopeHeader
        filterScope={filterScope}
        setFilterScope={setFilterScope}
        activeCustomerId={activeCustomerId}
        customerName={activeCustomerId ? customers[activeCustomerId]?.name : undefined}
        customerFilterMode={customerFilterMode}
        hasAnyCollapsed={hasAnyCollapsed}
        hasAnyExpanded={hasAnyExpanded}
        expandAllSections={expandAllSections}
        collapseAllSections={collapseAllSections}
        onRevertToInherit={onRevertToInherit}
        onResetGlobal={onResetGlobal}
        onResetCustomerProducts={onResetCustomerProducts}
        onApplyToCustomers={() => {
          applyGlobalToCustomers(Array.from(activeIncludedCustomerIds), normalizedGlobal);
          alert(`Filtri applicati a ${activeIncludedCustomerIds.size} clienti.`);
        }}
        activeIncludedCustomerCount={activeIncludedCustomerIds.size}
        groupBadgeLabel={groupBadgeLabel}
        ownerBadgeLabel={ownerBadgeLabel}
        autoSaveEnabled={autoSaveEnabled}
        isActivePresetDefault={isActivePresetDefault}
        setAutoSaveUserPreference={setAutoSaveUserPreference}
        saveStatus={saveStatus}
        snapshotErrors={snapshotErrors}
      />

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

      <OwnerCssSection
        open={mainSectionStates.ownerCss}
        onToggle={(isOpen) => toggleMainSection('ownerCss', isOpen)}
        currentFilters={currentFilters}
        cssOwnerOptions={cssOwnerOptions}
        onChangeCssOwnerIds={onChangeCssOwnerIds}
        isOwnerDisabled={isOwnerDisabled}
        filterScope={filterScope}
        customerPreviewStats={customerPreviewStats}
        avgProductsLabel={avgProductsLabel}
        visibleCustomers={visibleCustomers}
        overrideCounts={overrideCounts}
        pageSize={pageSize}
        clampedPageIndex={clampedPageIndex}
        totalPages={totalPages}
        setPageIndex={setPageIndex}
      />

      <TargetCustomersSection
        open={mainSectionStates.targetCustomers}
        onToggle={(isOpen) => toggleMainSection('targetCustomers', isOpen)}
        currentFilters={currentFilters}
        groupOptions={groupOptions}
        onChangeGroupIds={onChangeGroupIds}
        isGroupDisabled={isGroupDisabled}
        filterScope={filterScope}
      />

      <KpiDashboardSection
        open={mainSectionStates.dashboardKpis}
        onToggle={(isOpen) => toggleMainSection('dashboardKpis', isOpen)}
        dashboardKpis={dashboardKpis}
      />

      <DataSourceSection
        open={mainSectionStates.dataSources}
        onToggle={(isOpen) => toggleMainSection('dataSources', isOpen)}
        selectedSources={currentFilters.sources as ReleaseSource[]}
        activeSources={activeSources}
        onChange={(next) => updateFilters({ sources: next })}
      />

      <FilterSectionsGrid
        currentFilters={currentFilters}
        updateFilters={updateFilters}
        metadata={displayMetadata}
        activeSources={activeSources}
        bcVersionOptions={displayBcVersionOptions}
        productSourcesByValue={productSourcesByValue}
      />
    </div>
  );
};

export default GlobalFiltersPage;
