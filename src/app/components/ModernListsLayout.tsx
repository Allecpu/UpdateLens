/**
 * Modern Microsoft Lists-style layout
 * Reorganizes the UI to match Microsoft Lists design:
 * - Views as tabs at top
 * - Command bar with essential actions
 * - Inline quick filters
 * - Table as main content
 */

import React, { useState } from 'react';
import type { CssActivity } from '../../models/Css';
import { ViewsPanel } from './ViewsPanel';
import { GroupingPanel, type GroupByKey } from './GroupingPanel';
import { AdvancedFiltersPanel } from './AdvancedFiltersPanel';
import { ColumnCustomizerPanel } from './ColumnCustomizerPanel';
import { ExportPanel } from './ExportPanel';
import type { AdvancedFilters } from '../hooks/useAdvancedFilters';

interface MultiSelectFilterProps {
  label: string;
  allLabel: string;
  values: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  menuKey: 'customer' | 'owner' | 'status';
  openMultiFilter: 'customer' | 'owner' | 'status' | null;
  setOpenMultiFilter: React.Dispatch<React.SetStateAction<'customer' | 'owner' | 'status' | null>>;
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

function MultiSelectFilter({
  label,
  allLabel,
  values,
  selected,
  onChange,
  menuKey,
  openMultiFilter,
  setOpenMultiFilter,
  searchable = false,
  searchValue = '',
  onSearchChange
}: MultiSelectFilterProps) {
  const toggleMultiValue = (current: string[], value: string) => {
    if (current.includes(value)) {
      onChange(current.filter((item) => item !== value));
      return;
    }
    onChange([...current, value]);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="h-9 min-w-[160px] rounded-md border border-border bg-background px-3 text-left text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        onClick={() => setOpenMultiFilter((prev) => (prev === menuKey ? null : menuKey))}
      >
        {selected.length === 0 ? allLabel : `${label}: ${selected.length}`}
      </button>
      {openMultiFilter === menuKey && (
        <div className="absolute left-0 z-30 mt-1 w-72 rounded-md border border-border bg-card p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
            {selected.length > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => onChange([])}
              >
                Pulisci
              </button>
            )}
          </div>
          {searchable && (
            <input
              type="text"
              value={searchValue}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder={`Cerca ${label.toLowerCase()}...`}
              className="mb-2 h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          )}
          <div className="max-h-56 overflow-y-auto pr-1">
            {values
              .filter((value) => {
                if (!searchable) return true;
                const q = searchValue.trim().toLowerCase();
                if (!q) return true;
                return value.toLowerCase().includes(q);
              })
              .map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/60">
                  <input
                    type="checkbox"
                    checked={selected.includes(value)}
                    onChange={() => toggleMultiValue(selected, value)}
                  />
                  <span className="truncate">{value}</span>
                </label>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ModernListsLayoutProps {
  activities: CssActivity[];
  filteredActivities: CssActivity[];
  activeViewId: string;
  groupBy: GroupByKey;
  onGroupByChange: (groupBy: GroupByKey) => void;
  advancedFilters: AdvancedFilters;
  onAdvancedFiltersChange: (filters: AdvancedFilters) => void;
  customerFilter: string[];
  onCustomerFilterChange: (value: string[]) => void;
  ownerFilter: string[];
  onOwnerFilterChange: (value: string[]) => void;
  statusFilter: string[];
  onStatusFilterChange: (value: string[]) => void;
  ratingFilter: string;
  onRatingFilterChange: (value: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onCreateActivity: () => void;
  customers: string[];
  owners: string[];
  statuses: string[];
  ratingOptions: number[];
  renderRatingStars: (rating: number) => React.ReactNode;
  children?: React.ReactNode;
}

export function ModernListsLayout({
  activities,
  filteredActivities,
  activeViewId,
  groupBy,
  onGroupByChange,
  advancedFilters,
  onAdvancedFiltersChange,
  customerFilter,
  onCustomerFilterChange,
  ownerFilter,
  onOwnerFilterChange,
  statusFilter,
  onStatusFilterChange,
  ratingFilter,
  onRatingFilterChange,
  query,
  onQueryChange,
  onCreateActivity,
  customers,
  owners,
  statuses,
  ratingOptions,
  renderRatingStars,
  children
}: ModernListsLayoutProps) {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [openMultiFilter, setOpenMultiFilter] = useState<'customer' | 'owner' | 'status' | null>(null);
  const [customerFilterQuery, setCustomerFilterQuery] = useState('');

  // Quick filter badges
  const hasActiveFilters =
    customerFilter.length > 0 || ownerFilter.length > 0 || statusFilter.length > 0 || ratingFilter || query ||
    (advancedFilters.rules && advancedFilters.rules.length > 0);

  return (
    <div className="space-y-0">
      <div className="border-b border-border/80 bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Viste:</span>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <ViewsPanel compact={true} />
          </div>
        </div>
      </div>

      <div className="border-b border-border/80 bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              onClick={onCreateActivity}
            >
              Nuova attivita
            </button>
            {statusFilter.length > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800"
                onClick={() => onStatusFilterChange([])}
                title="Rimuovi filtro stato"
              >
                Status: {statusFilter.length}
                <span aria-hidden="true" className="text-amber-700">x</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Cerca attivita..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="h-10 w-64 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              className={`inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium transition-colors ${
                showAdvancedOptions
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              title="Filtri avanzati, raggruppamento, esportazione"
            >
              Opzioni
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-border/80 bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <MultiSelectFilter
            label="Clienti"
            allLabel="Tutti clienti"
            values={customers}
            selected={customerFilter}
            onChange={onCustomerFilterChange}
            menuKey="customer"
            openMultiFilter={openMultiFilter}
            setOpenMultiFilter={setOpenMultiFilter}
            searchable
            searchValue={customerFilterQuery}
            onSearchChange={setCustomerFilterQuery}
          />

          <MultiSelectFilter
            label="Owner"
            allLabel="Tutti owner"
            values={owners}
            selected={ownerFilter}
            onChange={onOwnerFilterChange}
            menuKey="owner"
            openMultiFilter={openMultiFilter}
            setOpenMultiFilter={setOpenMultiFilter}
          />

          <MultiSelectFilter
            label="Status"
            allLabel="Tutti status"
            values={statuses}
            selected={statusFilter}
            onChange={onStatusFilterChange}
            menuKey="status"
            openMultiFilter={openMultiFilter}
            setOpenMultiFilter={setOpenMultiFilter}
          />

          <select
            value={ratingFilter}
            onChange={(e) => onRatingFilterChange(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">Rating</option>
            {ratingOptions.map((rating) => (
              <option key={rating} value={String(rating)}>
                {renderRatingStars(rating)}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md bg-muted px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              onClick={() => {
                onCustomerFilterChange([]);
                onOwnerFilterChange([]);
                onStatusFilterChange([]);
                onRatingFilterChange('');
                onQueryChange('');
                onAdvancedFiltersChange({ logic: 'AND', rules: [] });
              }}
            >
              Cancella filtri
            </button>
          )}
        </div>
      </div>

      {showAdvancedOptions && (
        <div className="space-y-3 border-b border-border bg-muted/10 px-4 py-3">
          <div className="grid gap-3 md:grid-cols-2">
            <AdvancedFiltersPanel
              activities={activities}
              filters={advancedFilters}
              onFiltersChange={onAdvancedFiltersChange}
              matchCount={filteredActivities.length}
            />
            <GroupingPanel
              activities={activities}
              groupBy={groupBy}
              onGroupByChange={onGroupByChange}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <ColumnCustomizerPanel viewId={activeViewId} />
            <ExportPanel activities={filteredActivities} filters={advancedFilters} />
          </div>
        </div>
      )}

      <div className="border-b border-border bg-muted/5 px-4 py-2 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-foreground">{filteredActivities.length}</strong> di{' '}
            <strong className="text-foreground">{activities.length}</strong> record visibili
            {hasActiveFilters && <span className="ml-2 text-blue-600">Filtri attivi</span>}
          </span>
        </div>
      </div>

      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

/**
 * Compact version of ViewsPanel for the views bar
 */
