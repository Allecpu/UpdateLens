import { useState } from 'react';
import type { CssActivity } from '../../models/Css';
import type { AdvancedFilters, FilterRule } from '../utils/filterEngine';
import {
  FIELD_LABELS,
  OPERATOR_LABELS,
  getOperatorsForField,
  evaluateFilters,
} from '../utils/filterEngine';

interface AdvancedFiltersPanelProps {
  activities: CssActivity[];
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  matchCount?: number;
}

const AVAILABLE_FIELDS = Object.keys(FIELD_LABELS) as Array<keyof CssActivity>;

export function AdvancedFiltersPanel({
  activities,
  filters,
  onFiltersChange,
  matchCount,
}: AdvancedFiltersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAddRule = () => {
    const newRule: FilterRule = {
      id: `rule-${Date.now()}`,
      field: 'customerName',
      operator: '=',
      value: '',
    };
    onFiltersChange({
      ...filters,
      rules: [...filters.rules, newRule],
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    onFiltersChange({
      ...filters,
      rules: filters.rules.filter((r) => r.id !== ruleId),
    });
  };

  const handleUpdateRule = (
    ruleId: string,
    updates: Partial<FilterRule>
  ) => {
    onFiltersChange({
      ...filters,
      rules: filters.rules.map((r) =>
        r.id === ruleId ? { ...r, ...updates } : r
      ),
    });
  };

  const handleToggleLogic = () => {
    onFiltersChange({
      ...filters,
      logic: filters.logic === 'AND' ? 'OR' : 'AND',
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      rules: [],
      logic: 'AND',
    });
  };

  const filteredCount = activities.filter((a) => evaluateFilters(a, filters)).length;
  const hasFilters = filters.rules.length > 0;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isExpanded ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <span>🔍 Filtri Avanzati</span>
        {hasFilters && (
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
            {filters.rules.length}
          </span>
        )}
        {matchCount !== undefined && (
          <span className="ml-2 text-xs text-gray-600">({matchCount} risultati)</span>
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          {/* Logica AND/OR */}
          {filters.rules.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">Logica:</span>
              <button
                onClick={handleToggleLogic}
                className={`rounded-full px-4 py-1 text-sm font-medium transition ${
                  filters.logic === 'AND'
                    ? 'bg-blue-600 text-white'
                    : 'bg-purple-600 text-white'
                }`}
              >
                {filters.logic}
              </button>
              <span className="text-xs text-gray-600">
                {filters.logic === 'AND'
                  ? 'Tutti i filtri devono corrispondere'
                  : 'Almeno uno dei filtri deve corrispondere'}
              </span>
            </div>
          )}

          {/* Regole di filtro */}
          <div className="space-y-2">
            {filters.rules.map((rule, index) => (
              <div key={rule.id} className="space-y-2">
                {index > 0 && (
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-xs font-bold text-blue-600">
                      {filters.logic}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-2 rounded-lg bg-white p-3">
                  {/* Campo */}
                  <div className="flex-1 min-w-[150px]">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Campo
                    </label>
                    <select
                      value={rule.field}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, {
                          field: e.target.value as keyof CssActivity,
                          operator: '=',
                        })
                      }
                      className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {AVAILABLE_FIELDS.map((field) => (
                        <option key={field} value={field}>
                          {FIELD_LABELS[field] || field}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Operatore */}
                  <div className="flex-1 min-w-[150px]">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Operatore
                    </label>
                    <select
                      value={rule.operator}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, {
                          operator: e.target.value as any,
                        })
                      }
                      className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {getOperatorsForField(rule.field).map((op) => (
                        <option key={op} value={op}>
                          {OPERATOR_LABELS[op]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Valore */}
                  {!['isEmpty', 'isNotEmpty'].includes(rule.operator) && (
                    <div className="flex-1 min-w-[150px]">
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Valore
                      </label>
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) =>
                          handleUpdateRule(rule.id, { value: e.target.value })
                        }
                        placeholder="Inserisci valore..."
                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* Elimina */}
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="rounded bg-red-100 p-2 text-red-600 hover:bg-red-200"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {filters.rules.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-600">
                Nessun filtro aggiunto. Clicca "+ Aggiungi filtro" per iniziare.
              </div>
            )}
          </div>

          {/* Pulsanti azioni */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={handleAddRule}
              className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Aggiungi filtro
            </button>
            {hasFilters && (
              <button
                onClick={handleClearFilters}
                className="rounded bg-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-400"
              >
                Pulisci filtri
              </button>
            )}
          </div>

          {/* Preview risultati */}
          {hasFilters && (
            <div className="rounded-lg bg-green-50 p-3 text-xs text-green-800 border border-green-200">
              <span className="font-medium">✓ Filtri applicati:</span> {filteredCount} su{' '}
              {activities.length} items corrisponde
            </div>
          )}
        </div>
      )}
    </div>
  );
}
