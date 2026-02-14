import type { FilterState } from '../../store/useFilterStore';
import type { FilterOption } from '../../../services/FilterMetadata';
import { ALL_RELEASE_SOURCES } from '../../../services/FilterDefinitions';
import FilterListSection from '../FilterListSection';
import { isSectionActive } from '../../../utils/filterSectionActive';

type CustomerPreview = {
  id: string;
  name: string;
  ownerCss?: string;
  groups: string[];
  hasOverride: boolean;
  productsCount: number;
};

type CustomerPreviewStats = {
  totalEntries: number;
  overridesCount: number;
  globalProductsCount: number;
  inheritedSample: { name: string } | null;
  overrideSample: { id: string; name: string } | null;
};

type Props = {
  open: boolean;
  onToggle: (isOpen: boolean) => void;
  currentFilters: FilterState;
  cssOwnerOptions: FilterOption[];
  onChangeCssOwnerIds: (next: string[]) => void;
  isOwnerDisabled: boolean;
  filterScope: 'global' | 'customer';
  customerPreviewStats: CustomerPreviewStats;
  avgProductsLabel: string;
  visibleCustomers: CustomerPreview[];
  overrideCounts: Map<string, number>;
  pageSize: number;
  clampedPageIndex: number;
  totalPages: number;
  setPageIndex: (fn: (prev: number) => number) => void;
};

const OwnerCssSection = ({
  open,
  onToggle,
  currentFilters,
  cssOwnerOptions,
  onChangeCssOwnerIds,
  isOwnerDisabled,
  filterScope,
  customerPreviewStats,
  avgProductsLabel,
  visibleCustomers,
  overrideCounts,
  pageSize,
  clampedPageIndex,
  totalPages,
  setPageIndex
}: Props) => (
  <details
    className="ul-surface"
    open={open}
    onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}
  >
    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-4 p-6 select-none">
      <div className="flex items-center gap-3">
        <svg
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <div>
          <h2 className="text-lg font-semibold">Owner CSS</h2>
          {!open && (
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
              ? 'Owner CSS non modificabile in modalit\u00e0 Cliente (Overdrive)'
              : 'Owner CSS disabilitato: \u00e8 attivo il filtro Gruppi clienti.'}
          </div>
        )}
        <div className="mt-3 text-xs text-muted-foreground">
          Regola combinazione: Owner CSS usa logica OR. Il filtro Gruppi clienti
          \u00e8 mutuamente esclusivo con Owner CSS.
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="ul-surface px-3 py-2">
            <div className="text-xs uppercase text-muted-foreground">Clienti inclusi</div>
            <div className="mt-1 text-lg font-semibold">
              {customerPreviewStats.totalEntries}
            </div>
            {customerPreviewStats.overridesCount > 0 && (
              <div className="text-[11px] text-muted-foreground">
                {customerPreviewStats.overridesCount} clienti con override
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
              Totale: {customerPreviewStats.totalEntries}
            </div>
          </div>
          {customerPreviewStats.totalEntries > pageSize && (
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
          {customerPreviewStats.totalEntries === 0 && (
            <div className="text-xs text-muted-foreground">
              Nessun cliente incluso con i filtri correnti.
            </div>
          )}
        </div>
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer uppercase">Debug KPI</summary>
          <div className="mt-2 space-y-1">
            <div>GlobalProductSet: {customerPreviewStats.globalProductsCount}</div>
            <div>CustomersIncluded: {customerPreviewStats.totalEntries}</div>
            <div>Customers with override: {customerPreviewStats.overridesCount}</div>
            {customerPreviewStats.inheritedSample && (
              <div>
                Ereditato ({customerPreviewStats.inheritedSample.name}):{' '}
                {customerPreviewStats.globalProductsCount}
              </div>
            )}
            {customerPreviewStats.overrideSample && (
              <div>
                Override ({customerPreviewStats.overrideSample.name}):{' '}
                {overrideCounts.get(customerPreviewStats.overrideSample.id) ?? customerPreviewStats.globalProductsCount}
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  </details>
);

export default OwnerCssSection;
