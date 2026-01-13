import { create } from 'zustand';
import type { Customer, CustomerIndexEntry } from '../../models/Customer';
import { loadProductsConfig, loadRulesConfig } from '../../services/DataLoader';
import {
  deleteCustomer as deleteCustomerStorage,
  loadCustomer,
  loadCustomerIndex,
  saveCustomer,
  saveCustomerIndex
} from '../../services/CustomerStorage';
import { loadSeedCustomers, loadSeedOwnerMap } from '../../services/CustomerSeed';

type CustomerState = {
  index: CustomerIndexEntry[];
  customers: Record<string, Customer>;
  activeCustomerId: string | null;
  setActiveCustomer: (id: string | null) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  forceOwnerCssFromSeed: () => void;
  replaceAll: (
    index: CustomerIndexEntry[],
    customers: Record<string, Customer>
  ) => void;
};

const isEntryActive = (entry?: CustomerIndexEntry | null): boolean =>
  Boolean(entry && entry.isActive !== false);

const normalizeEntry = (entry: CustomerIndexEntry): CustomerIndexEntry => ({
  ...entry,
  isActive: entry.isActive !== false
});

const normalizeCustomer = (customer: Customer): Customer => ({
  ...customer,
  isActive: customer.isActive !== false
});

const toIndexEntry = (customer: Customer): CustomerIndexEntry => ({
  id: customer.id,
  name: customer.name,
  ownerCss: customer.ownerCss ?? '',
  isActive: customer.isActive !== false
});

const resolveActiveCustomerId = (
  entries: CustomerIndexEntry[],
  currentId?: string | null
): string | null => {
  if (currentId) {
    const current = entries.find((entry) => entry.id === currentId);
    if (isEntryActive(current)) {
      return currentId;
    }
  }
  const firstActive = entries.find((entry) => isEntryActive(entry));
  return firstActive ? firstActive.id : null;
};

const loadInitialState = (): {
  index: CustomerIndexEntry[];
  customers: Record<string, Customer>;
} => {
  let index = loadCustomerIndex();
  const customers: Record<string, Customer> = {};

  if (index.length === 0) {
    const productsConfig = loadProductsConfig();
    const rulesConfig = loadRulesConfig();
    const seeded = loadSeedCustomers(productsConfig, rulesConfig);
    seeded.index.forEach((entry) => {
      customers[entry.id] = seeded.customers[entry.id];
      saveCustomer(seeded.customers[entry.id]);
    });
    saveCustomerIndex(seeded.index);
    return { index: seeded.index, customers };
  }

  const seedOwnerMap = loadSeedOwnerMap();
  let indexUpdated = false;
  index = index.map((entry) => {
    const normalized = normalizeEntry(entry);
    if (normalized.isActive !== entry.isActive) {
      indexUpdated = true;
    }
    if (normalized.ownerCss || !seedOwnerMap[entry.id]) {
      return normalized;
    }
    indexUpdated = true;
    return { ...normalized, ownerCss: seedOwnerMap[entry.id] };
  });

  index.forEach((entry) => {
    const customer = loadCustomer(entry.id);
    if (customer) {
      let updatedCustomer = normalizeCustomer(customer);
      let shouldSave = updatedCustomer.isActive !== customer.isActive;
      if (!updatedCustomer.ownerCss && seedOwnerMap[entry.id]) {
        updatedCustomer = { ...updatedCustomer, ownerCss: seedOwnerMap[entry.id] };
        shouldSave = true;
      }
      customers[entry.id] = updatedCustomer;
      if (shouldSave) {
        saveCustomer(updatedCustomer);
      }
    }
  });

  if (indexUpdated) {
    saveCustomerIndex(index);
  }

  return { index, customers };
};

const persistIndex = (index: CustomerIndexEntry[]): void => {
  saveCustomerIndex(index);
};

export const useCustomerStore = create<CustomerState>((set, get) => {
  const { index, customers } = loadInitialState();

  return {
    index,
    customers,
    activeCustomerId: resolveActiveCustomerId(index),
    setActiveCustomer: (id) =>
      set({
        activeCustomerId: id
          ? resolveActiveCustomerId(get().index, id)
          : null
      }),
    addCustomer: (customer) => {
      const normalizedCustomer = normalizeCustomer(customer);
      const nextIndex = [...get().index, toIndexEntry(normalizedCustomer)];
      const nextCustomers = { ...get().customers, [customer.id]: normalizedCustomer };
      saveCustomer(normalizedCustomer);
      persistIndex(nextIndex);
      const nextActiveCustomerId =
        normalizedCustomer.isActive === false
          ? resolveActiveCustomerId(nextIndex, get().activeCustomerId)
          : normalizedCustomer.id;
      set({
        index: nextIndex,
        customers: nextCustomers,
        activeCustomerId: nextActiveCustomerId
      });
    },
    updateCustomer: (customer) => {
      const normalizedCustomer = normalizeCustomer(customer);
      const nextIndex = get().index.map((entry) =>
        entry.id === normalizedCustomer.id
          ? toIndexEntry(normalizedCustomer)
          : entry
      );
      const nextCustomers = {
        ...get().customers,
        [normalizedCustomer.id]: normalizedCustomer
      };
      saveCustomer(normalizedCustomer);
      persistIndex(nextIndex);
      set({
        index: nextIndex,
        customers: nextCustomers,
        activeCustomerId: resolveActiveCustomerId(
          nextIndex,
          get().activeCustomerId
        )
      });
    },
    deleteCustomer: (id) => {
      const nextIndex = get().index.filter((entry) => entry.id !== id);
      const nextCustomers = { ...get().customers };
      delete nextCustomers[id];
      deleteCustomerStorage(id);
      persistIndex(nextIndex);
      set({
        index: nextIndex,
        customers: nextCustomers,
        activeCustomerId: resolveActiveCustomerId(nextIndex, get().activeCustomerId)
      });
    },
    forceOwnerCssFromSeed: () => {
      const seedOwnerMap = loadSeedOwnerMap();
      if (Object.keys(seedOwnerMap).length === 0) {
        return;
      }
      const nextIndex = get().index.map((entry) =>
        seedOwnerMap[entry.id]
          ? { ...entry, ownerCss: seedOwnerMap[entry.id] }
          : entry
      );
      const nextCustomers: Record<string, Customer> = { ...get().customers };
      Object.entries(nextCustomers).forEach(([id, customer]) => {
        if (seedOwnerMap[id]) {
          nextCustomers[id] = { ...customer, ownerCss: seedOwnerMap[id] };
          saveCustomer(nextCustomers[id]);
        }
      });
      persistIndex(nextIndex);
      set({ index: nextIndex, customers: nextCustomers });
    },
    replaceAll: (nextIndex, nextCustomers) => {
      const normalizedIndex = nextIndex.map(normalizeEntry);
      const normalizedCustomers = Object.fromEntries(
        Object.entries(nextCustomers).map(([id, customer]) => [
          id,
          normalizeCustomer(customer)
        ])
      );
      const existing = get().index.map((entry) => entry.id);
      const nextIds = new Set(normalizedIndex.map((entry) => entry.id));
      existing.forEach((id) => {
        if (!nextIds.has(id)) {
          deleteCustomerStorage(id);
        }
      });
      persistIndex(normalizedIndex);
      Object.values(normalizedCustomers).forEach((customer) => saveCustomer(customer));
      set({
        index: normalizedIndex,
        customers: normalizedCustomers,
        activeCustomerId: resolveActiveCustomerId(
          normalizedIndex,
          get().activeCustomerId
        )
      });
    }
  };
});
