import { useState, useCallback } from 'react';
import type { CssActivity } from '../../models/Css';
import type { AdvancedFilters } from '../utils/filterEngine';
import { filterActivities } from '../utils/filterEngine';

export type { AdvancedFilters } from '../utils/filterEngine';

interface UseAdvancedFiltersReturn {
  filters: AdvancedFilters;
  setFilters: (filters: AdvancedFilters) => void;
  filteredActivities: CssActivity[];
  matchCount: number;
  clearFilters: () => void;
}

export const useAdvancedFilters = (
  activities: CssActivity[]
): UseAdvancedFiltersReturn => {
  const [filters, setFilters] = useState<AdvancedFilters>({
    rules: [],
    logic: 'AND',
  });

  const filteredActivities = filterActivities(activities, filters);
  const matchCount = filteredActivities.length;

  const clearFilters = useCallback(() => {
    setFilters({
      rules: [],
      logic: 'AND',
    });
  }, []);

  return {
    filters,
    setFilters,
    filteredActivities,
    matchCount,
    clearFilters,
  };
};
