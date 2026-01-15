import { useEffect, useMemo, useState } from 'react';
import {
  loadRulesConfig,
  loadAllSnapshots
} from '../../services/DataLoader';
import { exportCustomers, importCustomers } from '../../services/CustomerStorage';
import type { Customer } from '../../models/Customer';
import type { CustomerGroup } from '../../models/CustomerGroup';
import type { ReleaseItem, ReleaseSource } from '../../models/ReleaseItem';
import { ALL_RELEASE_SOURCES } from '../../services/FilterDefinitions';
import { useCustomerStore } from '../store/useCustomerStore';
import { useCustomerGroupStore } from '../store/useCustomerGroupStore';
import { useFilterStore, type FilterState } from '../store/useFilterStore';
import { buildFilterMetadata } from '../../services/FilterMetadata';
import FilterListSection from '../components/FilterListSection';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const formatDateLabel = (value?: string | null): string => {
  if (!value) {
    return 'N/A';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }
  return parsed.toLocaleDateString('it-IT');
};

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

const resolveTargetCustomerIds = (
  filters: FilterState,
  groups: { id: string; customerIds: string[] }[],
  index: { id: string; ownerCss?: string }[]
): string[] => {
  const selected = new Set<string>();
  filters.targetCustomerIds.forEach((id) => selected.add(id));
  const groupMap = new Map(groups.map((group) => [group.id, group.customerIds]));
  filters.targetGroupIds.forEach((groupId) => {
    (groupMap.get(groupId) ?? []).forEach((id) => selected.add(id));
  });
  if (filters.targetCssOwners.length > 0) {
    const owners = new Set(filters.targetCssOwners);
    index.forEach((entry) => {
      if (entry.ownerCss && owners.has(entry.ownerCss)) {
        selected.add(entry.id);
      }
    });
  }
  return Array.from(selected);
};

