import type { ReleaseSource } from '../../models/ReleaseItem';
import {
  ALL_RELEASE_SOURCES,
  RELEASE_SOURCE_LABELS,
  resolveActiveSources
} from '../../services/FilterDefinitions';

type Props = {
  selected: ReleaseSource[];
  onChange: (next: ReleaseSource[]) => void;
};

const FilterSourceToggle = ({ selected, onChange }: Props) => {
  const effective = resolveActiveSources(selected);

  const toggleSource = (source: ReleaseSource) => {
    const next = effective.includes(source)
      ? effective.filter((item) => item !== source)
      : [...effective, source];
    onChange(next.length === 0 ? ALL_RELEASE_SOURCES : next);
  };

  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">Fonte dati</div>
      <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
        {ALL_RELEASE_SOURCES.map((source) => (
          <label key={source} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="ul-checkbox"
              checked={effective.includes(source)}
              onChange={() => toggleSource(source)}
            />
            {RELEASE_SOURCE_LABELS[source]}
          </label>
        ))}
      </div>
    </div>
  );
};

export default FilterSourceToggle;
