type Props = {
  filterScope: 'global' | 'customer';
  setFilterScope: (scope: 'global' | 'customer') => void;
  activeCustomerId: string | null;
  customerName: string | undefined;
  customerFilterMode: Record<string, string>;
  hasAnyCollapsed: boolean;
  hasAnyExpanded: boolean;
  expandAllSections: () => void;
  collapseAllSections: () => void;
  onRevertToInherit: () => void;
  onResetGlobal: () => void;
  onResetCustomerProducts: () => void;
  onApplyToCustomers: () => void;
  activeIncludedCustomerCount: number;
  groupBadgeLabel: string;
  ownerBadgeLabel: string;
  autoSaveEnabled: boolean;
  isActivePresetDefault: () => boolean;
  setAutoSaveUserPreference: (enabled: boolean) => void;
  saveStatus: 'saved' | 'pending';
  snapshotErrors: string[];
};

const FilterScopeHeader = ({
  filterScope,
  setFilterScope,
  activeCustomerId,
  customerName,
  customerFilterMode,
  hasAnyCollapsed,
  hasAnyExpanded,
  expandAllSections,
  collapseAllSections,
  onRevertToInherit,
  onResetGlobal,
  onResetCustomerProducts,
  onApplyToCustomers,
  activeIncludedCustomerCount,
  groupBadgeLabel,
  ownerBadgeLabel,
  autoSaveEnabled,
  isActivePresetDefault,
  setAutoSaveUserPreference,
  saveStatus,
  snapshotErrors
}: Props) => (
  <>
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
              Cliente: {customerName ?? '...'} (Overdrive)
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
            disabled={activeIncludedCustomerCount === 0}
            onClick={onApplyToCustomers}
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
  </>
);

export default FilterScopeHeader;
