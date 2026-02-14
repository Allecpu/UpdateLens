import type { FilterState } from '../../store/useFilterStore';
import type { FilterOption } from '../../../services/FilterMetadata';
import { ALL_RELEASE_SOURCES } from '../../../services/FilterDefinitions';
import FilterListSection from '../FilterListSection';
import { isSectionActive } from '../../../utils/filterSectionActive';

type Props = {
  open: boolean;
  onToggle: (isOpen: boolean) => void;
  currentFilters: FilterState;
  groupOptions: FilterOption[];
  onChangeGroupIds: (next: string[]) => void;
  isGroupDisabled: boolean;
  filterScope: 'global' | 'customer';
};

const TargetCustomersSection = ({
  open,
  onToggle,
  currentFilters,
  groupOptions,
  onChangeGroupIds,
  isGroupDisabled,
  filterScope
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
          <h2 className="text-lg font-semibold">Target clienti</h2>
          {!open && (
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
                  ? 'Gruppi clienti non modificabili in modalit\u00e0 Cliente (Overdrive)'
                  : 'Gruppi clienti disabilitati: \u00e8 attivo il filtro Owner CSS.'}
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
);

export default TargetCustomersSection;
