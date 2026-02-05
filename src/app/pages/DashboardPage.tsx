import { useEffect, useMemo, useState, useDeferredValue } from 'react';
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
import { useBookmarkStore } from '../store/useBookmarkStore';
import { getRelativeDateLabel } from '../../utils/date';

type Chip = {
  label: string;
  onRemove: () => void;
};

type DrillSource = ReleaseSource | null;

const isEntryActive = (entry: { isActive?: boolean }): boolean => entry.isActive !== false;

const ReleaseCard = ({ item }: { item: ReleaseItem }) => {
  const { bookmarkedIds, toggleBookmark } = useBookmarkStore();
  const [copied, setCopied] = useState(false);
  const isBookmarked = bookmarkedIds.includes(item.id);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const link = item.sourceUrl || item.url;
    if (link) {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleBookmark(item.id);
  };

  const productColor = getProductColor(item.productName);

  // Chip helper restricted to this component's needs
  const renderChip = (label: string, value: string | null | undefined, key: string) => {
    if (!value) return null;
    return (
      <span className="ul-chip" key={key}>
        {label}: {value}
      </span>
    );
  };

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
    renderChip('Wave', item.wave, `wave-${item.wave ?? 'none'}`),
    ...availabilityTypeValues.map((value, index) =>
      renderChip('Availability', value, `availability-${value}-${index}`)
    ),
    ...releaseTypeValues.map((value, index) =>
      renderChip('Release', value, `release-${value}-${index}`)
    ),
    item.minBcVersion ? renderChip('BC', item.minBcVersion.toString(), `bc-${item.minBcVersion}`) : null
  ].filter(Boolean);

  const sourceLink = item.sourceUrl ?? item.url;
  const docsLink = item.docsUrl ?? null;
  const relativeDate = getRelativeDateLabel(item.releaseDate);
  const isUpdated = item.lastUpdatedDate && item.lastUpdatedDate > item.releaseDate;

  return (
    <article className="ul-surface relative overflow-visible p-5 pl-6 group transition-all hover:shadow-md border border-transparent hover:border-primary/10">
      <span
        className={`absolute left-0 top-0 h-full w-1.5 ${productColor.barClass}`}
        aria-hidden="true"
      />

      {/* Header: Category & Actions */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1">
          {item.category && (
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {item.category}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${productColor.badgeClass}`}
            >
              {item.productName}
            </span>
            {isUpdated && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Aggiornato
              </span>
            )}
          </div>
        </div>

        {/* Actions: Pin & Copy */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors relative"
            title="Copia link"
          >
            {copied ? (
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
            {copied && <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black text-white px-1 py-0.5 rounded shadow-lg whitespace-nowrap">Copiato!</span>}
          </button>
          <button
            onClick={handleBookmark}
            className={`p-1.5 rounded-full hover:bg-muted transition-colors ${isBookmarked ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-foreground'}`}
            title={isBookmarked ? "Rimuovi segnalibro" : "Aggiungi segnalibro"}
          >
            <svg className="h-4 w-4" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold leading-tight">{item.title}</h2>
        {/* Status Badge */}
        {item.status === 'Try now' ? (
          <span className="shrink-0 inline-flex items-center rounded-md bg-gradient-to-r from-green-500 to-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm ring-1 ring-white/20">
            Try now
          </span>
        ) : (
          <span className="ul-chip shrink-0">{item.status}</span>
        )}
      </div>

      {infoChips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {infoChips}
        </div>
      )}

      <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3 hover:line-clamp-none transition-all duration-300">
        {item.description}
      </p>

      {/* Meta Bar: Date & Enabled For */}
      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Rilascio:</span>
            <span>{item.releaseDate}</span>
            {relativeDate && (
              <span className="text-[10px] text-muted-foreground/70">({relativeDate})</span>
            )}
          </div>
          {item.enabledFor && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground" title={item.enabledFor}>
              <svg className="h-3 w-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span className="truncate max-w-[200px]">{item.enabledFor}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          {sourceLink && isValidHttpUrl(sourceLink) ? (
            <a
              className="group/link flex items-center gap-1 text-primary hover:underline hover:text-primary/80"
              href={sourceLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Vai alla fonte di ${item.title}`}
            >
              Vai alla fonte
              <svg className="h-3 w-3 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          ) : (
            <span className="text-muted-foreground/60 italic">Fonte n/d</span>
          )}

          {docsLink && isValidHttpUrl(docsLink) && docsLink !== sourceLink && (
            <a
              className="group/doc flex items-center gap-1 text-primary hover:underline hover:text-primary/80"
              href={docsLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Apri documentazione per ${item.title}`}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Docs
            </a>
          )}

          {item.learnUrl && isValidHttpUrl(item.learnUrl) && (
            <a
              className="group/doc flex items-center gap-1 text-primary hover:underline hover:text-primary/80"
              href={item.learnUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Apri documentazione per ${item.title}`}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Learn
            </a>
          )}
        </div>
      </div>
    </article>
  );
};

const DashboardPage = () => {
  const [snapshotItems, setSnapshotItems] = useState<ReleaseItem[]>([]);
  const [snapshotErrors, setSnapshotErrors] = useState<string[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const rulesConfig = loadRulesConfig();
  const { index, activeCustomerId, customers } = useCustomerStore();
  const { groups } = useCustomerGroupStore();
  const { bookmarkedIds, showBookmarksOnly, setShowBookmarksOnly } = useBookmarkStore();
  const {
    cssFilters,
    customerFilters,
    customerFilterMode,
    ensureCssFilters,
    chatFilters,
    clearChatFilters,
    setDashboardRuntimeFilters,
    setDashboardScopeItemIds
  } = useFilterStore();

  // Preset management (session-only in Dashboard)
  const { presets, getPreset, applyPresetToFilters, activePresetId, getDefaultPreset } = usePresetStore();
  const [sessionPresetId, setSessionPresetId] = useState<string | null>(null);

  const [tempFilters, setTempFilters] = useState<Partial<FilterState>>({});
  const activeCustomer = activeCustomerId ? customers[activeCustomerId] : null;
  // Sync session preset with active preset from store on mount
  useEffect(() => {
    // Only when no customer is selected (global scope)
    if (activeCustomerId) {
      return;
    }

    // If there's an active preset in the store (from GlobalFiltersPage), use it
    if (activePresetId) {
      setSessionPresetId(activePresetId);
      return;
    }

    // Otherwise, use the Default preset if available
    const defaultPreset = getDefaultPreset();
    if (defaultPreset) {
      setSessionPresetId(defaultPreset.id);
    }
  }, []); // Run once on mount

  // =====================================================================
  // DRILL-DOWN STATE (UI only, no persistence)
  // =====================================================================
  const [drillSource, setDrillSource] = useState<DrillSource>(null);
  const [drillProduct, setDrillProduct] = useState<string | null>(null);

  // Pagination state
  const [visibleCount, setVisibleCount] = useState(50);
  const ITEMS_PER_PAGE = 50;

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

  // Debug log for filter hydration sequence (can be removed after verification)
  useEffect(() => {
    if (filtersReady) {
      console.log('[FILTERS_HYDRATED] Filters ready before KPI render - no flash expected');
    }
  }, [filtersReady]);

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
    setVisibleCount(ITEMS_PER_PAGE); // Reset pagination

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

  useEffect(() => {
    setDashboardRuntimeFilters(dashboardFilters);
  }, [dashboardFilters, setDashboardRuntimeFilters]);

  useEffect(() => {
    return () => {
      setDashboardRuntimeFilters(null);
      setDashboardScopeItemIds(null);
    };
  }, [setDashboardRuntimeFilters, setDashboardScopeItemIds]);

  // Deferred filters for expensive computations (filterReleaseItems)
  // This allows UI to remain responsive while filtering is processed
  const deferredDashboardFilters = useDeferredValue(dashboardFilters);

  // Reset pagination when filters or drill state changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [deferredDashboardFilters, drillSource, drillProduct]);

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
    setSessionPresetId(presetId);
    applyPresetToFilters(presetId);
    setTempFilters({}); // Clear temp filters to show pure preset effect
  };

  const filterScope = activeCustomerId ? 'customer' : 'global';
  const hasOwnerSelection = (dashboardFilters?.targetCssOwners.length ?? 0) > 0;
  const hasGroupSelection = (dashboardFilters?.targetGroupIds.length ?? 0) > 0;
  const isGroupDisabled = hasOwnerSelection || filterScope === 'customer';
  const isOwnerDisabled = hasGroupSelection || filterScope === 'customer';
  const bookmarkedSet = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds]);
  const hasBookmarks = bookmarkedIds.length > 0;

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
  // Filter items using deferredDashboardFilters (with targeting fields stripped)
  // Using deferred value allows UI to remain responsive during filtering
  // IMPORTANT: Return empty array when filters aren't ready to prevent
  // flash of unfiltered content (FOUC)
  // =====================================================================
  const filteredItems = useMemo(() => {
    // Prevent flash: don't show any items until filters are fully hydrated
    if (!deferredDashboardFilters) {
      return [];
    }
    const baseItems = filterReleaseItems(items, {
      targetCustomerIds: deferredDashboardFilters.targetCustomerIds,
      targetGroupIds: deferredDashboardFilters.targetGroupIds,
      targetCssOwners: deferredDashboardFilters.targetCssOwners,
      products: deferredDashboardFilters.products,
      sources: deferredDashboardFilters.sources as ReleaseSource[],
      statuses: deferredDashboardFilters.statuses as ReleaseStatus[],
      categories: deferredDashboardFilters.categories,
      tags: deferredDashboardFilters.tags,
      waves: deferredDashboardFilters.waves,
      bcVersions: deferredDashboardFilters.bcVersions,
      months: deferredDashboardFilters.months,
      availabilityTypes: deferredDashboardFilters.availabilityTypes,
      enabledFor: deferredDashboardFilters.enabledFor,
      geography: deferredDashboardFilters.geography,
      language: deferredDashboardFilters.language,
      periodNewDays: deferredDashboardFilters.periodNewDays,
      periodChangedDays: deferredDashboardFilters.periodChangedDays,
      releaseInDays: deferredDashboardFilters.releaseInDays,
      minBcVersionMin: deferredDashboardFilters.minBcVersionMin,
      releaseDateFrom: deferredDashboardFilters.releaseDateFrom,
      releaseDateTo: deferredDashboardFilters.releaseDateTo,
      sortOrder: deferredDashboardFilters.sortOrder,
      query: deferredDashboardFilters.query,
      horizonMonths: deferredDashboardFilters.horizonMonths,
      historyMonths: deferredDashboardFilters.historyMonths
    });

    if (!showBookmarksOnly) {
      return baseItems;
    }
    return baseItems.filter((item) => bookmarkedSet.has(item.id));
  }, [deferredDashboardFilters, items, showBookmarksOnly, bookmarkedSet]);
  const dashboardKpis = useMemo(
    () => computeDashboardKpis(filteredItems),
    [filteredItems]
  );

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

  useEffect(() => {
    setDashboardScopeItemIds(drilledItems.map((item) => item.id));
  }, [drilledItems, setDashboardScopeItemIds]);

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

  // Pagination: only render visibleCount items to prevent DOM overload
  const visibleItems = useMemo(
    () => sortedDrilledItems.slice(0, visibleCount),
    [sortedDrilledItems, visibleCount]
  );
  const hasMoreItems = sortedDrilledItems.length > visibleCount;
  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

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
                className={`inline-block h-2 w-2 rounded-full ${activeMode === 'inherit' ? 'bg-blue-500' : 'bg-amber-500'
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
            <button
              className={`ul-button ${showBookmarksOnly ? 'ul-button-primary' : 'ul-button-secondary'}`}
              onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
              disabled={!hasBookmarks && !showBookmarksOnly}
              title={hasBookmarks ? 'Filtra solo i segnalibri' : 'Nessun segnalibro salvato'}
            >
              {showBookmarksOnly ? 'Segnalibri attivi' : 'Solo segnalibri'}
              <span className="ml-2 inline-flex items-center rounded-full bg-black/5 px-2 py-0.5 text-xs text-muted-foreground">
                {bookmarkedIds.length}
              </span>
            </button>
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
        {/* Show skeleton while filters are hydrating to prevent flash of unfiltered data */}
        {!filtersReady ? (
          <section className="mt-6 grid gap-4 md:grid-cols-4">
            {['Totale', 'Microsoft', 'EOS', 'Fabric', 'Microsoft 365'].map((label) => (
              <div key={label} className="ul-surface p-5 animate-pulse">
                <div className="text-xs uppercase text-muted-foreground">{label}</div>
                <div className="mt-3 h-9 w-16 rounded bg-muted" />
              </div>
            ))}
          </section>
        ) : (
          <section className="mt-6 grid gap-4 md:grid-cols-4">
            <button
              className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-primary/50 ${!isDrillActive ? 'ring-2 ring-primary' : ''
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
              className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-blue-500/50 ${drillSource === 'Microsoft' ? 'ring-2 ring-blue-500' : ''
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
              className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-amber-500/50 ${drillSource === 'EOS' ? 'ring-2 ring-amber-500' : ''
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
              className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-teal-500/50 ${drillSource === 'Fabric' ? 'ring-2 ring-teal-500' : ''
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
              className={`ul-surface p-5 text-left transition-all hover:ring-2 hover:ring-purple-500/50 ${drillSource === 'MICROSOFT 365' ? 'ring-2 ring-purple-500' : ''
                }`}
              onClick={() => handleDrillSource('MICROSOFT 365')}
            >
              <div className="text-xs uppercase text-muted-foreground">
                Microsoft 365
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
        )}

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
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all hover:bg-secondary/50 ${drillProduct === product.name
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
        {/* Show skeleton cards while filters are hydrating */}
        <section className="mt-6 grid gap-4">
          {!filtersReady ? (
            // Skeleton loading state while filters hydrate
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="ul-surface p-5 animate-pulse">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="h-4 w-20 rounded bg-muted" />
                    <div className="h-6 w-16 rounded bg-muted" />
                  </div>
                  <div className="h-6 w-3/4 rounded bg-muted mt-2" />
                  <div className="h-4 w-full rounded bg-muted mt-3" />
                  <div className="h-4 w-2/3 rounded bg-muted mt-2" />
                </div>
              ))}
            </>
          ) : sortedDrilledItems.length === 0 ? (
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
            <>
              {visibleItems.map((item: ReleaseItem) => (
                <ReleaseCard key={item.id} item={item} />
              ))}
              {hasMoreItems && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="text-xs text-muted-foreground">
                    Visualizzati {visibleItems.length} di {sortedDrilledItems.length} aggiornamenti
                  </div>
                  <button
                    className="ul-button ul-button-secondary"
                    onClick={handleLoadMore}
                  >
                    Carica altri {Math.min(ITEMS_PER_PAGE, sortedDrilledItems.length - visibleCount)}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;
