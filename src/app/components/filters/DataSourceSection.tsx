import type { ReleaseSource } from '../../../models/ReleaseItem';
import { RELEASE_SOURCE_LABELS } from '../../../services/FilterDefinitions';
import FilterSourceToggle from '../FilterSourceToggle';

type Props = {
  open: boolean;
  onToggle: (isOpen: boolean) => void;
  selectedSources: ReleaseSource[];
  activeSources: ReleaseSource[];
  onChange: (next: ReleaseSource[]) => void;
};

const DataSourceSection = ({
  open,
  onToggle,
  selectedSources,
  activeSources,
  onChange
}: Props) => (
  <details
    className="ul-surface"
    open={open}
    onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}
  >
    <summary className="flex cursor-pointer items-center gap-3 p-6 select-none">
      <svg
        className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      <h2 className="text-lg font-semibold">Fonte dati</h2>
      {!open && (
        <span className="text-xs text-muted-foreground">
          Attive: {activeSources.map((source) => RELEASE_SOURCE_LABELS[source]).join(', ')}
        </span>
      )}
    </summary>
    <div className="space-y-3 px-6 pb-6">
      <FilterSourceToggle
        selected={selectedSources}
        onChange={onChange}
      />
      <div className="text-xs text-muted-foreground">
        Attive: {activeSources.map((source) => RELEASE_SOURCE_LABELS[source]).join(', ')}
      </div>
    </div>
  </details>
);

export default DataSourceSection;
