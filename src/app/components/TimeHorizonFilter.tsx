import { useMemo } from 'react';

/**
 * Time horizon preset types
 */
export type TimeHorizonPreset = 'all' | '3m' | '6m' | '12m' | 'custom';

/**
 * Configuration for mapping presets to filter values
 */
const PRESET_VALUES: Record<Exclude<TimeHorizonPreset, 'custom'>, { history: number; horizon: number }> = {
  all: { history: 999, horizon: 999 }, // No restriction
  '3m': { history: 3, horizon: 3 },
  '6m': { history: 6, horizon: 6 },
  '12m': { history: 12, horizon: 12 }
};

/**
 * Preset labels for display
 */
const PRESET_LABELS: Record<TimeHorizonPreset, string> = {
  all: 'Tutti',
  '3m': '3 mesi',
  '6m': '6 mesi',
  '12m': '12 mesi',
  custom: 'Personalizzato'
};

/**
 * Determines the current preset based on history/horizon values
 */
export function getPresetFromValues(historyMonths: number, horizonMonths: number): TimeHorizonPreset {
  if (historyMonths >= 999 && horizonMonths >= 999) return 'all';
  if (historyMonths === 3 && horizonMonths === 3) return '3m';
  if (historyMonths === 6 && horizonMonths === 6) return '6m';
  if (historyMonths === 12 && horizonMonths === 12) return '12m';
  return 'custom';
}

/**
 * Checks if the time horizon filter is active (restricting results)
 * Active when: toggle ON AND preset is not "Tutti"
 */
export function isTimeHorizonActive(historyMonths: number, horizonMonths: number): boolean {
  // Active if not in "all" (no restriction) mode
  return historyMonths < 999 || horizonMonths < 999;
}

type Props = {
  historyMonths: number;
  horizonMonths: number;
  onChange: (values: { historyMonths: number; horizonMonths: number }) => void;
  /** Compact mode for sidebar */
  compact?: boolean;
};

const TimeHorizonFilter = ({
  historyMonths,
  horizonMonths,
  onChange,
  compact = false
}: Props) => {
  const currentPreset = useMemo(
    () => getPresetFromValues(historyMonths, horizonMonths),
    [historyMonths, horizonMonths]
  );

  // Toggle is ON when preset is NOT "all"
  const isEnabled = currentPreset !== 'all';

  const handleToggle = () => {
    if (isEnabled) {
      // Turn OFF - set to "all" (no restriction)
      onChange({ historyMonths: 999, horizonMonths: 999 });
    } else {
      // Turn ON - default to 12m preset
      onChange({ historyMonths: 12, horizonMonths: 12 });
    }
  };

  const handlePresetChange = (preset: TimeHorizonPreset) => {
    if (preset === 'custom') {
      // Keep current values when switching to custom
      // But ensure they're not the "all" values
      const newHistory = historyMonths >= 999 ? 12 : historyMonths;
      const newHorizon = horizonMonths >= 999 ? 12 : horizonMonths;
      onChange({ historyMonths: newHistory, horizonMonths: newHorizon });
    } else {
      const values = PRESET_VALUES[preset];
      onChange({ historyMonths: values.history, horizonMonths: values.horizon });
    }
  };

  const handleCustomChange = (field: 'history' | 'horizon', value: number) => {
    if (field === 'history') {
      onChange({ historyMonths: value, horizonMonths });
    } else {
      onChange({ historyMonths, horizonMonths: value });
    }
  };

  const labelClass = compact ? 'text-xs' : 'text-sm';
  const inputClass = compact ? 'ul-input text-xs' : 'ul-input text-sm';

  // All presets including "Tutti"
  const presets: TimeHorizonPreset[] = ['all', '3m', '6m', '12m', 'custom'];

  return (
    <div className="space-y-3">
      {/* Toggle ON/OFF */}
      <div className="flex items-center justify-between">
        <span className={`${labelClass} text-muted-foreground`}>
          {isEnabled ? 'Filtro attivo' : 'Filtro disattivato'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            isEnabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              isEnabled ? 'translate-x-[18px]' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Presets (always shown when enabled, includes "Tutti") */}
      {isEnabled && (
        <div className="space-y-2">
          <div className={`${labelClass} text-muted-foreground`}>Preset</div>
          <div className="flex flex-wrap gap-1">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetChange(preset)}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  currentPreset === preset
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                {PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom inputs (only shown when enabled and custom preset) */}
      {isEnabled && currentPreset === 'custom' && (
        <div className="space-y-2 border-l-2 border-primary/30 pl-3">
          <label className={`flex items-center gap-2 ${labelClass} text-muted-foreground`}>
            <span className="min-w-[80px]">History</span>
            <input
              type="number"
              min={1}
              max={120}
              className={inputClass}
              value={historyMonths}
              onChange={(e) => handleCustomChange('history', Number(e.target.value))}
            />
            <span>mesi</span>
          </label>
          <label className={`flex items-center gap-2 ${labelClass} text-muted-foreground`}>
            <span className="min-w-[80px]">Horizon</span>
            <input
              type="number"
              min={1}
              max={120}
              className={inputClass}
              value={horizonMonths}
              onChange={(e) => handleCustomChange('horizon', Number(e.target.value))}
            />
            <span>mesi</span>
          </label>
        </div>
      )}
    </div>
  );
};

export default TimeHorizonFilter;
