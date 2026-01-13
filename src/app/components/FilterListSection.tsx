import { useMemo, useState } from 'react';
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
  disabled = false
}: Props) => {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const effectiveSources =
    activeSources && activeSources.length > 0 ? activeSources : ALL_RELEASE_SOURCES;

  const filtered = useMemo(() => {
    let list = options;
    if (query.trim()) {
      const normalized = query.trim().toLowerCase();
      list = list.filter((option) => {
        const label = option.label ?? option.value;
        return (
          label.toLowerCase().includes(normalized) ||
          option.value.toLowerCase().includes(normalized)
        );
      });
    }
    return list;
  }, [options, query]);

  const sourceFiltered = filtered.filter((option) => {
    const optionSources = option.sources?.length ? option.sources : ALL_RELEASE_SOURCES;
    return matchAllSources
      ? effectiveSources.every((source) => optionSources.includes(source))
      : optionSources.some((source) => effectiveSources.includes(source));
  });
  const visible = showAll ? sourceFiltered : sourceFiltered.slice(0, maxVisible);
  const availableValues = sourceFiltered.map((option) => option.value);

  const actionClassName = disabled
    ? 'cursor-not-allowed opacity-60'
    : 'underline';

  return (
    <details
      className={`mt-4 ${disabled ? 'opacity-60' : ''}`}
      open={defaultOpen}
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
        <div className="mt-2 max-h-48 space-y-2 overflow-auto text-xs">
          {visible.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <input
                type="checkbox"
                className="ul-checkbox"
                checked={selected.includes(option.value)}
                onChange={() =>
                  onChange(
                    selected.includes(option.value)
                      ? selected.filter((item) => item !== option.value)
                      : [...selected, option.value]
                  )
                }
                disabled={disabled}
              />
              {option.label ?? option.value} ({option.count})
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
