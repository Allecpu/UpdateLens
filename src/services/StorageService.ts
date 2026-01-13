import type { ReleaseSource, ReleaseStatus } from '../models/ReleaseItem';

export type StoredPreferences = {
  selectedProducts: string[];
  selectedSources: ReleaseSource[];
  selectedStatuses: ReleaseStatus[];
  query: string;
  historyMonths: number;
};

const STORAGE_KEY = 'updatelens.preferences.v1';

export const loadPreferences = (fallback: StoredPreferences): StoredPreferences => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as StoredPreferences;
    return {
      selectedProducts: parsed.selectedProducts ?? fallback.selectedProducts,
      selectedSources: parsed.selectedSources ?? fallback.selectedSources,
      selectedStatuses: parsed.selectedStatuses ?? fallback.selectedStatuses,
      query: parsed.query ?? fallback.query,
      historyMonths: parsed.historyMonths ?? fallback.historyMonths
    };
  } catch {
    return fallback;
  }
};

export const savePreferences = (preferences: StoredPreferences): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
};