const ClientsPage = () => {
  const rulesConfig = loadRulesConfig();
  const [snapshotItems, setSnapshotItems] = useState<ReleaseItem[]>([]);
  const [snapshotErrors, setSnapshotErrors] = useState<string[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const metadata = useMemo(() => buildFilterMetadata(snapshotItems), [snapshotItems]);
  const {
    index,
    customers,
    activeCustomerId,
    setActiveCustomer,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    forceOwnerCssFromSeed,
    replaceAll
  } = useCustomerStore();
  const { groups, addGroup, updateGroup, deleteGroup } = useCustomerGroupStore();
  const {
    cssFilters,
    customerFilters,
    customerFilterMode,
    ensureCssFilters,
    removeGroupFromFilters,
    applyGlobalToCustomers,
    clearOverridesForCustomers,
    setCustomerFilters,
    setCustomerMode
  } = useFilterStore();

  const [search, setSearch] = useState('');
  const [showActiveOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [applyGlobalFilters, setApplyGlobalFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(activeCustomerId);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [jsonImport, setJsonImport] = useState('');
  const [groupFormId, setGroupFormId] = useState<string | null>(null);
  const [groupFormName, setGroupFormName] = useState('');
  const [groupFormDescription, setGroupFormDescription] = useState('');
  const [groupFormCustomers, setGroupFormCustomers] = useState<string[]>([]);
  const [groupFormError, setGroupFormError] = useState<string | null>(null);
  const [groupDeleteId, setGroupDeleteId] = useState<string | null>(null);
  const selectedCustomer = editingId ? customers[editingId] : null;
  const [formName, setFormName] = useState(selectedCustomer?.name ?? '');
  const [formOwnerCss, setFormOwnerCss] = useState(selectedCustomer?.ownerCss ?? '');
  const [formIsActive, setFormIsActive] = useState(selectedCustomer?.isActive ?? true);

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
  const productSourceMap = useMemo(() => {
    const map = new Map<string, ReleaseSource>();
    snapshotItems.forEach((item) => {
      if (!map.has(item.productName)) {
        map.set(item.productName, item.source);
      }
    });
    return map;
  }, [snapshotItems]);
  const productsBySource = useMemo(() => {
    const map = new Map<ReleaseSource, string[]>();
    snapshotItems.forEach((item) => {
      const list = map.get(item.source) ?? [];
      if (!list.includes(item.productName)) {
        list.push(item.productName);
        map.set(item.source, list);
      }
    });
    return map;
  }, [snapshotItems]);
  const customerOptions = useMemo(
    () =>
      index
        .filter((entry) => isEntryActive(entry))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => ({
          value: entry.id,
          label: entry.name,
          count: 1,
          sources: ALL_RELEASE_SOURCES
        })),
    [index]
  );
  const sortedGroups = useMemo(
    () => groups.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [groups]
  );
  const customerIdSet = useMemo(() => new Set(index.map((entry) => entry.id)), [index]);
  const activeIndex = useMemo(() => index.filter((entry) => isEntryActive(entry)), [index]);
  const hasTargetFilters = useMemo(
    () =>
      (cssFilters?.targetCustomerIds.length ?? 0) > 0 ||
      (cssFilters?.targetGroupIds.length ?? 0) > 0 ||
      (cssFilters?.targetCssOwners.length ?? 0) > 0,
    [
      cssFilters?.targetCustomerIds.length,
      cssFilters?.targetGroupIds.length,
      cssFilters?.targetCssOwners.length
    ]
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

  const normalizeFilters = (raw: FilterState): FilterState => {
    const merged = { ...defaultFilters, ...raw };
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
  };

  const normalizedCssFilters = useMemo(() => {
    return normalizeFilters(cssFilters ?? defaultFilters);
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

  const customerMode =
    editingId ? customerFilterMode[editingId] ?? 'inherit' : 'inherit';
  const normalizedCustomerFilters = useMemo(() => {
    if (!editingId || customerMode === 'inherit') {
      return normalizedCssFilters;
    }
    const custom = customerFilters[editingId];
    if (!custom) {
      return normalizedCssFilters;
    }
    return normalizeFilters(custom);
  }, [
    editingId,
    customerMode,
    customerFilters,
    normalizedCssFilters,
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

  const normalizeGroupName = (name: string): string => name.trim().toLowerCase();

  const resetGroupForm = (group?: CustomerGroup | null) => {
    if (!group) {
      setGroupFormId(null);
      setGroupFormName('');
      setGroupFormDescription('');
      setGroupFormCustomers([]);
      setGroupFormError(null);
      return;
    }
    setGroupFormId(group.id);
    setGroupFormName(group.name);
    setGroupFormDescription(group.description ?? '');
    setGroupFormCustomers(group.customerIds);
    setGroupFormError(null);
  };

  const groupNameExists = (name: string, excludeId?: string | null): boolean => {
    const normalized = normalizeGroupName(name);
    return groups.some(
      (group) =>
        group.id !== excludeId && normalizeGroupName(group.name) === normalized
    );
  };

  const groupUsageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const record = (filters?: FilterState | null) => {
      if (!filters) {
        return;
      }
      (filters.targetGroupIds ?? []).forEach((id) => {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      });
    };
    record(cssFilters);
    Object.values(customerFilters).forEach((filters) => record(filters));
    return counts;
  }, [cssFilters, customerFilters]);

  useEffect(() => {
    if (groupFormId && !groups.some((group) => group.id === groupFormId)) {
      resetGroupForm(null);
    }
  }, [groupFormId, groups]);

  const resetForm = (customer?: Customer | null) => {
    setEditingId(customer?.id ?? null);
    setFormName(customer?.name ?? '');
    setFormOwnerCss(customer?.ownerCss ?? '');
    setFormIsActive(customer?.isActive ?? true);
  };

  useEffect(() => {
    if (activeCustomerId && !editingId) {
      resetForm(customers[activeCustomerId]);
    }
  }, [activeCustomerId, customers, editingId]);
  useEffect(() => {
    if (!selectedCustomer) {
      return;
    }
    if (!formOwnerCss && selectedCustomer.ownerCss) {
      setFormOwnerCss(selectedCustomer.ownerCss);
    }
  }, [formOwnerCss, selectedCustomer]);

  const filteredIndex = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const targetCustomers = applyGlobalFilters
      ? new Set(resolveTargetCustomerIds(normalizedCssFilters, groups, activeIndex))
      : new Set<string>();
    return index.filter((entry) => {
      if (!showInactive && !isEntryActive(entry)) {
        return false;
      }
      if (showActiveOnly && activeCustomerId && entry.id !== activeCustomerId) {
        return false;
      }
      if (targetCustomers.size > 0 && !targetCustomers.has(entry.id)) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return entry.name.toLowerCase().includes(normalized);
    });
  }, [
    index,
    search,
    showInactive,
    showActiveOnly,
    activeCustomerId,
    applyGlobalFilters,
    normalizedCssFilters,
    groups,
    activeIndex
  ]);

  const buildCopyName = (baseName: string): string => {
    const root = `${baseName.trim()} (copia)`;
    if (!groupNameExists(root)) {
      return root;
    }
    let counter = 2;
    let candidate = `${baseName.trim()} (copia ${counter})`;
    while (groupNameExists(candidate)) {
      counter += 1;
      candidate = `${baseName.trim()} (copia ${counter})`;
    }
    return candidate;
  };

  const onSaveGroup = () => {
    const trimmedName = groupFormName.trim();
    if (!trimmedName) {
      setGroupFormError('Il nome del gruppo \u00e8 obbligatorio.');
      return;
    }
    if (groupNameExists(trimmedName, groupFormId)) {
      setGroupFormError('Esiste gi\u00e0 un gruppo con questo nome.');
      return;
    }
    const description = groupFormDescription.trim();
    const customerIds = groupFormCustomers.filter((id) => customerIdSet.has(id));
    if (groupFormId) {
      updateGroup({
        id: groupFormId,
        name: trimmedName,
        description: description ? description : undefined,
        customerIds
      });
    } else {
      const id = addGroup({
        name: trimmedName,
        description: description ? description : undefined,
        customerIds
      });
      setGroupFormId(id);
    }
    setGroupFormName(trimmedName);
    setGroupFormDescription(description);
    setGroupFormCustomers(customerIds);
    setGroupFormError(null);
  };

  const onDuplicateGroup = (group: CustomerGroup) => {
    const nextName = buildCopyName(group.name);
    const id = addGroup({
      name: nextName,
      description: group.description,
      customerIds: group.customerIds
    });
    setGroupFormId(id);
    setGroupFormName(nextName);
    setGroupFormDescription(group.description ?? '');
    setGroupFormCustomers(group.customerIds);
    setGroupFormError(null);
  };

  const onConfirmDeleteGroup = () => {
    if (!groupDeleteId) {
      return;
    }
    deleteGroup(groupDeleteId);
    removeGroupFromFilters(groupDeleteId);
    if (groupFormId === groupDeleteId) {
      resetGroupForm(null);
    }
    setGroupDeleteId(null);
  };

  const onSave = () => {
    const trimmedName = formName.trim();
    if (!trimmedName) {
      return;
    }
    const baseId = slugify(trimmedName);
    const id =
      editingId ??
      (customers[baseId] ? `${baseId}-${Date.now().toString(36)}` : baseId);
    const commsLog = selectedCustomer?.commsLog ?? [];
    const effectiveFilters =
      customerMode === 'inherit' ? normalizedCssFilters : normalizedCustomerFilters;
    const payload: Customer = {
      id,
      name: trimmedName,
      ownerCss: formOwnerCss.trim(),
      isActive: formIsActive,
      selectedProducts: effectiveFilters.products,
      overrides: {
        sources: effectiveFilters.sources,
        statuses: effectiveFilters.statuses,
        horizonMonths: effectiveFilters.horizonMonths,
        historyMonths: effectiveFilters.historyMonths
      },
      commsLog
    };
    if (editingId && customers[editingId]) {
      updateCustomer(payload);
    } else {
      addCustomer(payload);
      setActiveCustomer(payload.id);
    }
    resetForm(payload);
  };

  const onDelete = () => {
    if (!selectedCustomer) {
      return;
    }
    deleteCustomer(selectedCustomer.id);
    setShowDeleteModal(false);
    resetForm(null);
  };

  const onExportJson = () => {
    const content = exportCustomers(index, customers, customerFilters, customerFilterMode);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customers.export.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const onImportJson = () => {
    if (!jsonImport.trim()) {
      return;
    }
    const parsed = importCustomers(jsonImport);
    replaceAll(parsed.index, parsed.customers);

    if (parsed.customerFilters) {
      Object.entries(parsed.customerFilters).forEach(([id, filters]) => {
        setCustomerFilters(id, filters);
      });
    }
    if (parsed.customerFilterMode) {
      Object.entries(parsed.customerFilterMode).forEach(([id, mode]) => {
        setCustomerMode(id, mode);
      });
    }

    setJsonImport('');
  };

  const onBulkApplyGlobal = () => {
    const ids = filteredIndex.map((entry) => entry.id);
    if (ids.length === 0) return;
    applyGlobalToCustomers(ids, normalizedCssFilters);
  };

  const onBulkClearOverrides = () => {
    const ids = filteredIndex.map((entry) => entry.id);
    if (ids.length === 0) return;
    clearOverridesForCustomers(ids);
  };

  const groupToDelete = groupDeleteId
    ? groups.find((group) => group.id === groupDeleteId) ?? null
    : null;
  const groupUsageCount = groupToDelete ? groupUsageCounts.get(groupToDelete.id) ?? 0 : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Clienti</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gestisci anagrafiche, filtri e comunicazioni per cliente.
        </p>
        {snapshotErrors.length > 0 && (
          <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Errore caricamento dati: {snapshotErrors.join(' | ')}
          </div>
        )}
      </header>

      <section className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="ul-surface p-4">
          <div className="text-xs uppercase text-muted-foreground">Cerca</div>
          <input
            className="ul-input mt-2"
            placeholder="Cerca cliente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="ul-checkbox"
              checked={showInactive}
              onChange={() => setShowInactive((prev) => !prev)}
            />
            Mostra inattivi
          </label>
          {hasTargetFilters && (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="ul-checkbox"
                checked={applyGlobalFilters}
                onChange={() => setApplyGlobalFilters((prev) => !prev)}
              />
              Filtri globali attivi: applica alla lista
            </label>
          )}

          <div className="mt-4 flex gap-2">
            <button className="ul-button ul-button-primary" onClick={() => resetForm(null)}>
              Nuovo
            </button>
            <button className="ul-button ul-button-ghost" onClick={onExportJson}>
              Export JSON
            </button>
            <button className="ul-button ul-button-ghost" onClick={forceOwnerCssFromSeed}>
              Forza owner CSS
            </button>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {/* Bulk Actions */}
            <div className="mb-4 flex flex-col gap-2 border-b pb-4">
              <button
                className="ul-button ul-button-secondary text-xs"
                onClick={onBulkApplyGlobal}
                disabled={filteredIndex.length === 0}
              >
                Applica filtri globali ({filteredIndex.length})
              </button>
              <button
                className="ul-button ul-button-ghost text-xs"
                onClick={onBulkClearOverrides}
                disabled={filteredIndex.length === 0}
              >
                Rimuovi override custom ({filteredIndex.length})
              </button>
            </div>

            {filteredIndex.map((entry) => (
              <button
                key={entry.id}
                className={`w-full rounded-xl px-3 py-2 text-left ${entry.id === editingId ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                  }`}
                onClick={() => resetForm(customers[entry.id])}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{entry.name}</span>
                  {!isEntryActive(entry) && (
                    <span className="text-[10px] uppercase text-muted-foreground">
                      Inattivo
                    </span>
                  )}
                </div>
              </button>
            ))}
            {filteredIndex.length === 0 && (
              <div className="text-xs text-muted-foreground">Nessun cliente trovato.</div>
            )}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="ul-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Modifica cliente' : 'Nuovo cliente'}
              </h2>
              {selectedCustomer && (
                <button
                  className="ul-button ul-button-ghost"
                  onClick={() => setShowDeleteModal(true)}
                >
                  Elimina
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase text-muted-foreground">Nome</label>
                <input
                  className="ul-input mt-2"
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                  placeholder="Nome cliente"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground">Owner CSS</label>
                <input
                  className="ul-input mt-2"
                  value={formOwnerCss}
                  onChange={(event) => setFormOwnerCss(event.target.value)}
                  placeholder="Owner CSS"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground">Stato cliente</label>
                <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="ul-checkbox"
                    checked={formIsActive}
                    onChange={(event) => setFormIsActive(event.target.checked)}
                  />
                  Attivo
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button className="ul-button ul-button-primary" onClick={onSave}>
                Salva cliente
              </button>
              <button className="ul-button ul-button-ghost" onClick={() => resetForm(selectedCustomer)}>
                Reset
              </button>
            </div>
          </section>

          <section className="ul-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Gruppi clienti</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crea gruppi riutilizzabili per filtri e comunicazioni.
                </p>
              </div>
              <button className="ul-button ul-button-primary" onClick={() => resetGroupForm(null)}>
                Crea gruppo
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-3">
                {sortedGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`rounded-xl border border-border/60 p-4 ${group.id === groupFormId ? 'bg-accent/40' : ''
                      }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{group.name}</div>
                        {group.description && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {group.description}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {group.customerIds.length} clienti • Ultima modifica:{' '}
                          {formatDateLabel(group.updatedAt)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <button
                          className="ul-button ul-button-ghost"
                          onClick={() => resetGroupForm(group)}
                        >
                          Modifica
                        </button>
                        <button
                          className="ul-button ul-button-ghost"
                          onClick={() => onDuplicateGroup(group)}
                        >
                          Duplica
                        </button>
                        <button
                          className="ul-button ul-button-ghost"
                          onClick={() => setGroupDeleteId(group.id)}
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {sortedGroups.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    Nessun gruppo creato.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">
                    {groupFormId ? 'Modifica gruppo' : 'Nuovo gruppo'}
                  </h3>
                  {groupFormId && (
                    <button
                      className="ul-button ul-button-ghost"
                      onClick={() =>
                        resetGroupForm(
                          groups.find((group) => group.id === groupFormId) ?? null
                        )
                      }
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-xs uppercase text-muted-foreground">
                    Nome gruppo
                  </label>
                  <input
                    className="ul-input mt-2"
                    value={groupFormName}
                    onChange={(event) => setGroupFormName(event.target.value)}
                    placeholder="Nome gruppo"
                  />
                  {groupFormError && (
                    <div className="mt-2 text-xs text-rose-500">{groupFormError}</div>
                  )}
                </div>

                <div>
                  <label className="text-xs uppercase text-muted-foreground">
                    Descrizione
                  </label>
                  <textarea
                    className="ul-input mt-2 min-h-[80px]"
                    value={groupFormDescription}
                    onChange={(event) => setGroupFormDescription(event.target.value)}
                    placeholder="Descrizione opzionale"
                  />
                </div>

                <div>
                  <div className="text-xs uppercase text-muted-foreground">Clienti</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Clienti selezionati: {groupFormCustomers.length}
                  </div>
                  <FilterListSection
                    title="Clienti"
                    options={customerOptions}
                    selected={groupFormCustomers}
                    onChange={setGroupFormCustomers}
                    defaultOpen
                    maxVisible={12}
                    compact={false}
                  />
                </div>

                <div className="flex gap-2">
                  <button className="ul-button ul-button-primary" onClick={onSaveGroup}>
                    Salva gruppo
                  </button>
                  <button className="ul-button ul-button-ghost" onClick={() => resetGroupForm(null)}>
                    Cancella
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="ul-surface p-6">
            <h2 className="text-lg font-semibold">Import / Export JSON</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Incolla un export JSON per sostituire l'archivio clienti.
            </p>
            <textarea
              className="ul-input mt-3 min-h-[120px]"
              value={jsonImport}
              onChange={(event) => setJsonImport(event.target.value)}
              placeholder={'{ "version": 1, "index": [...], "customers": {...} }'}
            />
            <div className="mt-3 flex gap-2">
              <button className="ul-button ul-button-primary" onClick={onImportJson}>
                Importa JSON
              </button>
              <button className="ul-button ul-button-ghost" onClick={onExportJson}>
                Scarica JSON
              </button>
            </div>
          </section>
        </div>
      </section>

      {showDeleteModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="ul-surface w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Conferma eliminazione</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Eliminare definitivamente il cliente "{selectedCustomer.name}"?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="ul-button ul-button-ghost" onClick={() => setShowDeleteModal(false)}>
                Annulla
              </button>
              <button className="ul-button ul-button-primary" onClick={onDelete}>
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="ul-surface w-full max-w-md p-6">
            <h3 className="text-lg font-semibold">Conferma eliminazione</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Eliminare definitivamente il gruppo "{groupToDelete.name}"?
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Questo gruppo e usato in {groupUsageCount} filtri.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="ul-button ul-button-ghost" onClick={() => setGroupDeleteId(null)}>
                Annulla
              </button>
              <button className="ul-button ul-button-primary" onClick={onConfirmDeleteGroup}>
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;

