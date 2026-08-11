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
import { AuditTrail } from './AuditTrail';
import type { AdvancedFilters } from '../hooks/useAdvancedFilters';

interface ModernListsLayoutProps {
  activities: CssActivity[];
  filteredActivities: CssActivity[];
  activeViewId: string;
  groupBy: GroupByKey;
  onGroupByChange: (groupBy: GroupByKey) => void;
  advancedFilters: AdvancedFilters;
  onAdvancedFiltersChange: (filters: AdvancedFilters) => void;
  customerFilter: string;
  onCustomerFilterChange: (value: string) => void;
  ownerFilter: string;
  onOwnerFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
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
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  // Quick filter badges
  const hasActiveFilters =
    customerFilter || ownerFilter || statusFilter || ratingFilter || query ||
    (advancedFilters.rules && advancedFilters.rules.length > 0);

  return (
    <div className="space-y-3">
      {/* 1. Views Bar - Pill/Tab Style */}
      <div className="border-b border-border/50 bg-background/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Viste:</span>
          <div className="flex-1 overflow-x-auto">
            <ViewsPanel compact={true} />
          </div>
        </div>
      </div>

      {/* 2. Command Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-muted/20 px-4 py-3">
        {/* Main Actions */}
        <button
          type="button"
          className="ul-button ul-button-primary h-8 px-3 text-xs font-medium"
          onClick={onCreateActivity}
        >
          ➕ Nuova attività
        </button>

        <div className="h-6 w-px bg-border/30" />

        {/* Quick Filters as Pills */}
        <div className="flex flex-wrap items-center gap-1">
          {customerFilter && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800"
              onClick={() => onCustomerFilterChange('')}
              title="Clicca per rimuovere"
            >
              👤 {customerFilter} ✕
            </button>
          )}
          {ownerFilter && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-100 hover:bg-purple-200 dark:hover:bg-purple-800"
              onClick={() => onOwnerFilterChange('')}
              title="Clicca per rimuovere"
            >
              👨‍💼 {ownerFilter} ✕
            </button>
          )}
          {statusFilter && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-800"
              onClick={() => onStatusFilterChange('')}
              title="Clicca per rimuovere"
            >
              ⚠️ {statusFilter} ✕
            </button>
          )}
          {ratingFilter && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100 hover:bg-yellow-200 dark:hover:bg-yellow-800"
              onClick={() => onRatingFilterChange('')}
              title="Clicca per rimuovere"
            >
              ⭐ Rating {ratingFilter} ✕
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* Search */}
          <input
            type="text"
            placeholder="🔍 Cerca..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="ul-input h-8 w-40 px-2 text-xs"
          />

          {/* More Options */}
          <button
            type="button"
            className={`ul-button ${showAdvancedOptions ? 'ul-button-primary' : 'ul-button-ghost'} h-8 px-3 text-xs`}
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            title="Filtri avanzati, raggruppamento, esportazione"
          >
            ⚙️ Opzioni
          </button>

          <button
            type="button"
            className={`ul-button ${showAuditTrail ? 'ul-button-primary' : 'ul-button-ghost'} h-8 px-3 text-xs`}
            onClick={() => setShowAuditTrail(!showAuditTrail)}
            title="Visualizza cronologia"
          >
            📋 Cronologia
          </button>
        </div>
      </div>

      {/* 3. Quick Filters - Inline Dropdowns */}
      <div className="flex flex-wrap items-end gap-2 border-b border-border/50 bg-background/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Filtra rapida:</label>

          <select
            value={customerFilter}
            onChange={(e) => onCustomerFilterChange(e.target.value)}
            className="ul-input h-7 w-40 px-2 text-xs"
          >
            <option value="">👤 Tutti i clienti</option>
            {customers.map((customer) => (
              <option key={customer} value={customer}>{customer}</option>
            ))}
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => onOwnerFilterChange(e.target.value)}
            className="ul-input h-7 w-40 px-2 text-xs"
          >
            <option value="">👨‍💼 Tutti owner</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="ul-input h-7 w-40 px-2 text-xs"
          >
            <option value="">⚠️ Tutti status</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <select
            value={ratingFilter}
            onChange={(e) => onRatingFilterChange(e.target.value)}
            className="ul-input h-7 w-32 px-2 text-xs"
          >
            <option value="">⭐ Rating</option>
            {ratingOptions.map((rating) => (
              <option key={rating} value={String(rating)}>
                {renderRatingStars(rating)}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            className="ul-button ul-button-ghost h-7 px-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={() => {
              onCustomerFilterChange('');
              onOwnerFilterChange('');
              onStatusFilterChange('');
              onRatingFilterChange('');
              onQueryChange('');
              onAdvancedFiltersChange({ logic: 'AND', rules: [] });
            }}
          >
            🗑️ Cancella filtri
          </button>
        )}
      </div>

      {/* 4. Advanced Options Panel - Collapsible */}
      {showAdvancedOptions && (
        <div className="space-y-3 border-b border-border/50 bg-muted/20 px-4 py-3">
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

      {/* 5. Audit Trail - Collapsible */}
      {showAuditTrail && (
        <div className="border-b border-border/50 px-4 py-3">
          <AuditTrail />
        </div>
      )}

      {/* 6. Info Bar - Results count and status */}
      <div className="flex items-center justify-between bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <span>
          📊 <strong>{filteredActivities.length}</strong> di <strong>{activities.length}</strong> record visibili
          {hasActiveFilters && <span className="ml-2">• 🔍 Filtri attivi</span>}
        </span>
      </div>

      {/* 7. Main Content - Table will go here */}
      <div className="px-4 py-3">
        {/* Table content passed as children */}
        {children}
      </div>
    </div>
  );
}

/**
 * Compact version of ViewsPanel for the views bar
 */
