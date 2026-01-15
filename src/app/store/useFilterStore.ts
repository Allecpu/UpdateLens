import { create } from 'zustand';
import type { FilterState } from '../../models/Filters';

export type { FilterState } from '../../models/Filters';

type FilterMode = 'inherit' | 'custom';

type FilterStoreState = {
  cssFilters: FilterState | null;
  customerFilters: Record<string, FilterState>;
  customerFilterMode: Record<string, FilterMode>;
  setCssFilters: (filters: FilterState) => void;
  setCustomerFilters: (customerId: string, filters: FilterState) => void;
  setCustomerMode: (customerId: string, mode: FilterMode) => void;
  ensureCssFilters: (defaults: FilterState) => void;
  resetAllFilters: (defaults: FilterState) => void;
  resetCustomerFilters: (customerId: string) => void;
  removeGroupFromFilters: (groupId: string) => void;
  applyGlobalToCustomers: (customerIds: string[], globalFilters: FilterState) => void;
  clearOverridesForCustomers: (customerIds: string[]) => void;
};

const CSS_KEY = 'updatelens.filters.css.v3';
const CUSTOM_KEY = 'updatelens_filters_v1_custom'; // Stable key requests
const MODE_KEY = 'updatelens_filters_v1_mode'; // Stable key requests

const readJson = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const persist = (
  cssFilters: FilterState | null,
  customerFilters: Record<string, FilterState>,
  customerFilterMode: Record<string, FilterMode>
): void => {
  if (cssFilters) {
    localStorage.setItem(CSS_KEY, JSON.stringify(cssFilters));
  }
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(customerFilters));
  localStorage.setItem(MODE_KEY, JSON.stringify(customerFilterMode));
};

const loadInitial = (): {
  cssFilters: FilterState | null;
  customerFilters: Record<string, FilterState>;
  customerFilterMode: Record<string, FilterMode>;
} => {
  return {
    cssFilters: readJson<FilterState | null>(CSS_KEY, null),
    customerFilters: readJson<Record<string, FilterState>>(CUSTOM_KEY, {}),
    customerFilterMode: readJson<Record<string, FilterMode>>(MODE_KEY, {})
  };
};

export const useFilterStore = create<FilterStoreState>((set, get) => {
  const initial = loadInitial();
  return {
    ...initial,
    setCssFilters: (filters) => {
      const { customerFilters, customerFilterMode } = get();
      persist(filters, customerFilters, customerFilterMode);
      set({ cssFilters: filters });
    },
    setCustomerFilters: (customerId, filters) => {
      const next = { ...get().customerFilters, [customerId]: filters };
      const { cssFilters, customerFilterMode } = get();
      persist(cssFilters, next, customerFilterMode);
      set({ customerFilters: next });
    },
    setCustomerMode: (customerId, mode) => {
      const next = { ...get().customerFilterMode, [customerId]: mode };
      const { cssFilters, customerFilters } = get();
      persist(cssFilters, customerFilters, next);
      set({ customerFilterMode: next });
    },
    ensureCssFilters: (defaults) => {
      const current = get().cssFilters;
      if (!current) {
        const { customerFilters, customerFilterMode } = get();
        persist(defaults, customerFilters, customerFilterMode);
        set({ cssFilters: defaults });
      }
    },
    resetAllFilters: (defaults) => {
      persist(defaults, {}, {});
      set({ cssFilters: defaults, customerFilters: {}, customerFilterMode: {} });
    },
    resetCustomerFilters: (customerId) => {
      const nextFilters = { ...get().customerFilters };
      const nextModes = { ...get().customerFilterMode };
      delete nextFilters[customerId];
      delete nextModes[customerId];
      const { cssFilters } = get();
      persist(cssFilters, nextFilters, nextModes);
      set({ customerFilters: nextFilters, customerFilterMode: nextModes });
    },
    removeGroupFromFilters: (groupId) => {
      const { cssFilters, customerFilters, customerFilterMode } = get();
      const stripGroup = (filters: FilterState): FilterState => ({
        ...filters,
        targetGroupIds: filters.targetGroupIds.filter((id) => id !== groupId)
      });
      const nextCss = cssFilters ? stripGroup(cssFilters) : cssFilters;
      const nextCustomerFilters = Object.fromEntries(
        Object.entries(customerFilters).map(([key, value]) => [key, stripGroup(value)])
      );
      persist(nextCss, nextCustomerFilters, customerFilterMode);
      set({ cssFilters: nextCss, customerFilters: nextCustomerFilters });
    },
    applyGlobalToCustomers: (customerIds, globalFilters) => {
      const { cssFilters, customerFilters, customerFilterMode } = get();
      const nextFilters = { ...customerFilters };
      const nextMode = { ...customerFilterMode };

      customerIds.forEach(id => {
        nextFilters[id] = globalFilters;
        nextMode[id] = 'custom';
      });

      persist(cssFilters, nextFilters, nextMode);
      set({ customerFilters: nextFilters, customerFilterMode: nextMode });
    },
    clearOverridesForCustomers: (customerIds) => {
      const { cssFilters, customerFilters, customerFilterMode } = get();
      const nextFilters = { ...customerFilters };
      const nextMode = { ...customerFilterMode };

      customerIds.forEach(id => {
        delete nextFilters[id];
        delete nextMode[id]; // or set to 'inherit' explicitly if we kept the key
      });

      persist(cssFilters, nextFilters, nextMode);
      set({ customerFilters: nextFilters, customerFilterMode: nextMode });
    }
  };
});
