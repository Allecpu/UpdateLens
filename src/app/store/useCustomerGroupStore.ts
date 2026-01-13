import { create } from 'zustand';
import type { CustomerGroup } from '../../models/CustomerGroup';

type CustomerGroupState = {
  groups: CustomerGroup[];
  addGroup: (group: Omit<CustomerGroup, 'id' | 'updatedAt'>) => string;
  updateGroup: (group: CustomerGroup) => void;
  deleteGroup: (id: string) => void;
};

const STORAGE_KEY = 'updatelens.customerGroups.v1';

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

const persist = (groups: CustomerGroup[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Ignore storage errors so UI state still updates.
  }
};

const createId = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  return `${slug || 'group'}-${Date.now()}`;
};

export const useCustomerGroupStore = create<CustomerGroupState>((set, get) => {
  const initialGroups = readJson<CustomerGroup[]>(STORAGE_KEY, []);

  return {
    groups: initialGroups,
    addGroup: (group) => {
      const now = new Date().toISOString();
      const id = createId(group.name);
      const next = [...get().groups, { ...group, id, updatedAt: now }];
      persist(next);
      set({ groups: next });
      return id;
    },
    updateGroup: (group) => {
      const now = new Date().toISOString();
      const next = get().groups.map((entry) =>
        entry.id === group.id ? { ...group, updatedAt: now } : entry
      );
      persist(next);
      set({ groups: next });
    },
    deleteGroup: (id) => {
      const next = get().groups.filter((entry) => entry.id !== id);
      persist(next);
      set({ groups: next });
    }
  };
});
