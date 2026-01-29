import { useDeferredValue, useMemo, useState } from 'react';
import type { ReleaseSource } from '../../models/ReleaseItem';
import { ALL_RELEASE_SOURCES } from '../../services/FilterDefinitions';
import type { FilterOption } from '../../services/FilterMetadata';

type Props = {
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  activeSources?: ReleaseSource[];
  sourceTag?: string;
  matchAllSources?: boolean;
  defaultOpen?: boolean;
  maxVisible?: number;
  searchable?: boolean;
  compact?: boolean;
  disabled?: boolean;
  showBulkActions?: boolean;
  scrollable?: boolean;
  /** Controlled open state (overrides defaultOpen when provided) */
  open?: boolean;
  /** Callback when section is toggled (enables controlled mode) */
  onToggle?: (isOpen: boolean) => void;
};

const FilterListSection = ({
  title,
  options,
  selected,
  onChange,
  activeSources,
  sourceTag,
  matchAllSources = false,
  defaultOpen = false,
  maxVisible = 15,
  searchable = true,
  compact = true,
  disabled = false,
  showBulkActions = true,
  scrollable = true,
  open,
  onToggle
}: Props) => {
  // Controlled mode: use open prop; Uncontrolled mode: use defaultOpen
  const isControlled = open !== undefined;
  const effectiveOpen = isControlled ? open : defaultOpen;
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const effectiveSources = useMemo(
    () => (activeSources && activeSources.length > 0 ? activeSources : ALL_RELEASE_SOURCES),
    [activeSources]
  );
  const effectiveSourcesSet = useMemo(() => new Set(effectiveSources), [effectiveSources]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const preparedOptions = useMemo(
    () =>
      options.map((option) => ({
        option,
        searchLabel: `${option.label ?? option.value} ${option.description ?? ''}`.toLowerCase(),
        valueLower: option.value.toLowerCase(),
        sources: option.sources?.length ? option.sources : ALL_RELEASE_SOURCES
      })),
    [options]
  );

  const filtered = useMemo(() => {
    let list = preparedOptions;
    const trimmed = deferredQuery.trim();
    if (trimmed) {
      const normalized = trimmed.toLowerCase();
      list = list.filter(
        ({ searchLabel, valueLower }) =>
          searchLabel.includes(normalized) || valueLower.includes(normalized)
      );
    }
    return list;
  }, [deferredQuery, preparedOptions]);

  const sourceFiltered = useMemo(() => {
    return filtered.filter(({ sources }) => {
      return matchAllSources
        ? effectiveSources.every((source) => sources.includes(source))
        : sources.some((source) => effectiveSourcesSet.has(source));
    });
  }, [effectiveSources, effectiveSourcesSet, filtered, matchAllSources]);
  const visible = useMemo(
    () => (showAll ? sourceFiltered : sourceFiltered.slice(0, maxVisible)),
    [maxVisible, showAll, sourceFiltered]
  );
  const availableValues = useMemo(
    () => sourceFiltered.map(({ option }) => option.value),
    [sourceFiltered]
  );

  const actionClassName = disabled
    ? 'cursor-not-allowed opacity-60'
    : 'underline';

  const handleToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (onToggle) {
      onToggle(event.currentTarget.open);
    }
  };

  return (
    <details
      className={`mt-4 ${disabled ? 'opacity-60' : ''}`}
      open={effectiveOpen}
      onToggle={handleToggle}
      aria-disabled={disabled}
    >
      <summary
        className={`text-xs uppercase text-muted-foreground ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span>{title}</span>
        {sourceTag && (
          <span className="ml-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
            {sourceTag}
          </span>
        )}
      </summary>
      <div className="mt-2">
        {searchable && (
          <input
            className={`ul-input ${compact ? 'text-xs' : ''}`}
            placeholder={`Cerca ${title.toLowerCase()}...`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={disabled}
          />
        )}
        {showBulkActions && (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <button
              className={actionClassName}
              onClick={() => onChange(availableValues)}
              disabled={disabled}
            >
              Seleziona tutti
            </button>
            <button
              className={actionClassName}
              onClick={() => onChange([])}
              disabled={disabled}
            >
              Deseleziona tutti
            </button>
          </div>
        )}
        <div
          className={`mt-2 space-y-2 text-xs ${scrollable ? 'max-h-48 overflow-auto' : ''}`}
        >
          {visible.map(({ option }) => (
            <label
              key={option.value}
              className={`flex gap-2 text-muted-foreground ${
                option.description ? 'items-start' : 'items-center'
              }`}
            >
              <input
                type="checkbox"
                className="ul-checkbox"
                checked={selectedSet.has(option.value)}
                onChange={() =>
                  onChange(
                    selectedSet.has(option.value)
                      ? selected.filter((item) => item !== option.value)
                      : [...selected, option.value]
                  )
                }
                disabled={disabled}
              />
              {option.description ? (
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-foreground">
                      {option.label ?? option.value}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({option.count})
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {option.description}
                  </div>
                </div>
              ) : (
                <span>
                  {option.label ?? option.value} ({option.count})
                </span>
              )}
            </label>
          ))}
          {sourceFiltered.length === 0 && (
            <div className="text-xs text-muted-foreground">Nessun risultato.</div>
          )}
        </div>
        {sourceFiltered.length > maxVisible && (
          <button
            className={`mt-2 text-[11px] text-primary ${
              disabled ? 'cursor-not-allowed opacity-60' : 'underline'
            }`}
            onClick={() => setShowAll((prev) => !prev)}
            disabled={disabled}
          >
            {showAll ? 'Mostra meno' : 'Mostra altro'}
          </button>
        )}
      </div>
    </details>
  );
};

export default FilterListSection;
